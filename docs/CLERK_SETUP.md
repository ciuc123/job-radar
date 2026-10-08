# Clerk setup checklist

The app code is ready for Clerk, but the Clerk and Google dashboards still need configuration. Keep the Development and Production Clerk instances separate. Do not copy live keys into local files.

## 1. Development instance and local sign-in

1. In [Clerk Dashboard](https://dashboard.clerk.com/), create a Job Radar application and stay in its Development instance.
2. Open **SSO connections → Add connection → For all users → Google**. Enable sign-up and sign-in. Clerk supplies shared OAuth credentials for Development, so no Google Cloud OAuth client is needed for local setup.
3. Open **API keys** and copy the Development publishable key and secret key into `.env.local` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
4. Add these values to `.env.local`:

   ```dotenv
   APP_ADMIN_EMAILS=andrei@ciuculescu.com
   APP_OWNER_EMAIL=andrei@ciuculescu.com
   ```

5. Set `DATABASE_URL` to your separate Neon Development branch/database, then run `npm run db:migrate`. Start the app with `npm run dev` and visit `http://localhost:3000/signin`.
6. Sign in with the Google account whose verified primary email is `andrei@ciuculescu.com`. The app links it to the existing local user row by verified email, preserving profile, tracker, and application data. It grants the `admin` role and owner Pro entitlement from the server-side environment allowlists.

## 2. Production domain and Google sign-in

1. In Clerk Dashboard, create a separate **Production instance**.
2. In your domain registrar/DNS provider, add the records shown by Clerk under **Domains** for the domain you own. A `vercel.app` hostname alone cannot be used as the Clerk production domain.
3. In the Production Clerk instance, open **SSO connections → Add connection → For all users → Google**. Enable sign-up/sign-in and **Use custom credentials**. Copy the exact **Authorized Redirect URI** shown by Clerk.
4. In [Google Cloud Console](https://console.cloud.google.com/), open **APIs & Services → Credentials → Create credentials → OAuth client ID**. Select **Web application**. Add your owned site origin under **Authorized JavaScript origins**. Paste Clerk's exact redirect URI under **Authorized redirect URIs**. Do not use the old Auth.js `/api/auth/callback/google` URL; Google redirects to Clerk, which then returns users to Job Radar.
5. If the Google consent screen is External, publish it for general use and complete any verification Google requires. In Clerk, paste the Google client ID and secret into the production Google connection and save.
6. In the Production instance's **API keys**, copy the live publishable and secret keys. Add them to Vercel under **Project → Settings → Environment Variables**, scoped to **Production**, and point Production at the production Neon database. Add Development keys and the Development Neon URL to Vercel's **Development** and **Preview** scopes. Set `APP_ADMIN_EMAILS` and `APP_OWNER_EMAIL` to `andrei@ciuculescu.com` in Production too.
7. Redeploy Vercel after changing environment variables. Verify sign-in using your owned production domain.

## 3. Free and Pro plans

1. In the Production Clerk instance, enable **Billing** and connect the Stripe account Clerk prompts you to use. Development Billing uses sandbox/test payment processing; configure it separately from live billing.
2. Open **Billing → Plans** and create a user-level Free plan. Mark it as the default plan. New users then receive Free automatically.
3. Create these plan features with the exact slugs below:

   | Feature name | Slug | Free | Pro |
   | --- | --- | --- | --- |
   | AI analysis | `ai_analysis` | Off | On |
   | Email alerts | `email_alerts` | Off | On |

4. Create a recurring user-level Pro plan, attach both features, and set the price/cadence you want. Product pricing is intentionally a dashboard setting; the app reads Pro entitlement from Clerk rather than hard-coding an amount.
5. The `/billing` page renders Clerk's pricing table. Verify it shows Free and Pro after Billing is configured.

## 4. Webhook synchronization for scheduled tasks

The dashboard can check Clerk entitlements directly. GitHub Actions cannot, because it runs without a signed-in user session, so it reads the locally synchronized plan state.

1. In each Clerk instance, open **Webhooks → Add endpoint** and set the endpoint URL to `https://YOUR_DOMAIN/api/webhooks/clerk`.
2. Subscribe to `user.created`, `user.updated`, `user.deleted`, and the subscription-item lifecycle events: `subscriptionItem.active`, `subscriptionItem.updated`, `subscriptionItem.canceled`, `subscriptionItem.ended`, `subscriptionItem.abandoned`, `subscriptionItem.incomplete`, `subscriptionItem.pastDue`, and `subscriptionItem.upcoming`.
3. Copy that endpoint's signing secret into `CLERK_WEBHOOK_SIGNING_SECRET` for the matching environment. Use a separate endpoint/secret for Development and Production.
4. `upcoming` plan changes take effect at the end of the current billing period; the webhook handler leaves the current plan in place until the ending event arrives. Event IDs are stored to avoid processing duplicate deliveries twice.
5. Confirm Clerk's webhook dashboard shows successful 2xx deliveries after a new user signs up and after a test subscription changes state. The webhook route verifies Clerk's signature and is intentionally excluded from the app's sign-in middleware.

## 5. Owner access and requests

- `APP_ADMIN_EMAILS` is a comma-separated allowlist of verified primary email addresses that receive the `admin` role. Add future trusted admins there, then redeploy. Users cannot set this role themselves.
- `APP_OWNER_EMAIL` grants the no-charge Pro override to the one owner account. Keep this separate from admin role assignment; admin alone does not bypass plan checks.
- `/admin` shows a small account/plan overview. User questions and feature requests go to the support link in the dashboard and can be handled manually for now.
- To test Free, use a regular test user in the Development instance. Your owner account intentionally stays Pro in Production.

## 6. Database cutover

Run `npm run db:migrate` once against Neon before switching production sign-in. Migration `0004_clerk_accounts.sql` adds Clerk identity mapping and per-user job score/analysis tables, copying existing scores and AI analysis to the current user. On first Clerk sign-in, a verified email match links the Clerk user to the pre-existing local user ID. Confirm the profile and application tracker are present before removing any legacy Auth.js database tables.

References: [Clerk Google OAuth setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google), [Clerk production deployment](https://clerk.com/docs/guides/development/deployment/production), [Clerk Billing](https://clerk.com/docs/guides/billing/overview), [Billing webhooks](https://clerk.com/docs/guides/development/webhooks/billing), [webhook verification](https://clerk.com/docs/guides/development/webhooks/syncing).
