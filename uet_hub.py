"""
Project Title: UET Hub - Complete Academic & Class Management Suite
Course: Fundamental Programming (Python)
Database: Supabase Cloud PostgreSQL
GUI: Python Streamlit
"""

import psycopg2
import hashlib
import datetime
import pandas as pd
import streamlit as st

# --- Page Setup ---
st.set_page_config(
    page_title="UET Hub | Student Portal",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded"
)
# --- Database Connection & Query Engine ---
def get_db_connection():
    pg = st.secrets["postgres"]
    return psycopg2.connect(
        host=pg["host"],
        port=pg["port"],
        dbname=pg["dbname"],
        user=pg["user"],
        password=pg["password"]
    )
def execute_query(query: str, params=(), commit=False):
    """Executes query on cloud PostgreSQL, adapting SQLite-style ? to %s placeholders."""
    pg_query = query.replace("?", "%s")
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(pg_query, params)
        if commit:
            conn.commit()
            data = None
        else:
            data = cur.fetchall()
        return data
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

# --- Helper Functions ---
def hash_pass(password: str) -> str:
    """Returns SHA256 hashed password."""
    return hashlib.sha256(password.encode()).hexdigest()

# --- Session Management ---
if "user" not in st.session_state:
    st.session_state.user = None

def logout():
    st.session_state.user = None
    st.rerun()

# =========================================================
# AUTHENTICATION MODULE (LOGIN & SIGN UP)
# =========================================================
if not st.session_state.user:
    st.markdown("<h1 style='text-align: center;'>🎓 UET Hub - University Management Suite</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: gray;'>Centralized Portal for Timetables, Attendance, Quizzes & Academic Records</p>", unsafe_allow_html=True)
    st.divider()

    auth_tab1, auth_tab2 = st.tabs(["🔑 Student & Representative Login", "📝 Create Account"])

    # Login Tab
    with auth_tab1:
        st.subheader("Login to your Account")
        with st.form("login_form"):
            reg_input = st.text_input("Registration Number (e.g., 2026-DS-01)").strip().upper()
            pwd_input = st.text_input("Password", type="password").strip()
            submit_login = st.form_submit_button("Sign In")

            if submit_login:
                if not reg_input or not pwd_input:
                    st.error("Please provide both registration number and password.")
                else:
                    user_record = execute_query(
                        "SELECT id, reg_no, full_name, password, role FROM users WHERE reg_no = ?",
                        (reg_input,)
                    )
                    if user_record and user_record[0][3] == hash_pass(pwd_input):
                        st.session_state.user = {
                            "id": user_record[0][0],
                            "reg_no": user_record[0][1],
                            "name": user_record[0][2],
                            "role": user_record[0][4]
                        }
                        st.success(f"Welcome back, {user_record[0][2]}!")
                        st.rerun()
                    else:
                        st.error("Invalid registration number or password.")

    # Signup Tab
    with auth_tab2:
        st.subheader("Register New Student / Representative")
        with st.form("signup_form"):
            new_reg = st.text_input("Registration Number").strip().upper()
            new_name = st.text_input("Full Name").strip()
            new_role = st.selectbox("Account Role", ["Student", "CR", "GR"])
            new_pwd = st.text_input("Set Password", type="password").strip()
            new_pwd_confirm = st.text_input("Confirm Password", type="password").strip()
            submit_signup = st.form_submit_button("Complete Registration")

            if submit_signup:
                if not new_reg or not new_name or not new_pwd:
                    st.error("All fields are mandatory.")
                elif new_pwd != new_pwd_confirm:
                    st.error("Passwords do not match.")
                else:
                    try:
                        execute_query(
                            "INSERT INTO users (reg_no, full_name, password, role) VALUES (?, ?, ?, ?)",
                            (new_reg, new_name, hash_pass(new_pwd), new_role),
                            commit=True
                        )
                        st.success("Account created successfully! Please proceed to the Login tab.")
                    except psycopg2.IntegrityError:
                        st.error("A user with this registration number already exists.")

    st.stop()

# =========================================================
# MAIN DASHBOARD (AUTHENTICATED)
# =========================================================
current_user = st.session_state.user
is_admin = current_user["role"] in ["CR", "GR"]

