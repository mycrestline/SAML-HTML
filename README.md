# SAML HTML Project

Minimal Okta SAML 2.0 Service Provider (SP) demo. A Node/Express server
handles the SAML login redirect and validates Okta's signed response; once
authenticated it serves a page that says "Welcome to SAML HTML Project".

A static HTML page can't do this alone — SAML needs a server to send the
login request and to validate the signed response Okta POSTs back.

## 1. Run the app

```
npm install
cp .env.example .env
npm start
```

It starts on http://localhost:3000. Visiting `/` redirects to `/login`
until you're authenticated via Okta.

## 2. Create the app in Okta

In the Okta Admin Console: **Applications > Create App Integration > SAML 2.0**.

Enter:
- **Single sign-on URL (ACS URL):** `http://localhost:3000/login/callback`
- **Audience URI (SP Entity ID):** `http://localhost:3000/metadata`
- **Name ID format:** EmailAddress

(These match `SP_ACS_URL` / `SP_ENTITY_ID` in `.env` — change both places
together if you use different values.)

Assign the app to your user.

## 3. Copy values back from Okta into `.env`

On the app's **Sign On** tab, click **View SAML setup instructions** and copy:
- `IDP_SSO_URL` — "Identity Provider Single Sign-On URL"
- `IDP_ISSUER` — "Identity Provider Issuer"
- Download the **X.509 certificate** and save it as `okta.cert` in this
  folder (already the default for `IDP_CERT_FILE`), or paste its contents
  into `IDP_CERT` in `.env`.

Restart the server (`npm start`) after editing `.env`.

## 4. Require Okta Verify for this app

By default Okta may not challenge for MFA on every app. To force an Okta
Verify prompt when this app is opened: **Security > Authentication
Policies**, create/edit a policy that requires Okta Verify, then assign
that policy to this app under the app's **Sign On** tab
("Sign-on policy" / app sign-in policy).

## 5. Test it

Open http://localhost:3000 — you should be redirected to Okta, prompted
for Okta Verify, and land back on the welcome page signed in.

## 6. Deploy to Render

The repo is connected to Render with:
- **Build Command:** `npm install`
- **Start Command:** `node server.js` (or `npm start`)

Render only runs the code from git — it never sees your local `.env`
(it's gitignored on purpose so secrets don't end up in the public repo).
You must set the same variables under the Render service's **Environment**
tab manually:

| Key | Value |
|---|---|
| `SESSION_SECRET` | a random string |
| `SP_ENTITY_ID` | `https://saml-html.onrender.com/metadata` |
| `SP_ACS_URL` | `https://saml-html.onrender.com/login/callback` |
| `IDP_SSO_URL` | same value as local `.env` |
| `IDP_ISSUER` | same value as local `.env` |
| `IDP_CERT` | same value as local `.env` |

(Skip `PORT` — Render sets it automatically and `server.js` already reads
`process.env.PORT`.)

Then update the Okta app itself to match the live URL:
- **Single sign-on URL (ACS URL):** `https://saml-html.onrender.com/login/callback`
- **Audience URI (SP Entity ID):** `https://saml-html.onrender.com/metadata`

Without both the Render env vars and the matching Okta app URLs, `/login`
will 500 (missing `IDP_SSO_URL`) or Okta will reject the response
(Audience/ACS mismatch).

## Endpoints

| Route              | Purpose                                      |
|---------------------|-----------------------------------------------|
| `/`                 | Protected welcome page                        |
| `/login`            | Starts the SP-initiated SAML login            |
| `/login/callback`   | ACS — Okta POSTs the SAML response here       |
| `/metadata`         | SP metadata XML (can be imported into Okta)   |
| `/logout`           | Clears the local session                      |
