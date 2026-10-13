# NikahConnect

**Meaningful Connections. Marriage with Purpose.**

NikahConnect is a Kenya-first Muslim marriage and matchmaking platform for adults aged 18 and over. The current application supports profile setup, member discovery, mutual likes and matches, private conversations, account controls, an administrator dashboard, and one-time PayHero/M-Pesa contact reveal plans.

## Current service details

- Creating a profile, browsing, liking, and messaging after mutual interest are free.
- Contact reveal plans are one-time purchases. They are valid for 30 days and do not automatically renew.
- PayHero transaction status is checked server-side before a paid entitlement is activated.
- Identity and phone verification, in-app wali or chaperone participation, in-app reporting/blocking, and assisted matchmaking are not currently available.
- Profile photos use public storage URLs. A person with a photo URL may be able to view the photo outside the signed-in application.
- Email confirmation is currently disabled in Supabase Auth configuration.

## Stack

- TanStack Start, React, TypeScript, and Vite
- Supabase Auth, PostgreSQL, Row Level Security, Storage, and Realtime
- PayHero M-Pesa STK Push and transaction status API
- Vercel deployment configuration

## Local development

Use Node.js and npm, then install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

Set the following variables in a local `.env` file. Never commit `.env` or expose the service-role key in browser code.

```dotenv
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=

PAYHERO_API_USERNAME=
PAYHERO_API_PASSWORD=
PAYHERO_CHANNEL_ID=
PAYHERO_CALLBACK_URL=
```

PayHero credentials may also be managed from `/admin/payments`. `PAYHERO_CALLBACK_URL` defaults to `${SUPABASE_URL}/functions/v1/payhero-webhook`; preserve the current project URL and callback when deploying.

## Supabase CLI and migrations

The Supabase CLI is installed as a project dev dependency. Run it with `npx supabase` from this directory. The local project reference in `supabase/config.toml` is `gwxivtjwibhsucarojlx`.

After signing in to the CLI and linking the project, review pending migrations before applying them to the hosted database:

```sh
npx supabase login
npx supabase link --project-ref gwxivtjwibhsucarojlx
npx supabase migration list
```

The `20261013120000_nikahconnect_privacy_age_consent.sql` migration adds database-side adult eligibility and signup consent checks, narrows direct profile and message access, and keeps discovery fields in the `public_profiles` projection. Apply and review this migration in a non-production environment before production deployment. It does not drop or rename existing tables.

Deploy the PayHero webhook after setting the needed Supabase function secrets:

```sh
npx supabase secrets set PAYHERO_API_USERNAME=... PAYHERO_API_PASSWORD=... PAYHERO_CHANNEL_ID=...
npx supabase functions deploy payhero-webhook --no-verify-jwt
```

The webhook accepts the provider callback without a Supabase user JWT, looks up the pending payment by its idempotency reference, checks the transaction status with PayHero, and creates at most one subscription per payment.

## Application checks

```sh
npm run lint
npm run build
```

There is no dedicated test script in `package.json` at present.

## Public routes

- `/` — service overview and FAQ
- `/about` — matchmaking approach and current feature limits
- `/membership` — free access and paid contact reveal pricing
- `/privacy` — current data use and privacy notice
- `/terms` — service terms
- `/community-guidelines` — respectful use guidance

The public legal pages still need the operator’s legal name and a support/privacy contact before they can serve as final legal notices.
