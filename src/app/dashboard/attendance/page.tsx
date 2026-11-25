import { createClient } from "@/lib/supabase/server";
import { createClassSession, saveSessionAttendance } from "./actions";

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function messageFor(error: string | undefined) {
  if (error === "session") return "Could not open the class session. Check that you are assigned to this course.";
  if (error === "save") return "Attendance could not be saved. Your course assignment may have changed.";
  if (error === "role") return "Only assigned course staff can record attendance.";
  if (error === "empty") return "No attendance rows were submitted.";
  if (error === "incomplete") return "Choose a status for every student on the approved roster before saving.";
  return null;
}

export default async function AttendancePage({ searchParams }: PageProps<"/dashboard/attendance">) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("department_profiles")
    .select("role, account_status")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.account_status !== "active") return null;

  const flash = messageFor(typeof params.error === "string" ? params.error : undefined);
  const isStaff = ["faculty", "cr", "gr", "admin"].includes(profile.role);

  if (!isStaff) {
    const { data: records } = await supabase
      .from("class_attendance")
      .select("id, status, marked_at, session:class_sessions!inner(session_date, offering:course_offerings!inner(section_name, course:department_courses!inner(course_code, title)))")
      .eq("student_id", userId)
      .order("marked_at", { ascending: false });

    return (
      <section className="dashboard-page">
        <div className="dashboard-header">
          <div><span className="eyebrow"><span className="eyebrow-dot" /> ATTENDANCE LEDGER</span><h1>Your attendance.</h1></div>
          <p>Records entered by your assigned course staff</p>
        </div>
        {records?.length ? (
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Course</th><th>Section</th><th>Class date</th><th>Status</th></tr></thead>
            <tbody>{records.map((record) => {
              const session = one(record.session);
              const offering = one(session?.offering);
              const course = one(offering?.course);
              return <tr key={record.id}><td>{course?.course_code} · {course?.title}</td><td>{offering?.section_name}</td><td>{session?.session_date}</td><td><span className={`status-pill status-${record.status}`}>{record.status}</span></td></tr>;
            })}</tbody>
          </table></div>
        ) : <div className="empty-state"><span className="empty-icon">◷</span><h2>No attendance records yet</h2><p>Your course staff will add class records after the roster is set up.</p></div>}
      </section>
    );
  }

  const { data: offerings } = await supabase
    .from("course_offerings")
    .select("id, section_name, course:department_courses!inner(course_code, title)")
    .order("section_name");

  const courseSections = await Promise.all((offerings ?? []).map(async (offering) => {
    const [rosterResult, sessionsResult] = await Promise.all([
      supabase.from("course_enrollments")
        .select("student_id, student:department_profiles!course_enrollments_student_id_fkey(registration_no, full_name)")
        .eq("course_offering_id", offering.id),
      supabase.from("class_sessions")
        .select("id, session_date, starts_at")
        .eq("course_offering_id", offering.id)
        .order("session_date", { ascending: false }),
    ]);
    const sessions = await Promise.all((sessionsResult.data ?? []).map(async (session) => {
      const { data: marks } = await supabase.from("class_attendance")
        .select("student_id, status")
        .eq("session_id", session.id);
      return { ...session, marks: marks ?? [] };
    }));
    return { ...offering, roster: rosterResult.data ?? [], sessions };
  }));

  return (
    <section className="dashboard-page">
      <div className="dashboard-header">
        <div><span className="eyebrow"><span className="eyebrow-dot" /> COURSE STAFF</span><h1>Take attendance.</h1></div>
        <p>Open a class session, then record each enrolled student.</p>
      </div>
      {params.created === "1" && <p className="notice success-notice" role="status">Class session opened. Record the roll below.</p>}
      {params.saved === "1" && <p className="notice success-notice" role="status">Attendance saved for this session.</p>}
      {flash && <p className="notice error-notice" role="alert">{flash}</p>}

      {courseSections.length ? courseSections.map((offering) => {
        const course = one(offering.course);
        return (
          <article className="course-panel" key={offering.id}>
            <div className="course-panel-head">
              <div><span className="eyebrow">{course?.course_code} · SECTION {offering.section_name}</span><h2>{course?.title}</h2><p>{offering.roster.length} approved students on the roster</p></div>
              <form action={createClassSession}>
                <input type="hidden" name="course_offering_id" value={offering.id} />
                <button className="button button-primary" type="submit">Open today’s session <span aria-hidden="true">+</span></button>
              </form>
            </div>

            {offering.sessions.length ? offering.sessions.map((session) => {
              const existingMarks = new Map(session.marks.map((mark) => [mark.student_id, mark.status]));
              return (
                <form action={saveSessionAttendance} className="session-form" key={session.id}>
                  <div className="session-heading"><div><span className="eyebrow">CLASS SESSION</span><h3>{session.session_date}</h3></div><span className="session-count">{session.marks.length} marked</span></div>
                  <input type="hidden" name="session_id" value={session.id} />
                  {offering.roster.length ? (
                    <div className="roster-list">
                      {offering.roster.map((entry) => {
                        const student = one(entry.student);
                        return <label className="roster-row" key={entry.student_id}>
                          <span><strong>{student?.full_name ?? "Student"}</strong><small>{student?.registration_no ?? "Registration pending"}</small></span>
                          <select name={`status:${entry.student_id}`} defaultValue={existingMarks.get(entry.student_id) ?? ""} required aria-label={`Attendance status for ${student?.full_name ?? "student"}`}>
                            <option value="" disabled>Choose status</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option>
                          </select>
                        </label>;
                      })}
                    </div>
                  ) : <p className="empty-inline">The administrator has not loaded the student roster for this section.</p>}
                  {offering.roster.length > 0 && <button className="button button-primary save-attendance" type="submit">Save attendance <span aria-hidden="true">→</span></button>}
                </form>
              );
            }) : <div className="empty-inline session-empty">No class session has been opened for this section today.</div>}
          </article>
        );
      }) : <div className="empty-state"><span className="empty-icon">▦</span><h2>No assigned course sections</h2><p>When an administrator assigns your course sections and roster, attendance actions will appear here.</p></div>}
    </section>
  );
}
