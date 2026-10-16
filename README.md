# Student certificate portal demo

This project runs the existing HTML site with either a deliberately vulnerable Express API or a fixed API. The login page is `http://localhost:3000/errorpresent.html`; a successful login opens the home page.

## Setup

1. Install Node.js 18 or newer.
2. From the repository root, run `npm install`.
3. Start one server at a time:
   - Vulnerable version: `npm run start:vulnerable`
   - Fixed version: `npm run start:fixed`
4. Open `http://localhost:3000/` or `http://localhost:3000/errorpresent.html`. Stop the server with **Ctrl+C** before switching versions.

Both servers use in-memory data, which resets when the server restarts. This is an educational demo, not a production login system: the sample passwords are hard-coded and passwords, session storage, and persistence need production-grade implementations before real use.

## Demo accounts

| Matric number | Password | Stored name | Programme progress |
| --- | --- | --- | --- |
| `STU1001` | `complete123` | Alicce Johnson | 100% |
| `STU1002` | `progress123` | Jordan Lee | 40% |

## Reproduce the bug and verify the fix

1. Start `npm run start:vulnerable` and sign in at `http://localhost:3000/errorpresent.html` as `STU1001` / `complete123`.
2. Open **Certificate** from the navigation. Correct the misspelling in **Edit your stored name**, save it, and generate a certificate to confirm the corrected name can be used.
3. In **Generate a certificate**, set the matric number to `STU1002` and the requested name to `Jordan Lee`. The vulnerable server issues that certificate even though the student has only completed 40%.
4. Stop the server, start `npm run start:fixed`, and sign in as `STU1002` / `progress123`. Open **Certificate** and submit a request with `STU1001` and `Alicce Johnson` in the request fields. The server responds that programme completion is required (HTTP 403); it uses the logged-in identity, not the submitted matric number.
5. Sign in as the completed student on the fixed server and request a certificate using a different matric number and name. It issues only for the signed-in student and uses the name stored for that student. A second request returns the existing active certificate. Change the stored name and the previous certificate becomes revoked; name edits are capped at two.

## API overview

- `POST /api/login` validates the demo credentials and returns a random session token.
- `PUT /api/profile/name` changes the stored name (fixed server: authenticated student only, at most two changes).
- `POST /api/certificates` issues a certificate.
- `GET /api/verify/:id` publicly reports whether a certificate ID is active or revoked.

The portal HTML and its local assets are available only after a successful login. The vulnerable version deliberately trusts the matric number and name in the certificate request and does not check progress. The fixed version authenticates with the session cookie or bearer token, checks server-side progress, uses the database name, revokes certificates after name changes, and permits only one active certificate per student.
