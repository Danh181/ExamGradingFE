import { useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import FPTLogo from './components/FPTLogo'
import HomePage from './pages/HomePage'
import SubjectManagementPage from './pages/SubjectManagementPage'
import SemesterManagementPage from './pages/SemesterManagementPage'
import UserManagementPage from './pages/UserManagementPage'
import ExamSessionManagementPage from './pages/ExamSessionManagementPage'
import RubricManagementPage from './pages/RubricManagementPage'
import GradeReviewPage from './pages/GradeReviewPage'

const navItems = [
  { key: 'grading', label: 'Chấm điểm', path: '/' },
  { key: 'grades', label: 'Xem điểm', path: '/grades' },
  { key: 'users', label: 'Quản lý người dùng', path: '/users' },
  { key: 'subjects', label: 'Quản lý môn học', path: '/subjects' },
  { key: 'semesters', label: 'Quản lý kì', path: '/semesters' },
  { key: 'exam-sessions', label: 'Quản lý đợt thi', path: '/exam-sessions' },
  { key: 'rubrics', label: 'Tiêu chí chấm điểm', path: '/rubrics' },
]

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()
  const isFullWidthPage =
    location.pathname.startsWith('/grades') ||
    location.pathname.startsWith('/subjects') ||
    location.pathname.startsWith('/semesters') ||
    location.pathname.startsWith('/users') ||
    location.pathname.startsWith('/exam-sessions') ||
    location.pathname.startsWith('/rubrics')

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full items-center justify-between px-4 md:px-6">
          <Link
            to="/"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:bg-slate-100"
            aria-label="Về trang chủ"
          >
            <FPTLogo />
          </Link>

          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-100 md:hidden"
            aria-label="Mở điều hướng"
          >
            <span className="sr-only">Mở điều hướng</span>
            <div className="space-y-1.5">
              <span className="block h-0.5 w-5 rounded bg-slate-700" />
              <span className="block h-0.5 w-5 rounded bg-slate-700" />
              <span className="block h-0.5 w-5 rounded bg-slate-700" />
            </div>
          </button>
        </div>
      </header>

      <div className="pt-16 md:flex">
        <aside
          className={`fixed inset-y-16 left-0 z-50 w-72 border-r border-slate-200 bg-white p-5 shadow-xl transition-transform duration-300 md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:translate-x-0 md:shadow-none ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Điều hướng</h2>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 transition hover:bg-slate-100 md:hidden"
            >
              Đóng
            </button>
          </div>

          <nav>
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      isActive(item.path)
                        ? 'bg-violet-100 text-violet-700'
                        : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {isSidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Đóng điều hướng"
          />
        ) : null}

        <div className="w-full">
          <div
            className={`mx-auto w-full px-4 py-8 md:px-8 md:py-10 ${
              isFullWidthPage ? 'max-w-[1500px]' : 'max-w-6xl'
            }`}
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/grades" element={<GradeReviewPage />} />
              <Route path="/subjects" element={<SubjectManagementPage />} />
              <Route path="/semesters" element={<SemesterManagementPage />} />
              <Route path="/users" element={<UserManagementPage />} />
              <Route path="/exam-sessions" element={<ExamSessionManagementPage />} />
              <Route path="/rubrics" element={<RubricManagementPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
