import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function UpdatesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) return null;

  const [announcementResult, resourceResult] = await Promise.all([
    supabase.from("department_announcements")
      .select("id, title, body, published_at, offering:course_offerings(section_name, course:department_courses(course_code, title))")
      .order("published_at", { ascending: false }),
    supabase.from("department_resources")
      .select("id, title, resource_type, resource_url, created_at, offering:course_offerings(section_name, course:department_courses(course_code, title))")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <section className="dashboard-page">
      <div className="dashboard-header"><div><span className="eyebrow"><span className="eyebrow-dot" /> DEPARTMENT BOARD</span><h1>Updates & resources.</h1></div><p>Notices and course material shared with your account</p></div>
      <div className="updates-columns">
        <section className="updates-column"><h2>Announcements</h2>
          {announcementResult.data?.length ? announcementResult.data.map((item) => {
            const offering = one(item.offering);
            const course = one(offering?.course);
            return <article className="update-card" key={item.id}><span className="eyebrow">{course ? `${course.course_code} · ${offering?.section_name}` : "DEPARTMENT NOTICE"}</span><h3>{item.title}</h3><p>{item.body}</p><small>{new Date(item.published_at).toLocaleDateString("en-PK", { dateStyle: "medium" })}</small></article>;
          }) : <div className="empty-inline">No current announcements.</div>}
        </section>
        <section className="updates-column"><h2>Study materials</h2>
          {resourceResult.data?.length ? resourceResult.data.map((item) => {
            const offering = one(item.offering);
            const course = one(offering?.course);
            return <article className="resource-card" key={item.id}><div><span className="eyebrow">{item.resource_type}</span><h3>{item.title}</h3><p>{course ? `${course.course_code} · ${offering?.section_name}` : "Department resource"}</p></div><Link href={item.resource_url} target="_blank" rel="noreferrer">Open ↗</Link></article>;
          }) : <div className="empty-inline">No study materials have been posted yet.</div>}
        </section>
      </div>
    </section>
  );
}
