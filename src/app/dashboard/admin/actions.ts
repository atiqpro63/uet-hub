"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdministrator() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) redirect("/login");
  const { data: profile } = await supabase.from("department_profiles")
    .select("role, account_status").eq("id", userId).maybeSingle();
  if (profile?.role !== "admin" || profile.account_status !== "active") redirect("/dashboard");
  return { supabase, userId };
}

export async function createClassOffering(formData: FormData) {
  const { supabase } = await requireAdministrator();
  const termName = String(formData.get("term_name") ?? "").trim();
  const startsOn = String(formData.get("starts_on") ?? "");
  const endsOn = String(formData.get("ends_on") ?? "");
  const courseCode = String(formData.get("course_code") ?? "").trim().toUpperCase();
  const courseTitle = String(formData.get("course_title") ?? "").trim();
  const creditHours = Number(formData.get("credit_hours"));
  const sectionName = String(formData.get("section_name") ?? "").trim().toUpperCase();
  if (!termName || termName.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || endsOn < startsOn || !/^[A-Z0-9-]{2,20}$/.test(courseCode) || !courseTitle || courseTitle.length > 120 || !Number.isFinite(creditHours) || creditHours < 0.5 || creditHours > 6 || !sectionName || sectionName.length > 20) {
    redirect("/dashboard/admin?error=course");
  }

  const { data: term, error: termError } = await supabase.from("academic_terms")
    .upsert({ name: termName, starts_on: startsOn, ends_on: endsOn, is_current: true }, { onConflict: "name" })
    .select("id").single();
  if (termError || !term) redirect("/dashboard/admin?error=term");

  const { data: course, error: courseError } = await supabase.from("department_courses")
    .upsert({ course_code: courseCode, title: courseTitle, credit_hours: creditHours, is_active: true }, { onConflict: "course_code" })
    .select("id").single();
  if (courseError || !course) redirect("/dashboard/admin?error=course");

  const { error: offeringError } = await supabase.from("course_offerings")
    .upsert({ course_id: course.id, term_id: term.id, section_name: sectionName }, { onConflict: "course_id,term_id,section_name", ignoreDuplicates: true });
  if (offeringError) redirect("/dashboard/admin?error=offering");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/timetable");
  redirect("/dashboard/admin?created=1");
}

export async function approveClassmate(formData: FormData) {
  const { supabase } = await requireAdministrator();
  const studentId = String(formData.get("student_id") ?? "");
  const offeringId = String(formData.get("course_offering_id") ?? "");
  const requestedRole = String(formData.get("role") ?? "student");
  if (!/^[0-9a-f-]{36}$/i.test(studentId) || !/^[0-9a-f-]{36}$/i.test(offeringId) || !["student", "cr", "gr"].includes(requestedRole)) {
    redirect("/dashboard/admin?error=approval");
  }

  const { data: pending } = await supabase.from("department_profiles")
    .select("id, email, registration_no, account_status")
    .eq("id", studentId).maybeSingle();
  if (!pending || pending.account_status !== "pending" || !pending.email || !pending.registration_no) redirect("/dashboard/admin?error=roster");

  const { data: rosterMatch } = await supabase.from("department_roster")
    .select("registration_no")
    .eq("registration_no", pending.registration_no)
    .eq("university_email", pending.email)
    .maybeSingle();
  if (!rosterMatch) redirect("/dashboard/admin?error=roster");

  const { data: offering } = await supabase.from("course_offerings")
    .select("id, cr_id, gr_id").eq("id", offeringId).maybeSingle();
  if (!offering) redirect("/dashboard/admin?error=offering");

  const representativeField = requestedRole === "cr" ? "cr_id" : requestedRole === "gr" ? "gr_id" : null;
  const assignedRepresentative = representativeField ? offering[representativeField] : null;
  if (assignedRepresentative && assignedRepresentative !== studentId) redirect("/dashboard/admin?error=representative");

  const { error: enrollmentError } = await supabase.from("course_enrollments")
    .upsert({ course_offering_id: offeringId, student_id: studentId }, { onConflict: "course_offering_id,student_id" });
  if (enrollmentError) redirect("/dashboard/admin?error=enrollment");

  if (requestedRole === "cr" || requestedRole === "gr") {
    const representativeField = requestedRole === "cr" ? "cr_id" : "gr_id";
    const { error: assignmentError } = await supabase.from("course_offerings")
      .update({ [representativeField]: studentId }).eq("id", offeringId);
    if (assignmentError) redirect("/dashboard/admin?error=representative");
  }

  const { error: profileError } = await supabase.from("department_profiles")
    .update({ role: requestedRole, account_status: "active" }).eq("id", studentId);
  if (profileError) redirect("/dashboard/admin?error=approval");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/timetable");
  redirect("/dashboard/admin?approved=1");
}
