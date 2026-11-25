import { createClient } from "@/lib/supabase/server";
import { createAssignment, createQuiz, gradeAssignment, submitAssignment, submitQuiz } from "./actions";

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
function list<T>(value: T[] | null | undefined): T[] {
  return value ?? [];
}

function messageFor(error: string | undefined) {
  if (error === "role") return "This account does not have permission to do that.";
  if (error === "assignment") return "Check the assignment title, instructions, and due date.";
  if (error === "quiz") return "Check the quiz dates and question format. Use one question per line: Question | option 1 | option 2 | correct option number.";
  if (error === "url") return "Use a full web link beginning with https:// or http://.";
  if (error === "submission") return "Write a response of up to 12,000 characters before submitting.";
  if (error === "late") return "Your response could not be saved. The deadline may have passed, or you may not be enrolled in this course.";
  if (error === "quizsubmit") return "This quiz could not be submitted. It may have closed, or an attempt may already have been used.";
  if (error === "save") return "Your classwork could not be saved. Refresh and check your course access.";
  if (error === "grade") return "Enter a valid score and maximum mark, then try saving the feedback again.";
  return null;
}

function localDate(value: string) {
  return new Date(value).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  });
}

export default async function LearningPage({ searchParams }: PageProps<"/dashboard/learning">) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = typeof auth?.claims?.sub === "string" ? auth.claims.sub : null;
  if (!userId) return null;

  const { data: profile } = await supabase.from("department_profiles")
    .select("role, account_status").eq("id", userId).maybeSingle();
  if (profile?.account_status !== "active") return null;
  const isStaff = ["faculty", "cr", "gr", "admin"].includes(profile.role);
  const { data: enrollments } = await supabase.from("course_enrollments")
    .select("course_offering_id").eq("student_id", userId);
  const enrolledOfferingIds = new Set((enrollments ?? []).map((entry) => entry.course_offering_id));

  const { data: offerings } = await supabase.from("course_offerings")
    .select("id, section_name, course:department_courses!inner(course_code, title), assignments:course_assignments(id, title, instructions, due_at, submissions:course_assignment_submissions(id, student_id, response_text, submission_url, submitted_at, student:department_profiles!course_assignment_submissions_student_id_fkey(full_name, registration_no), grade:course_assignment_grades(submission_id, score, out_of, feedback, graded_at))), quizzes:course_quizzes(id, title, instructions, opens_at, closes_at, questions:course_quiz_questions(id, prompt, options, sort_order), attempts:course_quiz_attempts(id, student_id, score, max_score, submitted_at, student:department_profiles!course_quiz_attempts_student_id_fkey(full_name, registration_no)))")
    .order("section_name");

  const flash = messageFor(typeof params.error === "string" ? params.error : undefined);
  const score = typeof params.score === "string" && /^\d+$/.test(params.score) ? params.score : null;
  const total = typeof params.total === "string" && /^\d+$/.test(params.total) ? params.total : null;

  return (
    <section className="dashboard-page">
      <div className="dashboard-header">
        <div><span className="eyebrow"><span className="eyebrow-dot" /> COURSE WORK</span><h1>Assignments & quizzes.</h1></div>
        <p>Class tasks and short quizzes for your approved course sections</p>
      </div>
      {flash && <p className="notice error-notice" role="alert">{flash}</p>}
      {params.posted === "assignment" && <p className="notice success-notice" role="status">Assignment posted.</p>}
      {params.posted === "quiz" && <p className="notice success-notice" role="status">Quiz posted. Students can take it during the quiz window.</p>}
      {params.posted === "submission" && <p className="notice success-notice" role="status">Your assignment response was submitted.</p>}
      {params.posted === "grade" && <p className="notice success-notice" role="status">Assignment score and feedback saved.</p>}
      {score && total && <p className="notice success-notice" role="status">Quiz result: {score} out of {total} correct.</p>}

      {list(offerings).map((offering) => {
        const course = one(offering.course);
        const assignments = list(offering.assignments).sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"));
        const quizzes = list(offering.quizzes).sort((a, b) => a.opens_at.localeCompare(b.opens_at));
        const canParticipate = enrolledOfferingIds.has(offering.id);

        return (
          <article className="course-panel" key={offering.id}>
            <div className="course-panel-head"><div><span className="eyebrow">{course?.course_code} · SECTION {offering.section_name}</span><h2>{course?.title}</h2><p>Course assignments, quizzes, and submissions</p></div></div>

            {isStaff && <div className="learning-create-grid">
              <form action={createAssignment} className="learning-form">
                <input type="hidden" name="course_offering_id" value={offering.id} />
                <h3>Post an assignment</h3>
                <label>Title<input name="title" maxLength={160} required /></label>
                <label>Instructions<textarea name="instructions" rows={4} maxLength={12000} /></label>
                <label>Deadline<input name="due_at" type="datetime-local" /></label>
                <button className="button button-primary" type="submit">Post assignment <span aria-hidden="true">→</span></button>
              </form>
              <form action={createQuiz} className="learning-form">
                <input type="hidden" name="course_offering_id" value={offering.id} />
                <h3>Create a multiple-choice quiz</h3>
                <label>Title<input name="title" maxLength={160} required /></label>
                <label>Instructions<textarea name="instructions" rows={2} maxLength={4000} /></label>
                <div className="learning-date-grid"><label>Opens<input name="opens_at" type="datetime-local" required /></label><label>Closes<input name="closes_at" type="datetime-local" required /></label></div>
                <label>Questions<textarea name="questions" rows={5} required placeholder={"Which is correct? | option A | option B | option C | 2\nOne question per line. The last number is the right option (starting at 1)."} /></label>
                <small>Separate each question and option with |. Use 2–6 options and up to 30 questions.</small>
                <button className="button button-primary" type="submit">Post quiz <span aria-hidden="true">→</span></button>
              </form>
            </div>}

            <div className="learning-columns">
              <section><h3 className="learning-section-title">Assignments</h3>
                {assignments.length ? assignments.map((assignment) => {
                  const submissions = list(assignment.submissions);
                  const mySubmission = submissions.find((entry) => entry.student_id === userId);
                  const pastDue = Boolean(assignment.due_at && new Date(assignment.due_at).getTime() < Date.now());
                  return <article className="learning-card" key={assignment.id}>
                    <div className="learning-card-title"><div><h4>{assignment.title}</h4><p>{assignment.due_at ? `Due ${localDate(assignment.due_at)}` : "No deadline"}</p></div>{isStaff && <span className="identity-role">{submissions.length} submitted</span>}</div>
                    {assignment.instructions && <p className="learning-copy">{assignment.instructions}</p>}
                    {isStaff && submissions.map((entry) => {
                      const student = one(entry.student);
                      const grade = one(entry.grade);
                      return <div className="submission-review" key={entry.id}>
                        <span>{student?.full_name ?? "Student"} · {student?.registration_no ?? "Registration pending"} · {localDate(entry.submitted_at)}</span>
                        <p>{entry.response_text}</p>
                        {entry.submission_url && <a href={entry.submission_url} target="_blank" rel="noreferrer">Open submitted link ↗</a>}
                        {profile.role === "faculty" || profile.role === "admin" ? <form action={gradeAssignment} className="grade-form"><input type="hidden" name="submission_id" value={entry.id} /><label>Score<input name="score" type="number" min="0" max="1000" step="0.25" defaultValue={grade?.score ?? ""} required /></label><label>Out of<input name="out_of" type="number" min="0.25" max="1000" step="0.25" defaultValue={grade?.out_of ?? "100"} required /></label><label>Feedback<textarea name="feedback" rows={2} maxLength={4000} defaultValue={grade?.feedback ?? ""} /></label><button className="button button-quiet" type="submit">Save grade</button></form> : grade && <p className="attempt-result">Score: <strong>{grade.score} / {grade.out_of}</strong>{grade.feedback && ` · ${grade.feedback}`}</p>}
                      </div>;
                    })}
                    {canParticipate && (mySubmission ? <div className="submission-review"><span>Your response · {localDate(mySubmission.submitted_at)}</span><p>{mySubmission.response_text}</p>{mySubmission.submission_url && <a href={mySubmission.submission_url} target="_blank" rel="noreferrer">Open submitted link ↗</a>}{one(mySubmission.grade) && <p className="attempt-result">Score: <strong>{one(mySubmission.grade)?.score} / {one(mySubmission.grade)?.out_of}</strong>{one(mySubmission.grade)?.feedback && ` · ${one(mySubmission.grade)?.feedback}`}</p>}</div> : pastDue ? <p className="empty-inline">This assignment is past its deadline.</p> : <form action={submitAssignment} className="learning-submit-form"><input type="hidden" name="assignment_id" value={assignment.id} /><label>Your written response<textarea name="response_text" rows={4} maxLength={12000} required /></label><label>Work link (optional)<input name="submission_url" type="url" placeholder="https://…" /></label><button className="button button-primary" type="submit">Submit response <span aria-hidden="true">→</span></button></form>)}
                  </article>;
                }) : <div className="empty-inline">No assignments posted for this course yet.</div>}
              </section>

              <section><h3 className="learning-section-title">Quizzes</h3>
                {quizzes.length ? quizzes.map((quiz) => {
                  const questions = list(quiz.questions).sort((a, b) => a.sort_order - b.sort_order);
                  const attempts = list(quiz.attempts);
                  const myAttempt = attempts.find((entry) => entry.student_id === userId);
                  const now = Date.now();
                  const opens = new Date(quiz.opens_at).getTime();
                  const closes = new Date(quiz.closes_at).getTime();
                  return <article className="learning-card" key={quiz.id}>
                    <div className="learning-card-title"><div><h4>{quiz.title}</h4><p>{localDate(quiz.opens_at)} – {localDate(quiz.closes_at)}</p></div>{isStaff && <span className="identity-role">{attempts.length} attempts</span>}</div>
                    {quiz.instructions && <p className="learning-copy">{quiz.instructions}</p>}
                    {isStaff && attempts.map((attempt) => {
                      const student = one(attempt.student);
                      return <p className="attempt-result" key={attempt.id}>{student?.full_name ?? "Student"} · {student?.registration_no ?? "Registration pending"}: <strong>{attempt.score} / {attempt.max_score}</strong></p>;
                    })}
                    {canParticipate && (myAttempt ? <div className="attempt-result">Your result: <strong>{myAttempt.score} / {myAttempt.max_score}</strong></div> : now < opens ? <p className="empty-inline">This quiz has not opened yet.</p> : now > closes ? <p className="empty-inline">This quiz is closed.</p> : <form action={submitQuiz} className="quiz-form"><input type="hidden" name="quiz_id" value={quiz.id} />{questions.map((question, index) => {
                      const options = Array.isArray(question.options) ? question.options as string[] : [];
                      return <fieldset className="quiz-question" key={question.id}><legend>{index + 1}. {question.prompt}</legend>{options.map((option, optionIndex) => <label key={`${question.id}-${optionIndex}`}><input type="radio" name={`answer:${question.id}`} value={optionIndex} required />{option}</label>)}</fieldset>;
                    })}<button className="button button-primary" type="submit">Submit quiz <span aria-hidden="true">→</span></button></form>)}
                  </article>;
                }) : <div className="empty-inline">No quizzes posted for this course yet.</div>}
              </section>
            </div>
          </article>
        );
      })}
      {!offerings?.length && <div className="empty-state"><span className="empty-icon">▦</span><h2>No course sections yet</h2><p>Assignments and quizzes will show up when your account is approved and assigned to a class.</p></div>}
    </section>
  );
}
