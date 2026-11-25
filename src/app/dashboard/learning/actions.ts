"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const idPattern = /^[0-9a-f-]{36}$/i;
const staffRoles = ["faculty", "cr", "gr", "admin"];

async function activeAccount() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) redirect("/login");
  const { data: profile } = await supabase.from("department_profiles")
    .select("role, account_status").eq("id", userId).maybeSingle();
  if (profile?.account_status !== "active") redirect("/dashboard");
  return { supabase, userId, role: profile.role };
}

export async function createAssignment(formData: FormData) {
  const { supabase, userId, role } = await activeAccount();
  if (!staffRoles.includes(role)) redirect("/dashboard/learning?error=role");
  const offeringId = String(formData.get("course_offering_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const dueValue = String(formData.get("due_at") ?? "");
  const dueAt = dueValue ? new Date(`${dueValue}+05:00`) : null;
  if (!idPattern.test(offeringId) || !title || title.length > 160 || instructions.length > 12000 || (dueValue && (!dueAt || Number.isNaN(dueAt.valueOf())))) {
    redirect("/dashboard/learning?error=assignment");
  }
  const { error } = await supabase.from("course_assignments").insert({
    course_offering_id: offeringId,
    title,
    instructions,
    due_at: dueAt?.toISOString() ?? null,
    created_by: userId,
  });
  if (error) redirect("/dashboard/learning?error=save");
  revalidatePath("/dashboard/learning");
  redirect("/dashboard/learning?posted=assignment");
}

export async function submitAssignment(formData: FormData) {
  const { supabase, userId } = await activeAccount();
  const assignmentId = String(formData.get("assignment_id") ?? "");
  const responseText = String(formData.get("response_text") ?? "").trim();
  const rawUrl = String(formData.get("submission_url") ?? "").trim();
  let submissionUrl: string | null = null;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("scheme");
      submissionUrl = parsed.toString();
    } catch {
      redirect("/dashboard/learning?error=url");
    }
  }
  if (!idPattern.test(assignmentId) || responseText.length < 1 || responseText.length > 12000 || (submissionUrl && submissionUrl.length > 2048)) {
    redirect("/dashboard/learning?error=submission");
  }
  const { error } = await supabase.from("course_assignment_submissions").upsert({
    assignment_id: assignmentId,
    student_id: userId,
    response_text: responseText,
    submission_url: submissionUrl,
  }, { onConflict: "assignment_id,student_id" });
  if (error) redirect("/dashboard/learning?error=late");
  revalidatePath("/dashboard/learning");
  redirect("/dashboard/learning?posted=submission");
}

export async function gradeAssignment(formData: FormData) {
  const { supabase, userId, role } = await activeAccount();
  if (!['faculty', 'admin'].includes(role)) redirect("/dashboard/learning?error=role");
  const submissionId = String(formData.get("submission_id") ?? "");
  const score = Number(formData.get("score"));
  const outOf = Number(formData.get("out_of"));
  const feedback = String(formData.get("feedback") ?? "").trim();
  if (!idPattern.test(submissionId) || !Number.isFinite(score) || !Number.isFinite(outOf) || outOf <= 0 || score < 0 || score > outOf || feedback.length > 4000) {
    redirect("/dashboard/learning?error=grade");
  }
  const { error } = await supabase.from("course_assignment_grades").upsert({
    submission_id: submissionId,
    score,
    out_of: outOf,
    feedback,
    graded_by: userId,
  }, { onConflict: "submission_id" });
  if (error) redirect("/dashboard/learning?error=grade");
  revalidatePath("/dashboard/learning");
  redirect("/dashboard/learning?posted=grade");
}

export async function createQuiz(formData: FormData) {
  const { supabase, userId, role } = await activeAccount();
  if (!staffRoles.includes(role)) redirect("/dashboard/learning?error=role");
  const offeringId = String(formData.get("course_offering_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const opensAt = new Date(`${String(formData.get("opens_at") ?? "")}+05:00`);
  const closesAt = new Date(`${String(formData.get("closes_at") ?? "")}+05:00`);
  const lines = String(formData.get("questions") ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsedQuestions = lines.map((line) => {
    const fields = line.split("|").map((part) => part.trim());
    const prompt = fields.shift() ?? "";
    const answerText = fields.pop() ?? "";
    const options = fields;
    const correctOption = Number(answerText) - 1;
    if (!prompt || prompt.length > 2000 || options.length < 2 || options.length > 6 || options.some((option) => !option || option.length > 400) || !/^\d+$/.test(answerText) || correctOption < 0 || correctOption >= options.length) return null;
    return { prompt, options, correctOption };
  });
  if (!idPattern.test(offeringId) || !title || title.length > 160 || instructions.length > 4000 || Number.isNaN(opensAt.valueOf()) || Number.isNaN(closesAt.valueOf()) || closesAt <= opensAt || parsedQuestions.length < 1 || parsedQuestions.length > 30 || parsedQuestions.some((question) => question === null)) {
    redirect("/dashboard/learning?error=quiz");
  }

  const { data: quiz, error: quizError } = await supabase.from("course_quizzes").insert({
    course_offering_id: offeringId,
    title,
    instructions,
    opens_at: opensAt.toISOString(),
    closes_at: closesAt.toISOString(),
    created_by: userId,
  }).select("id").single();
  if (quizError || !quiz) redirect("/dashboard/learning?error=save");

  for (let index = 0; index < parsedQuestions.length; index += 1) {
    const question = parsedQuestions[index];
    if (!question) continue;
    const { data: createdQuestion, error: questionError } = await supabase.from("course_quiz_questions")
      .insert({ quiz_id: quiz.id, prompt: question.prompt, options: question.options, sort_order: index + 1 })
      .select("id").single();
    if (questionError || !createdQuestion) {
      await supabase.from("course_quizzes").delete().eq("id", quiz.id);
      redirect("/dashboard/learning?error=save");
    }
    const { error: answerError } = await supabase.from("course_quiz_answer_keys")
      .insert({ question_id: createdQuestion.id, correct_option: question.correctOption });
    if (answerError) {
      await supabase.from("course_quizzes").delete().eq("id", quiz.id);
      redirect("/dashboard/learning?error=save");
    }
  }
  revalidatePath("/dashboard/learning");
  redirect("/dashboard/learning?posted=quiz");
}

export async function submitQuiz(formData: FormData) {
  const { supabase } = await activeAccount();
  const quizId = String(formData.get("quiz_id") ?? "");
  if (!idPattern.test(quizId)) redirect("/dashboard/learning?error=quiz");

  const answers: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer:")) continue;
    const questionId = key.slice("answer:".length);
    const choice = String(value);
    if (!idPattern.test(questionId) || !/^\d$/.test(choice)) redirect("/dashboard/learning?error=quiz");
    answers[questionId] = Number(choice);
  }
  const { data, error } = await supabase.rpc("submit_course_quiz", {
    target_quiz: quizId,
    submitted_answers: answers,
  });
  if (error || !data?.[0]) redirect("/dashboard/learning?error=quizsubmit");
  revalidatePath("/dashboard/learning");
  redirect(`/dashboard/learning?score=${data[0].score}&total=${data[0].max_score}`);
}
