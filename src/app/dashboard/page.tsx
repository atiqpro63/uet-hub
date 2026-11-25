import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("department_profiles")
    .select("full_name, registration_no, role")
    .eq("id", userId)
    .maybeSingle();
  const { data: offerings } = await supabase
    .from("course_offerings")
    .select("id, section_name, course:department_courses(course_code, title)");

  const courseCount = offerings?.length ?? 0;

  return (
    <section className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> YOUR DEPARTMENT HUB</span>
          <h1>Welcome, {profile?.full_name?.split(" ")[0] ?? "there"}.</h1>
        </div>
        <p>{profile?.registration_no ?? "Department account"} · {profile?.role ?? "Member"}</p>
      </div>
      <div className="dashboard-grid">
        <Link className="dashboard-tile" href="/dashboard/attendance">
          <span>01 / ATTENDANCE</span>
          <h2>Class attendance</h2>
          <p>View your attendance or record the class roll for an assigned section.</p>
        </Link>
        <Link className="dashboard-tile" href="/dashboard/timetable">
          <span>02 / SCHEDULE</span>
          <h2>Timetable</h2>
          <p>See your scheduled classes, instructors, and rooms.</p>
        </Link>
        <Link className="dashboard-tile" href="/dashboard/updates">
          <span>03 / DEPARTMENT</span>
          <h2>Updates & resources</h2>
          <p>Find course announcements and shared learning materials.</p>
        </Link>
      <Link className="dashboard-tile" href="/dashboard/learning">
        <span>04 / CLASSWORK</span>
        <h2>Assignments & quizzes</h2>
        <p>Post course work, submit responses, and take class quizzes.</p>
      </Link>
      </div>
      <p className="dashboard-note">{courseCount > 0 ? `${courseCount} course section${courseCount === 1 ? "" : "s"} available to your account.` : "Your course sections will appear here after the department administrator loads the approved roster."}</p>
    </section>
  );
}
