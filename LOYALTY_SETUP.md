# Loyalty dashboard setup

This feature is designed for the existing plain HTML/CSS/JavaScript site and uses a Vercel serverless API plus Neon Postgres for shared storage. It is not a browser-only demo: all staff members use the same database.

## 1. Confirm the hosting target

Deploy this repository through Vercel (or a compatible platform supporting the same Node serverless function). The API route is `/api/loyalty`. A static-only host will display the page but cannot run the API.

## 2. Create a Neon Postgres database

1. Create a project at https://neon.tech/ and copy its Postgres connection string.
2. In Vercel, open the project for this repository, then **Settings → Environment Variables**.
3. Add `DATABASE_URL` and paste the Neon connection string. Keep it server-only; do not prefix it with `NEXT_PUBLIC_` or expose it in frontend code.
4. The API creates the `loyalty_customers` and `loyalty_visits` tables automatically when the first authenticated API operation runs.

## 3. Set staff access secrets

In Vercel Environment Variables, add:

- `LOYALTY_ADMIN_PASSWORD`: a unique, strong passphrase shared only with authorized staff. Use at least 16 characters.
- `LOYALTY_SESSION_SECRET`: a randomly generated secret with at least 32 random bytes. Generate one locally with Node.js: `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.

Never commit these values to this repository or put them in `loyalty.js`. Redeploy after adding or changing environment variables. The session cookie is HTTP-only and expires after eight hours. This simple starter uses one shared staff password; it does not provide separate staff accounts or per-person audit identities.

## 4. Deploy and test

1. Deploy the branch to a Vercel preview or merge it only when ready.
2. Open `/loyalty.html` on the deployed site.
3. Sign in, register a test customer using a dummy phone number, search for that number, and record a test visit.
4. Confirm the visit counter updates and the rows appear in Neon.
5. Test from another device/browser to confirm the data is shared. Then delete test records from the database before onboarding real customers.

## Behavior and safeguards

- Reward milestones shown in the interface are currently **5 visits** and **10 visits**, provided as examples. Confirm the real benefit rules with the business.
- Each visit click asks for confirmation. Staff must record a visit only when a customer actually arrives.
- Common Indian number formats with a leading `+91` or `0` are normalized to the same 10-digit number.
- The API uses parameterized SQL, an HTTP-only signed session cookie, same-origin checks and server-side validation. It is still a lightweight prototype: use HTTPS, restrict access to staff, protect the Neon database credentials, and arrange a security/privacy review before wider production use.
- Phone numbers are personal data. Inform the business owner/staff about who can access them, keep access limited, and remove records when they are no longer needed.

## Troubleshooting

- **“Loyalty service is not configured yet”**: check that all three environment variables are set in the active Vercel environment, then redeploy.
- **404 / API did not return JSON**: ensure the `api/loyalty.js` file was deployed and the project is running on Vercel or a compatible serverless host.
- **Database error**: verify the Neon connection string and that the database is reachable.
- **Changes are not shared**: check that all devices use the same deployed domain and database.
