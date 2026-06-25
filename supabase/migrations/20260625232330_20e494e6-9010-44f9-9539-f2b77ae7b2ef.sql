
-- 1. Link subscription to funding payment
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;

-- Backfill: latest successful payment per user that doesn't already back a subscription
WITH ranked AS (
  SELECT p.id AS payment_id, p.user_id,
         ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY p.created_at DESC) AS rn
  FROM public.payments p
  WHERE p.status = 'success'
)
UPDATE public.subscriptions s
SET payment_id = r.payment_id
FROM ranked r
WHERE s.payment_id IS NULL
  AND s.user_id = r.user_id
  AND r.rn = 1;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_id_unique
  ON public.subscriptions(payment_id)
  WHERE payment_id IS NOT NULL;

-- 2. Idempotency for reveals
ALTER TABLE public.number_reveals
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS number_reveals_viewer_idem_unique
  ON public.number_reveals(viewer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS number_reveals_viewer_time_idx
  ON public.number_reveals(viewer_id, revealed_at DESC);

-- 3. Atomic consume_reveal RPC with cooldowns + payment linkage
CREATE OR REPLACE FUNCTION public.consume_reveal(
  _viewer uuid,
  _owner uuid,
  _idempotency_key text DEFAULT NULL
) RETURNS TABLE(reveal_id uuid, already_revealed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_sub_id uuid;
  v_is_unlimited boolean;
  v_recent_3s int;
  v_recent_min int;
  v_recent_day int;
  v_new_id uuid;
BEGIN
  IF _viewer IS NULL OR _owner IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF _viewer = _owner THEN
    RAISE EXCEPTION 'self_reveal';
  END IF;

  -- Idempotency by client key: return existing
  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.number_reveals
    WHERE viewer_id = _viewer AND idempotency_key = _idempotency_key
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN QUERY SELECT v_existing, true; RETURN;
    END IF;
  END IF;

  -- Already revealed for this owner: free, return existing
  SELECT id INTO v_existing FROM public.number_reveals
  WHERE viewer_id = _viewer AND profile_owner_id = _owner
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, true; RETURN;
  END IF;

  -- Cooldown: 1 reveal per 3 seconds
  SELECT count(*) INTO v_recent_3s FROM public.number_reveals
  WHERE viewer_id = _viewer AND revealed_at > now() - interval '3 seconds';
  IF v_recent_3s > 0 THEN RAISE EXCEPTION 'cooldown'; END IF;

  -- Rate: <= 5 / minute
  SELECT count(*) INTO v_recent_min FROM public.number_reveals
  WHERE viewer_id = _viewer AND revealed_at > now() - interval '1 minute';
  IF v_recent_min >= 5 THEN RAISE EXCEPTION 'rate_minute'; END IF;

  -- Rate: <= 50 / day
  SELECT count(*) INTO v_recent_day FROM public.number_reveals
  WHERE viewer_id = _viewer AND revealed_at > now() - interval '24 hours';
  IF v_recent_day >= 50 THEN RAISE EXCEPTION 'rate_day'; END IF;

  -- Find a subscription strictly backed by a successful payment owned by the viewer,
  -- not expired, and with balance. Lock the row for atomic decrement.
  SELECT s.id, s.is_unlimited INTO v_sub_id, v_is_unlimited
  FROM public.subscriptions s
  JOIN public.payments p ON p.id = s.payment_id
  WHERE s.user_id = _viewer
    AND p.user_id = _viewer
    AND p.status = 'success'
    AND (s.expiry_date IS NULL OR s.expiry_date > now())
    AND (s.is_unlimited OR s.remaining_reveals > 0)
  ORDER BY s.start_date DESC
  LIMIT 1
  FOR UPDATE OF s;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'no_active_paid_subscription';
  END IF;

  IF NOT v_is_unlimited THEN
    UPDATE public.subscriptions
      SET remaining_reveals = remaining_reveals - 1
      WHERE id = v_sub_id AND remaining_reveals > 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'no_balance'; END IF;
  END IF;

  INSERT INTO public.number_reveals (viewer_id, profile_owner_id, idempotency_key)
  VALUES (_viewer, _owner, _idempotency_key)
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_reveal(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_reveal(uuid, uuid, text) TO service_role;
