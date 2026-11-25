import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// This authenticated shell reads the user's cookies and profile at request time.
export const instant = false;

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("department_profiles")
    .select("full_name, role, account_status")
    .eq("id", userId)
    .maybeSingle();
  const navigation = [
    ["Overview", "/dashboard"],
    ["Attendance", "/dashboard/attendance"],
    ["Timetable", "/dashboard/timetable"],
    ["Updates", "/dashboard/updates"],
    ["Classwork", "/dashboard/learning"],
    ...(profile?.role === "admin" ? [["Class setup", "/dashboard/admin"]] : []),
  ];

  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard" aria-label="UET Hub dashboard">
          <span className="brand-mark">U</span>
          <span className="brand-name">UET<span>HUB</span></span>
        </Link>
        {profile?.account_status === "active" ? (
          <nav className="topnav dashboard-nav" aria-label="Department portal">
            {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
        ) : <span className="access-note">DEPARTMENT PORTAL</span>}
        <form action="/auth/sign-out" method="post" className="signout-form">
          <button type="submit">Sign out ↗</button>
        </form>
      </header>

      {profile?.account_status === "active" ? (
        <div className="portal-identity">
          <span>{profile.full_name}</span>
          <span className="identity-role">{profile.role}</span>
        </div>
      ) : (
        <section className="dashboard-page">
          <div className="pending-card">
            <span className="eyebrow"><span className="eyebrow-dot" /> ACCESS REVIEW</span>
            <h1>Your account is awaiting approval.</h1>
            <p>A department administrator must confirm your identity and course roster before portal information is available.</p>
            <p>If you believe this is a mistake, contact your department office.</p>
          </div>
        </section>
      )}

      {profile?.account_status === "active" ? children : null}
      <footer className="footer">
        <Link className="brand" href="/dashboard"><span className="brand-mark">U</span><span className="brand-name">UET<span>HUB</span></span></Link>
        <span>Department academic operations</span>
        <span className="identity-role">Private department access</span>
      </footer>
    </main>
  );
}