# Sidebar Profile & Operations
st.sidebar.markdown("### 👤 User Profile")
st.sidebar.write(f"**Name:** {current_user['name']}")
st.sidebar.write(f"**Reg No:** `{current_user['reg_no']}`")
st.sidebar.markdown(f"**Role:** :blue-background[{current_user['role']}]")
st.sidebar.divider()
st.sidebar.button("🚪 Log Out", on_click=logout, use_container_width=True)

# Main Navigation Tabs
tab_tt, tab_academics, tab_tasks, tab_att, tab_gpa, tab_repo, tab_cr_panel = st.tabs([
    "📅 Timetable",
    "📝 Quizzes & Assignments",
    "✅ Personal Checklist",
    "📊 Attendance",
    "🧮 GPA Calculator",
    "📚 Past Papers & Notes",
    "⚙️ CR/GR Control Room" if is_admin else "ℹ️ Class Info"
])

# ----------------- 1. TIMETABLE -----------------
with tab_tt:
    st.subheader("📅 Weekly Class Timetable")
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    selected_day = st.selectbox("Select Day to View:", days)
    
    classes = execute_query(
        "SELECT subject, time_slot, room, teacher FROM timetable WHERE day = ? ORDER BY id ASC",
        (selected_day,)
    )
    if classes:
        for c_sub, c_time, c_room, c_prof in classes:
            with st.container(border=True):
                col1, col2, col3 = st.columns([3, 2, 2])
                col1.markdown(f"#### 📖 {c_sub}")
                col2.write(f"⏰ **Time:** {c_time}")
                col3.write(f"📍 **Room:** {c_room} | 👨‍🏫 **Instructor:** {c_prof}")
    else:
        st.info(f"No classes scheduled for {selected_day}.")

# ----------------- 2. QUIZZES & ASSIGNMENTS -----------------
with tab_academics:
    st.subheader("📝 Pending Assignments, Quizzes & Deadlines")
    events = execute_query(
        "SELECT category, subject, title, due_date, details FROM academic_events ORDER BY due_date ASC"
    )
    
    if events:
        for cat, sub, title, due, details in events:
            with st.container(border=True):
                col_a, col_b = st.columns([4, 1])
                with col_a:
                    tag = "🚨 Quiz" if cat == "Quiz" else ("📄 Assignment" if cat == "Assignment" else "⏳ Pending Work")
                    st.markdown(f"### {tag}: {title}")
                    st.write(f"**Subject:** {sub} | **Details:** {details}")
                with col_b:
                    st.warning(f"Due Date:\n**{due}**")
    else:
        st.success("No pending assignments or quizzes right now!")

# ----------------- 3. PERSONAL STUDENT CHECKLIST -----------------
with tab_tasks:
    st.subheader("✅ My Personal Task Checklist")
    st.caption("Private to your account. Track your homework, lab tasks, and personal study goals.")
    
    with st.form("add_personal_task", clear_on_submit=True):
        col_t1, col_t2 = st.columns([5, 1])
        new_task = col_t1.text_input("Enter new personal task...")
        submit_task = col_t2.form_submit_button("Add Task")
        
        if submit_task and new_task.strip():
            execute_query(
                "INSERT INTO personal_tasks (user_id, task_title, status) VALUES (?, ?, 'Pending')",
                (current_user["id"], new_task.strip()),
                commit=True
            )
            st.rerun()

    my_tasks = execute_query(
        "SELECT id, task_title, status FROM personal_tasks WHERE user_id = ? ORDER BY id DESC",
        (current_user["id"],)
    )
    
    if my_tasks:
        for tid, title, status in my_tasks:
            col_chk, col_txt, col_del = st.columns([1, 6, 1])
            is_done = (status == "Completed")
            
            with col_chk:
                done = st.checkbox("Done", value=is_done, key=f"task_{tid}")
                if done != is_done:
                    new_status = "Completed" if done else "Pending"
                    execute_query(
                        "UPDATE personal_tasks SET status = ? WHERE id = ?",
                        (new_status, tid),
                        commit=True
                    )
                    st.rerun()
            with col_txt:
                if is_done:
                    st.markdown(f"~~{title}~~")
                else:
                    st.write(title)
            with col_del:
                if st.button("🗑️", key=f"del_{tid}"):
                    execute_query("DELETE FROM personal_tasks WHERE id = ?", (tid,), commit=True)
                    st.rerun()
    else:
        st.info("No personal tasks added. Create one above to stay organized!")

