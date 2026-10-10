import streamlit as st
import psycopg2
from psycopg2 import pool
import pandas as pd
import hashlib
import random
from datetime import datetime, timedelta

# ==============================================================================
# 1. PAGE SETUP & GLOBAL STYLING
# ==============================================================================
st.set_page_config(
    page_title="UET Hub | Academic Operations Portal",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling
st.markdown("""
    <style>
    .main {
        background-color: #0e1117;
    }
    .metric-card {
        background-color: #1a1c24;
        border-radius: 10px;
        padding: 15px;
        border: 1px solid #2e3440;
    }
    </style>
""", unsafe_allow_html=True)

# Full Semester Subject Offerings
SEMESTER_SUBJECTS = [
    "Programming Fundamentals",
    "Programming Fundamentals Lab",
    "Discrete Mathematics",
    "AICT",
    "AICT Lab",
    "Applied Physics",
    "Applied Physics Lab",
    "Calculus & Analytical Geometry"
]

# ==============================================================================
# 2. DATABASE CONFIGURATION & CONNECTION POOL
# ==============================================================================
@st.cache_resource
def init_db_pool():
    """Initializes and caches a thread-safe PostgreSQL connection pool."""
    db_config = st.secrets["postgres"]
    return psycopg2.pool.SimpleConnectionPool(
        minconn=1,
        maxconn=10,
        host=db_config["host"],
        port=db_config["port"],
        dbname=db_config["dbname"],
        user=db_config["user"],
        password=db_config["password"],
        sslmode="require"
    )

try:
    pg_pool = init_db_pool()
except Exception as e:
    st.error(f"Critical Database Connection Failure: {e}")
    st.stop()

def execute_query(query, params=(), commit=False):
    """Executes SQL statements using psycopg2 %s placeholders via connection pooling."""
    conn = pg_pool.getconn()
    result = None
    try:
        # Convert legacy sqlite ? syntax to postgres %s syntax safely
        pg_query = query.replace("?", "%s")
        with conn.cursor() as cur:
            cur.execute(pg_query, params)
            if commit:
                conn.commit()
                result = True
            else:
                result = cur.fetchall()
    except Exception as err:
        conn.rollback()
        raise err
    finally:
        pg_pool.putconn(conn)
    return result

def hash_pass(password: str) -> str:
    """Returns SHA-256 hash of a string."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

# ==============================================================================
# 3. SESSION STATE & AUTHENTICATION
# ==============================================================================
if "authenticated" not in st.session_state:
    st.session_state["authenticated"] = False
    st.session_state["user_id"] = None
    st.session_state["reg_no"] = None
    st.session_state["full_name"] = None
    st.session_state["role"] = None

def logout():
    st.session_state["authenticated"] = False
    st.session_state["user_id"] = None
    st.session_state["reg_no"] = None
    st.session_state["full_name"] = None
    st.session_state["role"] = None
    st.rerun()

# ==============================================================================
# 4. LOGIN & REGISTRATION GATEWAY
# ==============================================================================
if not st.session_state["authenticated"]:
    st.title("🎓 UET Hub — Student & Academic Portal")
    st.markdown("Centralized Academic Management Platform for Class Operations.")

    auth_tab1, auth_tab2 = st.tabs(["🔑 Login", "📝 Create Account"])

    with auth_tab1:
        st.subheader("Sign In to Your Account")
        with st.form("login_form"):
            login_reg = st.text_input("Registration Number (e.g. 2026-DS-01)").strip().upper()
            login_pwd = st.text_input("Password", type="password").strip()
            submit_login = st.form_submit_button("Sign In")

            if submit_login:
                if not login_reg or not login_pwd:
                    st.error("Please fill in both Registration Number and Password.")
                else:
                    hashed_login = hash_pass(login_pwd)
                    user_record = execute_query(
                        "SELECT id, reg_no, full_name, role, password FROM users WHERE reg_no = ?",
                        (login_reg,)
                    )
                    if user_record and user_record[0][4] == hashed_login:
                        st.session_state["authenticated"] = True
                        st.session_state["user_id"] = user_record[0][0]
                        st.session_state["reg_no"] = user_record[0][1]
                        st.session_state["full_name"] = user_record[0][2]
                        st.session_state["role"] = user_record[0][3]
                        st.success(f"Welcome back, {user_record[0][2]}!")
                        st.rerun()
                    else:
                        st.error("Invalid registration number or password.")

    with auth_tab2:
        st.subheader("Register New Account")
        with st.form("signup_form"):
            new_reg = st.text_input("Registration Number (e.g. 2026-DS-01)").strip().upper()
            new_name = st.text_input("Full Name").strip()
            new_role = st.selectbox("Role", ["Student", "CR", "GR"])
            new_pwd = st.text_input("Password", type="password").strip()
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
                        st.success("Account created successfully! Please switch to the Login tab.")
                    except psycopg2.IntegrityError:
                        st.error("An account with this registration number already exists.")

    st.stop()

# ==============================================================================
# 5. AUTHENTICATED USER SIDEBAR
# ==============================================================================
st.sidebar.markdown(f"### 👤 {st.session_state['full_name']}")
st.sidebar.caption(f"**Reg No:** {st.session_state['reg_no']} | **Role:** {st.session_state['role']}")

if st.sidebar.button("🚪 Logout"):
    logout()

is_cr_gr = st.session_state["role"] in ["CR", "GR"]

# Navigation Tabs
nav_tabs = ["📅 Timetable", "📌 Events & Quizzes", "📍 Mark Attendance", "📊 Attendance Summary", "📚 Study Materials", "🧮 GPA Calculator"]
if is_cr_gr:
    nav_tabs.append("🛠️ CR/GR Control Room")

active_tab = st.sidebar.radio("Navigation", nav_tabs)

# ==============================================================================
# TAB 1: TIMETABLE
# ==============================================================================
if active_tab == "📅 Timetable":
    st.title("📅 Class Timetable")
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    selected_day = st.selectbox("Select Day", days)

    schedule = execute_query(
        "SELECT course, timing, room, instructor FROM timetable WHERE day = ? ORDER BY timing ASC",
        (selected_day,)
    )

    if schedule:
        df_time = pd.DataFrame(schedule, columns=["Course", "Timing", "Room", "Instructor"])
        st.dataframe(df_time, use_container_width=True)
    else:
        st.info(f"No scheduled classes found for {selected_day}.")

# ==============================================================================
# TAB 2: EVENTS & QUIZZES
# ==============================================================================
elif active_tab == "📌 Events & Quizzes":
    st.title("📌 Academic Deadlines & Notices")

    events = execute_query(
        "SELECT category, course, deadline, details FROM academic_events ORDER BY deadline ASC"
    )

    if events:
        df_ev = pd.DataFrame(events, columns=["Category", "Course", "Deadline", "Details"])
        st.dataframe(df_ev, use_container_width=True)
    else:
        st.info("No upcoming deadlines or pending academic tasks posted.")

# ==============================================================================
# TAB 3: STUDENT PIN-CODE ATTENDANCE SUBMISSION
# ==============================================================================
elif active_tab == "📍 Mark Attendance":
    st.title("📍 Submit Class Attendance")
    st.markdown("Enter the 4-digit PIN code shared by your CR/GR during class.")

    active_sess = execute_query(
        "SELECT id, course, passcode, expires_at FROM attendance_sessions WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
    )

    if not active_sess:
        st.info("No attendance session is currently open. Please wait for your CR/GR to announce one.")
    else:
        s_id, s_course, s_pin, s_expires = active_sess[0]

        # Check expiration against timezone-aware comparison
        if datetime.now(s_expires.tzinfo) > s_expires:
            st.warning(f"The attendance session for **{s_course}** has expired.")
            execute_query("UPDATE attendance_sessions SET is_active = FALSE WHERE id = ?", (s_id,), commit=True)
        else:
            st.write(f"### Active Session: **{s_course}**")
            entered_pin = st.text_input("Enter 4-Digit Passcode", max_chars=4, key="pin_submission_box")

            if st.button("Submit My Attendance"):
                today_str = datetime.now().strftime("%Y-%m-%d")

                if entered_pin.strip() != s_pin:
                    st.error("Incorrect PIN. Please verify the code announced in class.")
                else:
                    # Check duplicate
                    already_marked = execute_query(
                        "SELECT id FROM attendance WHERE student_id = ? AND course = ? AND date = ?",
                        (st.session_state["user_id"], s_course, today_str)
                    )
                    if already_marked:
                        st.warning(f"You have already submitted attendance for {s_course} today.")
                    else:
                        execute_query(
                            "INSERT INTO attendance (student_id, course, date, status) VALUES (?, ?, ?, 'Present')",
                            (st.session_state["user_id"], s_course, today_str),
                            commit=True
                        )
                        st.success(f"Attendance recorded as **Present** for {s_course}!")
                        st.balloons()

# ==============================================================================
# TAB 4: ATTENDANCE SUMMARY & 75% WARNING
# ==============================================================================
elif active_tab == "📊 Attendance Summary":
    st.title("📊 Personal Attendance Ledger")

    user_att = execute_query(
        "SELECT course, status FROM attendance WHERE student_id = ?",
        (st.session_state["user_id"],)
    )

    if not user_att:
        st.info("No attendance records found under your account.")
    else:
        df_att = pd.DataFrame(user_att, columns=["Course", "Status"])
        summary_list = []

        for c in SEMESTER_SUBJECTS:
            c_data = df_att[df_att["Course"] == c]
            total_c = len(c_data)
            if total_c > 0:
                presents = len(c_data[c_data["Status"] == "Present"])
                pct = round((presents / total_c) * 100, 1)

                # Consecutive classes needed if below 75%
                needed = 0
                if pct < 75.0:
                    needed = int(-(-(0.75 * total_c - presents) // 0.25))

                summary_list.append({
                    "Course": c,
                    "Total Conducted": total_c,
                    "Present": presents,
                    "Percentage": f"{pct}%",
                    "Status": "⚠️ Shortage Alert" if pct < 75.0 else "✅ Safe",
                    "Classes Needed for 75%": needed if needed > 0 else 0
                })

        if summary_list:
            df_summary = pd.DataFrame(summary_list)
            st.dataframe(df_summary, use_container_width=True)

            # Highlighting warnings
            shortages = df_summary[df_summary["Status"] == "⚠️ Shortage Alert"]
            if not shortages.empty:
                for _, row in shortages.iterrows():
                    st.error(
                        f"🚨 **{row['Course']}**: Attendance is at **{row['Percentage']}**! "
                        f"You must attend the next **{row['Classes Needed for 75%']}** consecutive lectures without missing one to reach 75%."
                    )
        else:
            st.info("No classes recorded yet for the defined semester subjects.")

# ==============================================================================
# TAB 5: STUDY RESOURCES
# ==============================================================================
elif active_tab == "📚 Study Materials":
    st.title("📚 Study Resources & Past Papers")

    filter_subj = st.selectbox("Filter by Subject", ["All Subjects"] + SEMESTER_SUBJECTS)

    if filter_subj == "All Subjects":
        resources = execute_query(
            "SELECT subject, title, doc_type, resource_url, uploaded_by FROM study_resources ORDER BY id DESC"
        )
    else:
        resources = execute_query(
            "SELECT subject, title, doc_type, resource_url, uploaded_by FROM study_resources WHERE subject = ? ORDER BY id DESC",
            (filter_subj,)
        )

    if resources:
        for r in resources:
            with st.container():
                st.markdown(f"#### 📄 {r[1]} (`{r[2]}`)")
                st.caption(f"Subject: **{r[0]}** | Contributed by: **{r[4]}**")
                st.link_button("🔗 Open File / Resource Link", r[3])
                st.divider()
    else:
        st.info("No study resources uploaded yet for this selection.")

# ==============================================================================
# TAB 6: GPA CALCULATOR
# ==============================================================================
elif active_tab == "🧮 GPA Calculator":
    st.title("🧮 Academic Performance Calculator")

    grade_points = {
        "A (4.00)": 4.0, "A- (3.70)": 3.7, "B+ (3.30)": 3.3,
        "B (3.00)": 3.0, "B- (2.70)": 2.7, "C+ (2.30)": 2.3,
        "C (2.00)": 2.0, "D (1.00)": 1.0, "F (0.00)": 0.0
    }

    st.subheader("Semester GPA Estimation")
    num_courses = st.number_input("Number of Courses", min_value=1, max_value=10, value=6)

    total_weighted_points = 0.0
    total_credit_hours = 0

    cols = st.columns(3)
    for i in range(num_courses):
        with cols[i % 3]:
            st.markdown(f"**Course {i+1}**")
            ch = st.selectbox(f"Credit Hours #{i+1}", [4, 3, 2, 1], index=1, key=f"ch_{i}")
            gr = st.selectbox(f"Expected Grade #{i+1}", list(grade_points.keys()), key=f"gr_{i}")
            total_weighted_points += ch * grade_points[gr]
            total_credit_hours += ch

    if total_credit_hours > 0:
        calculated_gpa = round(total_weighted_points / total_credit_hours, 2)
        st.metric(label="Estimated Semester GPA", value=f"{calculated_gpa} / 4.00")

# ==============================================================================
# TAB 7: CR / GR CONTROL ROOM (ADMIN ONLY)
# ==============================================================================
elif active_tab == "🛠️ CR/GR Control Room" and is_cr_gr:
    st.title("🛠️ Representative Control Room")

    cr_panel_tab1, cr_panel_tab2, cr_panel_tab3, cr_panel_tab4, cr_panel_tab5 = st.tabs([
        "📡 Attendance Session",
        "📥 Export CSV Roster",
        "📢 Post Academic Notice",
        "📚 Upload Resource",
        "📅 Manage Timetable"
    ])

    # Sub-Tab 1: Passcode Session Generator
    with cr_panel_tab1:
        st.subheader("Start Live Attendance Session")
        sess_subj = st.selectbox("Select Course", SEMESTER_SUBJECTS, key="cr_active_subj")
        duration = st.slider("Session Validity (Minutes)", min_value=1, max_value=15, value=5)

        if st.button("🚀 Generate PIN & Open Session"):
            generated_pin = str(random.randint(1000, 9999))
            expires_at = datetime.utcnow() + timedelta(minutes=duration)

            # Close existing open sessions
            execute_query(
                "UPDATE attendance_sessions SET is_active = FALSE WHERE is_active = TRUE",
                commit=True
            )

            # Create fresh active session
            execute_query(
                "INSERT INTO attendance_sessions (course, passcode, expires_at, is_active) VALUES (?, ?, ?, TRUE)",
                (sess_subj, generated_pin, expires_at),
                commit=True
            )
            st.success(f"Live session created for **{sess_subj}**!")
            st.metric(label="Class PIN Code", value=generated_pin)
            st.info(f"Announce this PIN code to the class. It will automatically expire in {duration} minutes.")

    # Sub-Tab 2: Export Attendance Roster CSV
    with cr_panel_tab2:
        st.subheader("Download Class Attendance Spreadsheet")
        exp_course = st.selectbox("Select Subject", ["All Courses"] + SEMESTER_SUBJECTS, key="csv_subj_export")

        if st.button("Compile CSV File"):
            if exp_course == "All Courses":
                records = execute_query("""
                    SELECT u.reg_no, u.full_name, a.course, a.date, a.status
                    FROM attendance a
                    JOIN users u ON a.student_id = u.id
                    ORDER BY a.date DESC, u.reg_no ASC;
                """)
            else:
                records = execute_query("""
                    SELECT u.reg_no, u.full_name, a.course, a.date, a.status
                    FROM attendance a
                    JOIN users u ON a.student_id = u.id
                    WHERE a.course = ?
                    ORDER BY a.date DESC, u.reg_no ASC;
                """, (exp_course,))

            if not records:
                st.warning("No attendance records found to export.")
            else:
                df_export = pd.DataFrame(
                    records,
                    columns=["Registration No", "Full Name", "Course", "Date", "Status"]
                )
                csv_bytes = df_export.to_csv(index=False).encode("utf-8")
                st.success(f"Ready! Found {len(df_export)} attendance entries.")
                st.download_button(
                    label="⬇️ Download Attendance CSV",
                    data=csv_bytes,
                    file_name=f"Attendance_{exp_course.replace(' ', '_')}.csv",
                    mime="text/csv"
                )

    # Sub-Tab 3: Add Events / Deadlines
    with cr_panel_tab3:
        st.subheader("Post Assignment / Quiz Deadline")
        with st.form("add_event_form"):
            ev_cat = st.selectbox("Category", ["Assignment", "Quiz", "Lab Task", "Announcement"])
            ev_subj = st.selectbox("Subject", SEMESTER_SUBJECTS)
            ev_date = st.date_input("Deadline Date")
            ev_desc = st.text_area("Details / Instructions")
            post_ev = st.form_submit_button("Publish Announcement")

            if post_ev:
                execute_query(
                    "INSERT INTO academic_events (category, course, deadline, details) VALUES (?, ?, ?, ?)",
                    (ev_cat, ev_subj, str(ev_date), ev_desc),
                    commit=True
                )
                st.success("Academic deadline published successfully!")

    # Sub-Tab 4: Upload Drive Links
    with cr_panel_tab4:
        st.subheader("Share Slides & Past Papers")
        with st.form("add_res_form"):
            res_subj = st.selectbox("Subject", SEMESTER_SUBJECTS, key="res_subj_post")
            res_title = st.text_input("Document Title (e.g. Midterm 2024 Solution)")
            res_type = st.selectbox("Document Type", ["Lecture Slide", "Past Paper", "Book/Manual", "Handwritten Notes"])
            res_url = st.text_input("Resource URL (Google Drive / OneDrive Link)")
            post_res = st.form_submit_button("Upload Resource")

            if post_res:
                if not res_title or not res_url:
                    st.error("Title and URL are required.")
                else:
                    execute_query(
                        "INSERT INTO study_resources (subject, title, doc_type, resource_url, uploaded_by) VALUES (?, ?, ?, ?, ?)",
                        (res_subj, res_title, res_type, res_url, st.session_state["full_name"]),
                        commit=True
                    )
                    st.success("Study resource added to the class library!")

    # Sub-Tab 5: Add Lecture Slot to Timetable Directly from App
    with cr_panel_tab5:
        st.subheader("Add Lecture Slot to Timetable")
        with st.form("add_timetable_slot_form"):
            tt_day = st.selectbox("Day of Week", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
            tt_course = st.selectbox("Course / Subject", SEMESTER_SUBJECTS)
            tt_timing = st.text_input("Timing (e.g. 08:30 AM - 10:00 AM)")
            tt_room = st.text_input("Room / Hall (e.g. CS Lab 2 or Room 101)")
            tt_instructor = st.text_input("Instructor / Teacher Name")
            submit_slot = st.form_submit_button("Add to Class Timetable")

            if submit_slot:
                if not tt_timing or not tt_room or not tt_instructor:
                    st.error("Please fill in timing, room, and instructor.")
                else:
                    execute_query(
                        "INSERT INTO timetable (day, course, timing, room, instructor) VALUES (?, ?, ?, ?, ?)",
                        (tt_day, tt_course, tt_timing, tt_room, tt_instructor),
                        commit=True
                    )
                    st.success(f"Added {tt_course} on {tt_day} ({tt_timing}) to the timetable!")