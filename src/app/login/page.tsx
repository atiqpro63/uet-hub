import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export default function LoginPage() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="UET Hub home">
          <span className="brand-mark">U</span>
          <span className="brand-name">UET<span>HUB</span></span>
        </Link>
        <Link className="button button-quiet topbar-login" href="/">Back to home <span aria-hidden="true">↗</span></Link>
      </header>
      <section className="auth-page">
        <div className="auth-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> DEPARTMENT ACCESS</span>
          <h1>Welcome back<br />to your <em>department.</em></h1>
          <p>Sign in with the university email connected to your approved department account. New registrations and representative roles are managed by the department.</p>
        </div>
        <div className="auth-card">
          <h2>Sign in to UET Hub</h2>
          <p>We’ll send a one-time secure link to your email. No password to remember.</p>
          <SignInForm />
        </div>
      </section>
    </main>
  );
}
