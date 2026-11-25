import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Attendance",
    text: "Class sessions and attendance records, managed by approved department representatives.",
    icon: "◷",
  },
  {
    number: "02",
    title: "Timetable",
    text: "A clear view of the classes, rooms, and instructors assigned to your section.",
    icon: "▦",
  },
  {
    number: "03",
    title: "Department updates",
    text: "Course notices, deadlines, and shared study resources in one place.",
    icon: "↗",
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="UET Hub home">
          <span className="brand-mark">U</span>
          <span className="brand-name">UET<span>HUB</span></span>
        </Link>
        <nav className="topnav" aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <Link className="button button-quiet topbar-login" href="/login">Sign in <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="hero" id="platform">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> DEPARTMENT ACADEMIC PORTAL</div>
          <h1>Your department,<br /><em>in sync.</em></h1>
          <p className="hero-description">
            A shared home for classes, attendance, and department updates.
            Built for students, faculty, and representatives to stay on the same page.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/login">Open UET Hub <span aria-hidden="true">→</span></Link>
            <span className="access-note"><span className="lock-icon">▣</span> Approved department accounts</span>
          </div>
          <div className="hero-footnote"><span className="line" /> ACADEMIC OPERATIONS · ONE PORTAL</div>
        </div>

        <div className="hero-visual" aria-label="UET Hub portal preview">
          <div className="visual-glow" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="portal-card">
            <div className="portal-card-head">
              <div className="portal-card-brand"><span className="mini-mark">U</span><span>UET Hub</span></div>
              <span className="portal-status"><i /> DEPARTMENT PORTAL</span>
            </div>
            <div className="portal-welcome">
              <span className="portal-kicker">YOUR ACADEMIC DAY</span>
              <h2>Everything<br />in its place.</h2>
              <p>Attendance, classes, and updates<br />for your department.</p>
            </div>
            <div className="portal-divider" />
            <div className="portal-row">
              <div className="portal-row-icon attendance-icon">◷</div>
              <div><strong>Class attendance</strong><span>Recorded by your class team</span></div>
              <span className="row-arrow">↗</span>
            </div>
            <div className="portal-row">
              <div className="portal-row-icon schedule-icon">▦</div>
              <div><strong>Timetable & updates</strong><span>Keep up with what’s next</span></div>
              <span className="row-arrow">↗</span>
            </div>
            <div className="portal-card-bottom"><span>UET DEPARTMENT</span><span>EST. FOR LEARNING <b>✳</b></span></div>
          </div>
          <div className="visual-caption"><span>01</span> / ACADEMIC OPERATIONS, CONNECTED</div>
        </div>
      </section>

      <section className="platform-section" id="how-it-works">
        <div className="section-heading">
          <div><span className="eyebrow">MADE FOR THE WHOLE DEPARTMENT</span><h2>Less chasing.<br /><em>More clarity.</em></h2></div>
          <p>One dependable place for the information your department uses every day. Access is tied to approved accounts and course assignments.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <div className="feature-card-top"><span>{feature.number}</span><span className="feature-icon">{feature.icon}</span></div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
              <div className="feature-rule" />
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <Link className="brand" href="/">
          <span className="brand-mark">U</span>
          <span className="brand-name">UET<span>HUB</span></span>
        </Link>
        <span>Department academic operations</span>
        <Link href="/login">Department sign in <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
