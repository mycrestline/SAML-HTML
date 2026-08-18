require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const {
  Strategy: SamlStrategy,
  generateServiceProviderMetadata,
} = require("@node-saml/passport-saml");

const PORT = process.env.PORT || 3000;

function resolveIdpCert() {
  if (process.env.IDP_CERT && process.env.IDP_CERT.trim()) {
    return process.env.IDP_CERT.trim();
  }
  const certFile = process.env.IDP_CERT_FILE || "./okta.cert";
  const certPath = path.resolve(__dirname, certFile);
  if (fs.existsSync(certPath)) {
    return fs
      .readFileSync(certPath, "utf8")
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\r?\n/g, "")
      .trim();
  }
  return null;
}

const samlConfig = {
  issuer: process.env.SP_ENTITY_ID || `http://localhost:${PORT}/metadata`,
  callbackUrl: process.env.SP_ACS_URL || `http://localhost:${PORT}/login/callback`,
  entryPoint: process.env.IDP_SSO_URL || "",
  idpCert: resolveIdpCert() || "MISSING_IDP_CERT",
  wantAssertionsSigned: false,
  disableRequestedAuthnContext: true,
};

const samlStrategy = new SamlStrategy(samlConfig, (profile, done) => {
  return done(null, profile);
});

passport.use(samlStrategy);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const isSecureEnv = Boolean(process.env.RENDER) || process.env.NODE_ENV === "production";

const app = express();
app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: isSecureEnv ? { secure: true, sameSite: "none" } : {},
  })
);
app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.redirect("/login");
}

app.get("/", ensureAuthenticated, (req, res) => {
  const user = req.user || {};
  const name = user.nameID || user.email || "SAML User";
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SAML HTML Project</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 80px auto; text-align: center; color: #222; }
    h1 { color: #0b5cab; }
    pre { text-align: left; background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
    a { color: #0b5cab; }
  </style>
</head>
<body>
  <h1>Welcome to SAML HTML Project</h1>
  <p>You are signed in via Okta as <strong>${name}</strong>.</p>
  <pre>${JSON.stringify(user, null, 2)}</pre>
  <p><a href="/logout">Log out</a></p>
</body>
</html>`);
});

app.get("/login", passport.authenticate("saml"));

app.post(
  "/login/callback",
  passport.authenticate("saml", { failureRedirect: "/login/fail" }),
  (req, res) => res.redirect("/")
);

app.get("/login/fail", (req, res) => {
  res.status(401).send("SAML login failed. Check server logs and your IdP configuration.");
});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect("/"));
  });
});

app.get("/metadata", (req, res) => {
  res.type("application/xml");
  res.send(
    generateServiceProviderMetadata({
      issuer: samlConfig.issuer,
      callbackUrl: samlConfig.callbackUrl,
      wantAssertionsSigned: samlConfig.wantAssertionsSigned,
    })
  );
});

app.listen(PORT, () => {
  console.log(`SAML HTML Project running at http://localhost:${PORT}`);
  console.log(`SP metadata:            http://localhost:${PORT}/metadata`);
  console.log(`ACS (callback) URL:      ${samlConfig.callbackUrl}`);
  console.log(`Entity ID (Audience):    ${samlConfig.issuer}`);
});
