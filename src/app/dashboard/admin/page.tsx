import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveClassmate, createClassOffering } from "./actions";

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function errorMessage(error: string | undefined) {
  if (error === "course") return "Enter a valid course, term, and section.";
  if (error === "term") return "The academic term could not be saved.";
  if (error === "offering") return "The course section could not be created.";
  if (error === "approval") return "The account could not be approved. Refresh and try again.";
  if (error === "roster") return "This account does not match the saved class roster.";
  if (error === "enrollment") return "The student could not be added to this class section.";
  if (error === "representative") return "That representative role is already assigned, or could not be saved.";
  return null;
}

export default async function AdminPage({ searchParams }: PageProps<"/dashboard/admin">) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) redirect("/login");
  const { data: profile } = await supabase.from("department_profiles")
    .select("role, account_status").eq("id", userId).maybeSingle();
  if (profile?.role !== "admin" || profile.account_status !== "active") redirect("/dashboard");

  const [pendingResult, rosterResult, offeringsResult] = await Promise.all([
    supabase.from("department_profiles")
      .select("id, email, registration_no, full_name, created_at")
      .eq("account_status", "pending").order("created_at", { ascending: true }),
    supabase.from("department_roster").select("registration_no, legacy_role"),
    supabase.from("course_offerings")
      .select("id, section_name, course:department_courses!inner(course_code, title), term:academic_terms!inner(name)")
      .order("section_name"),
  ]);
  const legacyRoleByRegistration = new Map((rosterResult.data ?? []).map((entry) => [entry.registration_no, entry.legacy_role]));
  const flash = errorMessage(typeof params.error === "string" ? params.error : undefined);

  return (
    <section className="dashboard-page">
      <div className="dashboard-header">
        <div><span className="eyebrow"><span className="eyebrow-dot" /> CLASS PILOT ADMIN</span><h1>Set up your class.</h1></div>
        <p>Prepare one course section, then approve classmates against the saved roster.</p>
      </div>
      {params.created === "1" && <p className="notice success-notice" role="status">Course section saved.</p>}
      {params.approved === "1" && <p className="notice success-notice" role="status">Classmate approved and added to the selected section.</p>}
      {flash && <p className="notice error-notice" role="alert">{flash}</p>}

      <article className="course-panel">
        <div className="course-panel-head"><div><span className="eyebrow">STEP 1</span><h2>Create a class section</h2><p>Use the term and course details from your current class.</p></div></div>
        <form action={createClassOffering} className="admin-setup-form">
          <label>Term name<input name="term_name" placeholder="Fall 2026" maxLength={80} required /></label>
          <label>Term starts<input name="starts_on" type="date" required /></label>
          <label>Term ends<input name="ends_on" type="date" required /></label>
          <label>Course code<input name="course_code" placeholder="CS101" maxLength={20} required /></label>
          <label>Course title<input name="course_title" placeholder="Course title" maxLength={120} required /></label>
          <label>Credit hours<input name="credit_hours" type="number" min="0.5" max="6" step="0.5" defaultValue="3" required /></label>
          <label>Section<input name="section_name" placeholder="DS-2026" maxLength={20} required /></label>
          <button className="button button-primary" type="submit">Save course section <span aria-hidden="true">→</span></button>
        </form>
      </article>

      <article className="course-panel">
        <div className="course-panel-head"><div><span className="eyebrow">STEP 2</span><h2>Approve class requests</h2><p>Check each student in person against the saved roster before approving. Email is not used to verify identity in this pilot.</p></div></div>
        {!pendingResult.data?.length ? <p className="empty-inline">No pending requests yet. Students can request access from the sign-in page.</p> : (
          <div className="admin-requests">
            {pendingResult.data.map((student) => {
              const matchRole = student.registration_no ? legacyRoleByRegistration.get(student.registration_no) : null;
              return <form action={approveClassmate} className="admin-request" key={student.id}>
                <input type="hidden" name="student_id" value={student.id} />
                <div className="admin-request-identity">
                  <strong>{student.full_name}</strong>
                  <span>Registration-based account · identity check required</span>
                  <span>{student.registration_no ?? "Does not match the saved roster"}{matchRole ? ` · Previous class role: ${matchRole}` : ""}</span>
                </div>
                <label>Class section<select name="course_offering_id" required defaultValue="">
                  <option value="" disabled>Choose section</option>
                  {(offeringsResult.data ?? []).map((entry) => {
                    const course = one(entry.course);
                    const term = one(entry.term);
                    return <option key={entry.id} value={entry.id}>{course?.course_code} · {entry.section_name} · {term?.name}</option>;
                  })}
                </select></label>
                <label>Portal role<select name="role" defaultValue="student"><option value="student">Student</option><option value="cr">CR</option><option value="gr">GR</option></select></label>
                <button className="button button-primary" type="submit" disabled={!matchRole}>Approve and add <span aria-hidden="true">→</span></button>
              </form>;
            })}
          </div>
        )}
        {!offeringsResult.data?.length && <p className="notice error-notice" role="note">Create at least one course section above before approving students.</p>}
        <p className="admin-footnote">Verify the student face-to-face before approval. UET Hub passwords are separate from LMS passwords. Old passwords and attendance history are not copied into new accounts.</p>
      </article>
    </section>
  );
}