# ----------------- 4. ATTENDANCE & 75% WARNING ENGINE -----------------
with tab_att:
    st.subheader("📊 My Personal Attendance Records")
    
    att_records = execute_query(
        "SELECT date, subject, status FROM attendance WHERE student_id = ? ORDER BY date DESC",
        (current_user["id"],)
    )
    
    total_classes = len(att_records)
    presents = sum(1 for r in att_records if r[2] == "Present")
    absents = sum(1 for r in att_records if r[2] == "Absent")
    percentage = (presents / total_classes * 100) if total_classes > 0 else 100.0

    col_m1, col_m2, col_m3, col_m4 = st.columns(4)
    col_m1.metric("Attendance Rate", f"{percentage:.1f}%")
    col_m2.metric("Total Lectures Marked", total_classes)
    col_m3.metric("Presents", presents)
    col_m4.metric("Absents", absents)
    st.divider()

    if total_classes > 0:
        if percentage < 75.0:
            needed_classes = int(-(-(0.75 * total_classes - presents) // 0.25))
            if needed_classes <= 0:
                needed_classes = 1
            st.error(
                f"🚨 **Attendance Shortage Alert! ({percentage:.1f}%)**\n\n"
                f"Your attendance is below the mandatory university 75% limit. "
                f"You must attend the next **{needed_classes} consecutive lecture(s)** without an absence to restore your standing to 75%."
            )
        elif 75.0 <= percentage < 80.0:
            st.warning(
                f"⚠️ **Borderline Attendance Warning ({percentage:.1f}%)**\n\n"
                "You are just above the 75% threshold. Any upcoming unexcused absence could put you at risk."
            )
        else:
            st.success(f"✅ **Safe Zone ({percentage:.1f}%)**: Your attendance meets university requirements.")
    
    st.write("#### My Attendance Log")
    if att_records:
        for date_val, subj, stat in att_records:
            icon = "✅" if stat == "Present" else ("❌" if stat == "Absent" else "🟡")
            st.write(f"{icon} **{date_val}** — {subj} : **{stat}**")
    else:
        st.info("No attendance records uploaded for your registration number yet.")

# ----------------- 5. GPA & CGPA CALCULATOR -----------------
with tab_gpa:
    st.subheader("🧮 Semester GPA & Projected CGPA Calculator")
    st.caption("Standard UET 4.0 grading scale: A (4.0), A- (3.7), B+ (3.3), B (3.0), B- (2.7), C+ (2.3), C (2.0), D (1.0), F (0.0)")

    grade_points = {
        "A (4.0)": 4.0,
        "A- (3.7)": 3.7,
        "B+ (3.3)": 3.3,
        "B (3.0)": 3.0,
        "B- (2.7)": 2.7,
        "C+ (2.3)": 2.3,
        "C (2.0)": 2.0,
        "D (1.0)": 1.0,
        "F (0.0)": 0.0
    }

    num_courses = st.number_input("Number of Courses This Semester:", min_value=1, max_value=10, value=5, step=1)
    
    course_entries = []
    st.write("---")
    
    for i in range(num_courses):
        c_col1, c_col2, c_col3 = st.columns([3, 2, 2])
        c_name = c_col1.text_input(f"Course {i+1} Name", value=f"Course {i+1}", key=f"c_name_{i}")
        c_credit = c_col2.selectbox(f"Credit Hours", [4, 3, 2, 1], index=1, key=f"c_cred_{i}")
        c_grade = c_col3.selectbox(f"Expected / Final Grade", list(grade_points.keys()), key=f"c_grd_{i}")
        course_entries.append((c_credit, grade_points[c_grade]))

    total_credits = sum(entry[0] for entry in course_entries)
    total_quality_points = sum(entry[0] * entry[1] for entry in course_entries)
    calculated_gpa = (total_quality_points / total_credits) if total_credits > 0 else 0.0

    st.divider()
    res_col1, res_col2 = st.columns(2)
    res_col1.metric("Current Semester GPA", f"{calculated_gpa:.2f}")
    res_col2.metric("Total Semester Credit Hours", total_credits)

    with st.expander("📈 Calculate Cumulative CGPA (Previous Semesters + Current)"):
        cg_col1, cg_col2 = st.columns(2)
        prev_cgpa = cg_col1.number_input("Previous Cumulative CGPA", min_value=0.0, max_value=4.0, value=0.0, step=0.01)
        prev_credits = cg_col2.number_input("Total Credit Hours Completed Previously", min_value=0, max_value=150, value=0, step=1)

        if prev_credits > 0:
            combined_credits = prev_credits + total_credits
            cumulative_cgpa = ((prev_cgpa * prev_credits) + total_quality_points) / combined_credits
            st.success(f"🎯 **Projected Overall CGPA:** **{cumulative_cgpa:.2f}** over {combined_credits} total credit hours.")

# ----------------- 6. PAST PAPERS & REPOSITORY -----------------
with tab_repo:
    st.subheader("📚 Subject Resources & Past Papers")
    
    with st.expander("➕ Upload / Share Resource"):
        with st.form("upload_repo_form", clear_on_submit=True):
            r_sub = st.selectbox("Course Subject", [
                "Programming Fundamentals",
                "Calculus & Analytical Geometry",
                "Data Science Fundamentals",
                "Applied Physics",
                "Discrete Mathematics"
            ])
            r_title = st.text_input("Title (e.g., Midterm 2025 Paper)")
            r_type = st.selectbox("Category", ["Past Paper", "Lecture Slide", "Handwritten Notes", "Book/Manual"])
            r_url = st.text_input("Resource URL (Google Drive / GitHub / Web link)")
            btn_share = st.form_submit_button("Publish Resource")
            
            if btn_share:
                if r_title.strip() and r_url.strip():
                    execute_query(
                        "INSERT INTO study_resources (subject, title, doc_type, resource_url, uploaded_by) VALUES (?, ?, ?, ?, ?)",
                        (r_sub, r_title, r_type, r_url, current_user["name"]),
                        commit=True
                    )
                    st.success("Resource shared successfully!")
                    st.rerun()
                else:
                    st.error("Please fill all fields.")

    docs = execute_query("SELECT subject, title, doc_type, resource_url, uploaded_by FROM study_resources ORDER BY id DESC")
    if docs:
        for d_sub, d_tit, d_typ, d_url, d_by in docs:
            with st.container(border=True):
                cd1, cd2 = st.columns([5, 1])
                cd1.markdown(f"**{d_tit}** ({d_typ}) — *{d_sub}*")
                cd1.caption(f"Shared by {d_by}")
                cd2.link_button("Access File 🔗", d_url)
    else:
        st.info("No documents uploaded yet.")

# ----------------- 7. CR / GR ADMINISTRATIVE CONTROL ROOM -----------------
with tab_cr_panel:
    if not is_admin:
        st.subheader("Class Overview")
        st.info("Administrative controls are restricted to Class Representative (CR) and Girls Representative (GR) accounts.")
    else:
        st.subheader("⚙️ CR & GR Administration Suite")
        st.success(f"Administrative session active for {current_user['role']} ({current_user['name']}).")
        
        adm_1, adm_2, adm_3 = st.tabs(["Manage Timetable", "Attendance Suite (Mark & View)", "Post Quizzes & Assignments"])

        # SUB-TAB 1: TIMETABLE MANAGEMENT
        with adm_1:
            st.markdown("#### ➕ Add New Timetable Period")
            with st.form("add_tt_form", clear_on_submit=True):
                tt_day = st.selectbox("Day", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
                tt_sub = st.text_input("Subject")
                tt_time = st.text_input("Time Slot (e.g. 09:00 AM - 10:30 AM)")
                tt_room = st.text_input("Room / Lab (e.g. CS Lab 2)")
                tt_prof = st.text_input("Teacher / Instructor")
                if st.form_submit_button("Add to Timetable"):
                    if tt_sub and tt_time and tt_room:
                        execute_query(
                            "INSERT INTO timetable (day, subject, time_slot, room, teacher) VALUES (?, ?, ?, ?, ?)",
                            (tt_day, tt_sub, tt_time, tt_room, tt_prof),
                            commit=True
                        )
                        st.success("Timetable slot added successfully!")
                        st.rerun()
                    else:
                        st.error("All timetable fields are required.")

            st.divider()
            st.markdown("#### 🗑️ Remove an Incorrect Period")
            all_slots = execute_query("SELECT id, day, subject, time_slot, room FROM timetable ORDER BY day, time_slot ASC")
            
            if all_slots:
                slot_map = {
                    f"{slot[1]} | {slot[2]} ({slot[3]}) - Room: {slot[4]}": slot[0]
                    for slot in all_slots
                }
                selected_label = st.selectbox("Select the period to delete:", list(slot_map.keys()))
                period_to_delete_id = slot_map[selected_label]
                
                if st.button("Delete Selected Period", type="primary"):
                    execute_query("DELETE FROM timetable WHERE id = ?", (period_to_delete_id,), commit=True)
                    st.success("Period deleted successfully from the timetable!")
                    st.rerun()
            else:
                st.info("No timetable slots available to remove.")

        # SUB-TAB 2: ATTENDANCE SUITE
        with adm_2:
            st.markdown("#### 📝 Mark Daily Student Attendance")
            students = execute_query("SELECT id, reg_no, full_name FROM users WHERE role = 'Student' ORDER BY reg_no ASC")
            
            if students:
                with st.form("mark_att_form"):
                    col_f1, col_f2 = st.columns(2)
                    att_sub = col_f1.selectbox("Subject", [
                        "Programming Fundamentals",
                        "Calculus & Analytical Geometry",
                        "Data Science Fundamentals",
                        "Applied Physics",
                        "Discrete Mathematics"
                    ])
                    att_date = col_f2.date_input("Lecture Date", datetime.date.today()).strftime("%Y-%m-%d")
                    st.write("---")
                    
                    student_statuses = {}
                    for sid, sreg, sname in students:
                        col_s1, col_s2 = st.columns([3, 2])
                        col_s1.write(f"**{sreg}** — {sname}")
                        student_statuses[sid] = col_s2.radio(
                            f"Status for {sreg}",
                            ["Present", "Absent", "Leave"],
                            key=f"att_radio_{sid}",
                            horizontal=True,
                            label_visibility="collapsed"
                        )

                    if st.form_submit_button("Save & Commit Attendance"):
                        for sid, stat in student_statuses.items():
                            execute_query(
                                "INSERT INTO attendance (student_id, date, subject, status) VALUES (?, ?, ?, ?)",
                                (sid, att_date, att_sub, stat),
                                commit=True
                            )
                        st.success("Attendance successfully committed to database!")
                        st.rerun()
            else:
                st.warning("No registered students found in the database. When students create accounts, they will appear here.")

            st.divider()
            st.markdown("#### 📋 Complete Class Attendance Sheet")
            
            master_att = execute_query("""
                SELECT 
                    a.date AS "Date",
                    a.subject AS "Subject",
                    u.reg_no AS "Reg No",
                    u.full_name AS "Student Name",
                    a.status AS "Status"
                FROM attendance a
                JOIN users u ON a.student_id = u.id
                ORDER BY a.date DESC, u.reg_no ASC
            """)

            if master_att:
                df_att = pd.DataFrame(master_att, columns=["Date", "Subject", "Reg No", "Student Name", "Status"])
                st.dataframe(df_att, use_container_width=True)
                
                csv_data = df_att.to_csv(index=False).encode('utf-8')
                st.download_button(
                    label="📥 Download Full Attendance Sheet (CSV)",
                    data=csv_data,
                    file_name=f"UET_Attendance_{datetime.date.today()}.csv",
                    mime="text/csv",
                    use_container_width=True
                )
            else:
                st.info("No attendance records have been registered in the database yet.")

        # SUB-TAB 3: POST OFFICIAL TASKS
        with adm_3:
            st.markdown("#### 📢 Post Quizzes, Assignments & Deadlines")
            with st.form("academic_post_form", clear_on_submit=True):
                cat = st.selectbox("Type", ["Quiz", "Assignment", "Pending Work"])
                sub_name = st.text_input("Course Subject")
                ev_title = st.text_input("Title / Topic")
                ev_due = st.date_input("Due Date", datetime.date.today() + datetime.timedelta(days=3)).strftime("%Y-%m-%d")
                ev_desc = st.text_area("Instructions / Guidelines")
                
                if st.form_submit_button("Publish Task to Batch"):
                    if sub_name and ev_title:
                        execute_query(
                            "INSERT INTO academic_events (category, subject, title, due_date, details) VALUES (?, ?, ?, ?, ?)",
                            (cat, sub_name, ev_title, ev_due, ev_desc),
                            commit=True
                        )
                        st.success("Academic task published to all students!")
                        st.rerun()
                    else:
                        st.error("Subject and Title are required.")