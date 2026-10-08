import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const Shell = ({ title, sub, children, footer }) => (
  <div className="min-h-[80vh] grid grid-cols-1 lg:grid-cols-12" data-testid="auth-page">
    <div className="hidden lg:flex lg:col-span-5 bg-[#0A192F] text-white p-16 flex-col justify-between relative grain">
      <div className="font-serif text-xl tracking-[0.25em] text-amber-400 relative z-10">WINNIE HOU</div>
      <div className="relative z-10">
        <blockquote className="font-serif text-3xl leading-snug italic">"Fluency isn't knowing more words. It's knowing which ones carry weight."</blockquote>
        <div className="text-sm text-slate-400 mt-6">— Winnie Hou</div>
      </div>
      <div className="text-xs text-slate-500 relative z-10">Business English Mastery</div>
    </div>
    <div className="lg:col-span-7 flex items-center justify-center p-8">
      <div className="w-full max-w-md rise">
        <h1 className="font-serif text-4xl text-[#0A192F]">{title}</h1>
        <p className="text-slate-500 mt-2 text-sm">{sub}</p>
        <div className="mt-8 space-y-4">{children}</div>
        <div className="mt-8 text-sm text-slate-500">{footer}</div>
      </div>
    </div>
  </div>
);

const Field = ({ label, testId, ...props }) => (
  <div><label className="label-lux">{label}</label><input className="input-lux" data-testid={testId} {...props} /></div>
);

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const u = await login(f.email, f.password); nav(params.get("next") || (u.role === "admin" ? "/admin" : "/dashboard")); }
    catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Welcome back" sub="Sign in to continue your learning."
      footer={<>New here? <Link to={`/register${params.get("next") ? `?next=${params.get("next")}` : ""}`} className="text-amber-700 font-medium" data-testid="go-register-link">Create an account</Link> · <Link to="/forgot-password" className="text-slate-600 hover:text-amber-700" data-testid="forgot-link">Forgot password?</Link></>}>
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <Field label="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} testId="login-email" />
        <Field label="Password" type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} testId="login-password" />
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="login-error">{err}</div>}
        <button disabled={busy} className="btn-gold w-full disabled:opacity-60" data-testid="login-submit">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await register(f.name, f.email, f.password); nav(params.get("next") || "/dashboard"); }
    catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Create your account" sub="Lifetime access to every course you buy."
      footer={<>Already a student? <Link to="/login" className="text-amber-700 font-medium" data-testid="go-login-link">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" data-testid="register-form">
        <Field label="Full name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} testId="register-name" />
        <Field label="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} testId="register-email" />
        <Field label="Password (min. 8 characters)" type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} testId="register-password" />
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="register-error">{err}</div>}
        <button disabled={busy} className="btn-gold w-full disabled:opacity-60" data-testid="register-submit">{busy ? "Creating…" : "Create account"}</button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post("/auth/forgot-password", { email, origin_url: window.location.origin }); setSent(true); }
    catch (ex) { toast.error(errMsg(ex)); }
  };
  return (
    <Shell title="Reset your password" sub="We'll email you a secure link." footer={<Link to="/login" className="text-amber-700 font-medium">Back to sign in</Link>}>
      {sent ? <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-4 text-sm" data-testid="forgot-sent">If that email exists, a reset link is on its way.</div> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} testId="forgot-email" />
          <button className="btn-gold w-full" data-testid="forgot-submit">Send reset link</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post("/auth/reset-password", { token: params.get("token"), password }); toast.success("Password updated. Please sign in."); nav("/login"); }
    catch (ex) { toast.error(errMsg(ex)); }
  };
  return (
    <Shell title="Choose a new password" sub="At least 8 characters." footer={null}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} testId="reset-password" />
        <button className="btn-gold w-full" data-testid="reset-submit">Update password</button>
      </form>
    </Shell>
  );
}
