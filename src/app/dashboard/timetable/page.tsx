import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const dayNames: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday",
};

export default async function TimetablePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) return null;

  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("id, day_of_week, starts_at, ends_at, room, offering:course_offerings!inner(section_name, course:department_courses!inner(course_code, title))")
    .order("day_of_week")
    .order("starts_at");

  return (
    <section className="dashboard-page">
      <div className="dashboard-header"><div><span className="eyebrow"><span className="eyebrow-dot" /> CLASS SCHEDULE</span><h1>Your timetable.</h1></div><p>Classes assigned to your active course roster</p></div>
      {slots?.length ? (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Day</th><th>Time</th><th>Course</th><th>Section</th><th>Room</th></tr></thead>
          <tbody>{slots.map((slot) => {
            const offering = one(slot.offering);
            const course = one(offering?.course);
            return <tr key={slot.id}><td>{dayNames[slot.day_of_week] ?? "Day"}</td><td>{slot.starts_at.slice(0, 5)} – {slot.ends_at.slice(0, 5)}</td><td>{course?.course_code} · {course?.title}</td><td>{offering?.section_name}</td><td>{slot.room}</td></tr>;
          })}</tbody>
        </table></div>
      ) : <div className="empty-state"><span className="empty-icon">▦</span><h2>No timetable published</h2><p>Your schedule will appear once the department administrator assigns your course section.</p></div>}
    </section>
  );
}
