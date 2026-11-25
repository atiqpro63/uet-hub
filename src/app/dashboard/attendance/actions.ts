"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireActiveUser() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("department_profiles")
    .select("role, account_status")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.account_status !== "active") redirect("/dashboard");
  return { supabase, userId, role: profile.role };
}

export async function createClassSession(formData: FormData) {
  const { supabase, role } = await requireActiveUser();
  if (!["faculty", "cr", "gr", "admin"].includes(role)) redirect("/dashboard/attendance?error=role");

  const offeringId = String(formData.get("course_offering_id") ?? "");
  const duration = Number(formData.get("duration_minutes") ?? "5");
  if (!/^[0-9a-f-]{36}$/i.test(offeringId)) redirect("/dashboard/attendance?error=course");
  if (!Number.isInteger(duration) || duration < 1 || duration > 15) redirect("/dashboard/attendance?error=session");

  const { data, error } = await supabase.rpc("open_live_attendance", {
    target_offering: offeringId,
    duration_minutes: duration,
  });
  const session = Array.isArray(data) ? data[0] : null;
  if (error || !session?.session_id) redirect("/dashboard/attendance?error=session");

  revalidatePath("/dashboard/attendance");
  redirect(`/dashboard/attendance?created=${session.session_id}`);
}

export async function submitAttendancePin(formData: FormData) {
  const { supabase } = await requireActiveUser();
  const sessionId = String(formData.get("session_id") ?? "");
  const passcode = String(formData.get("passcode") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !/^\d{4}$/.test(passcode)) redirect("/dashboard/attendance?error=pin");
  const { data, error } = await supabase.rpc("submit_attendance_pin", {
    target_session: sessionId,
    entered_pin: passcode,
  });
  if (error || data !== true) redirect("/dashboard/attendance?error=pin");
  revalidatePath("/dashboard/attendance");
  redirect("/dashboard/attendance?pin_saved=1");
}

export async function saveSessionAttendance(formData: FormData) {
  const { supabase, userId, role } = await requireActiveUser();
  if (!["faculty", "cr", "gr", "admin"].includes(role)) redirect("/dashboard/attendance?error=role");

  const sessionId = String(formData.get("session_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) redirect("/dashboard/attendance?error=session");

  const { data: session } = await supabase.from("class_sessions")
    .select("course_offering_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) redirect("/dashboard/attendance?error=session");

  const { data: roster } = await supabase.from("course_enrollments")
    .select("student_id")
    .eq("course_offering_id", session.course_offering_id);
  const rosterIds = new Set((roster ?? []).map((entry) => entry.student_id));
  const validStatuses = new Set(["present", "absent", "late", "excused"]);
  const submitted = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("status:"));
  const rows = submitted.flatMap(([key, value]) => {
      const studentId = key.slice("status:".length);
      const status = String(value);
      if (!/^[0-9a-f-]{36}$/i.test(studentId) || !rosterIds.has(studentId) || !validStatuses.has(status)) return [];
      return [{ session_id: sessionId, student_id: studentId, status, marked_by: userId }];
    });

  if (rows.length === 0) redirect("/dashboard/attendance?error=empty");
  if (rows.length !== rosterIds.size || submitted.length !== rosterIds.size) redirect("/dashboard/attendance?error=incomplete");
  const { error } = await supabase.from("class_attendance").upsert(rows, { onConflict: "session_id,student_id" });
  if (error) redirect("/dashboard/attendance?error=save");

  revalidatePath("/dashboard/attendance");
  redirect("/dashboard/attendance?saved=1");
}
