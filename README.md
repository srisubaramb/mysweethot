# My Sweet Hot Website

## Files
- `index.html` — home page
- `about.html` — brand story and FSSAI/MSME document links
- `menu.html` — menu and prices transcribed from the supplied two-page menu card
- `branches.html` — Thiruvanmiyur, Madipakkam, One Paramount (Porur), Mayura Food Hub (Porur)
- `contact.html` — email, phone numbers and enquiry form
- `loyalty.html` — staff-facing visit-based loyalty dashboard
- `loyalty.js` — connects the loyalty page to the protected API
- `api/loyalty.js` — Vercel serverless API backed by Neon Postgres
- `styles.css` — shared styling
- `script.js` — mobile navigation, copyright year and mailto form behaviour
- `LOYALTY_SETUP.md` — deployment and database setup

## Run locally
Open this folder in VS Code and run `index.html` with the Live Server extension for the public website pages. The loyalty dashboard requires a Vercel deployment plus the environment variables described in `LOYALTY_SETUP.md`; its shared database functionality will not run from a plain file or Live Server.

## Loyalty system
The loyalty page records store visits, not spending. Staff sign in with a server-validated password, search by customer phone number, register a new member, and record visits. Customer and visit records are stored in a shared Neon Postgres database; the browser does not store the customer database in local storage. Milestones currently display at 5 and 10 visits and must be confirmed with the business before launch.

Keep the repository public website free of passwords and connection strings. Configure `DATABASE_URL`, `LOYALTY_ADMIN_PASSWORD`, and `LOYALTY_SESSION_SECRET` in Vercel project environment variables. This is a lightweight starter, not a substitute for a security review before a larger production rollout.

## Notes
- Menu names and prices are transcribed from the menu card supplied by the business. Confirm current pricing and availability before publishing.
- Google Maps links open outlet-name searches, not verified exact pins. Replace them with direct map URLs when available.
- FSSAI and MSME buttons open the Google Drive URLs supplied by the business. Ensure those documents have suitable sharing permissions.
- The contact form opens the visitor's email application; it does not submit to a server.
- Fonts are loaded from Google Fonts and require an internet connection.
