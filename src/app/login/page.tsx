import Link from "next/link";
import { SignInForm } from "./sign-in-form";
import { RegistrationForm } from "./registration-form";

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
          <p>Students can request class access with their university account. A representative or administrator must match the details against the saved class roster before portal access is approved.</p>
        </div>
        <div className="auth-stack">
          <div className="auth-card">
            <h2>Sign in to UET Hub</h2>
            <p>We’ll send a one-time secure link to your email. No password to remember.</p>
            <SignInForm />
          </div>
          <div className="auth-card registration-card">
            <h2>First time here?</h2>
            <p>Request access with your university email and registration number. A class administrator must confirm your details before class information is available.</p>
            <RegistrationForm />
          </div>
        </div>
      </section>
    </main>
  );
}
