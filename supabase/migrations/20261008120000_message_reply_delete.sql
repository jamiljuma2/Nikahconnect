ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid
    REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.validate_message_reply_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  reply_match_id uuid;
BEGIN
  IF NEW.reply_to_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT match_id INTO reply_match_id
  FROM public.messages
  WHERE id = NEW.reply_to_message_id;

  IF reply_match_id IS NULL OR reply_match_id <> NEW.match_id THEN
    RAISE EXCEPTION 'Reply target must be a message in the same conversation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_validate_reply_match ON public.messages;
CREATE TRIGGER messages_validate_reply_match
  BEFORE INSERT OR UPDATE OF reply_to_message_id, match_id
  ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_message_reply_match();

COMMENT ON COLUMN public.messages.deleted_at IS
  'When set, the message content has been replaced with a deletion placeholder.';
