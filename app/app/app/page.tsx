'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Clock, MapPin, User, Calendar, AlertCircle, 
  Bus, ShieldCheck, Search, ArrowRight 
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function BSDSHub() {
  const [semester, setSemester] = useState<'1st' | '2nd'>('1st');
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [schedule, setSchedule] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'schedule' | 'buses' | 'cr-portal'>('schedule');

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [newNotice, setNewNotice] = useState({ title: '', course_name: '', type: 'Assignment', due_date: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  useEffect(() => {
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    if (days.includes(weekday)) {
      setSelectedDay(weekday);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [semester, selectedDay]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, []);

  async function fetchSchedule() {
    const { data } = await supabase
      .from('timetable_slots')
      .select('*')
      .eq('semester', semester)
      .eq('day_of_week', selectedDay)
      .order('start_time', { ascending: true });
    setSchedule(data || []);
  }

  async function fetchAuxiliaryData() {
    const { data: alerts } = await supabase.from('announcements').select('*').order('due_date', { ascending: true });
    const { data: busData } = await supabase.from('bus_routes').select('*').order('departure_time', { ascending: true });
    const { data: records } = await supabase.from('student_records').select('*').order('roll_number', { ascending: true });

    setAnnouncements(alerts || []);
    setBuses(busData || []);
    setStudents(records || []);
  }

  async function handleAddNotice(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('announcements').insert([newNotice]);
    if (!error) {
      alert('Alert posted successfully to the student feed!');
      setNewNotice({ title: '', course_name: '', type: 'Assignment', due_date: '' });
      fetchAuxiliaryData();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">UET Faisalabad Campus</span>
            <h1 className="text-xl font-bold tracking-tight">Data Science Department Hub</h1>
          </div>
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button 
              onClick={() => setSemester('1st')} 
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${semester === '1st' ? 'bg-teal-500 text-slate-950 shadow' : 'text-slate-300'}`}
            >
              1st Sem
            </button>
            <button 
              onClick={() => setSemester('2nd')} 
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${semester === '2nd' ? 'bg-teal-500 text-slate-950 shadow' : 'text-slate-300'}`}
            >
              2nd Sem
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 flex gap-6 text-sm border-t border-slate-800">
          <button 
            onClick={() => setActiveTab('schedule')} 
            className={`py-2.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'schedule' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <Calendar className="w-4 h-4" /> Timetable
          </button>
          <button 
            onClick={() => setActiveTab('buses')} 
            className={`py-2.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'buses' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <Bus className="w-4 h-4" /> Bus Routes
          </button>
          <button 
            onClick={() => setActiveTab('cr-portal')} 
            className={`py-2.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'cr-portal' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <ShieldCheck className="w-4 h-4" /> CR / GR Portal
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        {activeTab === 'schedule' && (
          <>
            <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-amber-900 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Active Assignments, Tests & Lab Deadlines</span>
              </div>
              {announcements.length === 0 ? (
                <p className="text-xs text-slate-500">No pending tests or assignments logged.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {announcements.map((a) => (
                    <div key={a.id} className="bg-white p-3 rounded-lg border border-amber-200 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800">[{a.type}] {a.title}</span>
                        <p className="text-slate-500 mt-0.5">{a.course_name}</p>
                      </div>
                      <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded font-medium">
                        Due: {new Date(a.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {days.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                    selectedDay === d ? 'bg-slate-900 text-white shadow' : 'bg-white border text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  {selectedDay} Routine ({semester} Semester)
                </h2>
                <span className="text-xs text-slate-500 font-mono">{schedule.length} sessions</span>
              </div>

              {schedule.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-dashed text-center text-slate-500 text-sm">
                  No classes scheduled on this day (Tutorial / Self-study session).
                </div>
              ) : (
                <div className="grid gap-3">
                  {schedule.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        item.course_type === 'Lab' 
                          ? 'bg-purple-50/60 border-purple-200' 
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-500">{item.course_code}</span>
                            <h3 className="font-bold text-slate-900">{item.course_name}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                              item.course_type === 'Lab' ? 'bg-purple-200 text-purple-900' : 'bg-blue-100 text-blue-900'
                            }`}>
                              {item.course_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-600 mt-2">
                            <span className="flex items-center gap-1.5 font-medium">
                              <User className="w-3.5 h-3.5 text-slate-400" /> {item.teacher_name}
                            </span>
                            <span className="flex items-center gap-1.5 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.room_no}
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-700 self-start sm:self-center">
                          {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'buses' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">UET Faisalabad Transport Directory</h2>
              <p className="text-xs text-slate-500">Official campus points & city feeder routes</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {buses.map((bus) => (
                <div key={bus.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-slate-900 text-sm">{bus.route_name}</span>
                    <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      {bus.bus_number}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <p className="font-medium text-slate-400 mb-1 uppercase tracking-wider text-[10px]">Stops & Pickup Points</p>
                    <p className="flex flex-wrap items-center gap-1">
                      {bus.pickup_points.map((pt: string, idx: number) => (
                        <span key={idx} className="flex items-center gap-1">
                          <span className="font-semibold text-slate-800">{pt}</span>
                          {idx < bus.pickup_points.length - 1 && <ArrowRight className="w-3 h-3 text-slate-400" />}
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-500 pt-1">
                    Scheduled Campus Departure: <strong className="text-slate-800">{bus.departure_time.slice(0, 5)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'cr-portal' && (
          <section className="space-y-6">
            {!isAuthorized ? (
              <div className="max-w-md mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center space-y-4">
                <ShieldCheck className="w-10 h-10 text-teal-600 mx-auto" />
                <h3 className="font-bold text-slate-900">CR & GR Authorized Access</h3>
                <p className="text-xs text-slate-500">Enter Class Representative PIN to manage deadlines and cohort CGPA records.</p>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    placeholder="Enter PIN (Default: 1234)" 
                    value={passcode} 
                    onChange={(e) => setPasscode(e.target.value)}
                    className="border rounded px-3 py-2 text-sm flex-1"
                  />
                  <button 
                    onClick={() => {
                      if (passcode === '1234') {
                        setIsAuthorized(true);
                      } else {
                        alert('Incorrect passcode');
                      }
                    }} 
                    className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-slate-800"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Broadcast Class Notice / Assignment</h3>
                  <form onSubmit={handleAddNotice} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <input 
                      type="text" 
                      placeholder="Title (e.g. Lab 2 Submission)" 
                      required
                      value={newNotice.title} 
                      onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                      className="border p-2 rounded"
                    />
                    <input 
                      type="text" 
                      placeholder="Course (e.g. Programming Fundamentals)" 
                      required
                      value={newNotice.course_name} 
                      onChange={(e) => setNewNotice({ ...newNotice, course_name: e.target.value })}
                      className="border p-2 rounded"
                    />
                    <select 
                      value={newNotice.type} 
                      onChange={(e) => setNewNotice({ ...newNotice, type: e.target.value })}
                      className="border p-2 rounded"
                    >
                      <option value="Assignment">Assignment</option>
                      <option value="Quiz">Quiz</option>
                      <option value="Test">Test</option>
                      <option value="Makeup Class">Makeup Class</option>
                    </select>
                    <input 
                      type="date" 
                      required
                      value={newNotice.due_date} 
                      onChange={(e) => setNewNotice({ ...newNotice, due_date: e.target.value })}
                      className="border p-2 rounded"
                    />
                    <button 
                      type="submit" 
                      className="md:col-span-4 bg-teal-600 text-white py-2 rounded font-bold text-xs hover:bg-teal-700"
                    >
                      Publish Notice to Class Feed
                    </button>
                  </form>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Batch Progress Ledger</h3>
                      <p className="text-xs text-slate-500">Monitor roll-wise CGPA and academic standing</p>
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input 
                        type="text" 
                        placeholder="Search Roll No..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="p-3">Roll Number</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">CGPA</th>
                          <th className="p-3">Attendance</th>
                          <th className="p-3">Academic Standing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students
                          .filter(s => s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) || s.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((student) => (
                            <tr key={student.id} className="border-b hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-slate-800">{student.roll_number}</td>
                              <td className="p-3 font-medium text-slate-900">{student.full_name}</td>
                              <td className="p-3 font-mono font-bold text-slate-800">{Number(student.cgpa).toFixed(2)}</td>
                              <td className="p-3">{student.attendance_percent}%</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  student.cgpa >= 3.0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {student.academic_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
