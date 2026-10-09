// Public pricing is hidden site-wide for now. Prices are stored in the DB and
// only revealed to prospects via a personalised link (Phase E /start).
export const PUBLIC_PRICING = false;

const clean = (v) => (v && v !== "#" ? v : "");
export const CALENDLY_URL = clean(process.env.REACT_APP_CALENDLY_URL);
export const STRIPE_DEPOSIT_URL = clean(process.env.REACT_APP_STRIPE_DEPOSIT_URL);

// ⚠️ DEV/TESTING ONLY — auto-login as admin so you skip the login screen.
// SET THIS TO false BEFORE GO-LIVE. It is additionally hard-guarded in
// AuthContext to only ever run on the *.preview.* host, never on a deployed domain.
export const DEV_AUTOLOGIN_ENABLED = true;
export const DEV_ADMIN = { email: "andrew.phan723@gmail.com", password: "WinnieAdmin2026!" };

const aud = (cents) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format((cents || 0) / 100);

export function formatAud(cents) {
  return aud(cents);
}

// Total payable in cents. ex GST packages add 10 percent. Same figure servicePrice shows large.
export function incGstCents(pkg) {
  const cents = pkg?.price_cents || 0;
  if (pkg?.gst_treatment === "ex_gst") return cents + Math.round(cents * 0.1);
  return cents;
}

// GST-aware price display for coaching packages.
export function servicePrice(pkg) {
  const cents = pkg?.price_cents || 0;
  const total = incGstCents(pkg);
  if (pkg?.gst_treatment === "ex_gst") {
    return { main: `${aud(total)} inc GST`, sub: `(${aud(cents)} + ${aud(total - cents)} GST)` };
  }
  return { main: `${aud(total)} inc GST`, sub: "" };
}
