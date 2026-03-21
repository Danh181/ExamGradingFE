import { useEffect, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const buildApiUrl = (path) =>
  API_BASE_URL ? `${API_BASE_URL}${path}` : path

async function parseResponse(response) {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    if (response.status === 404 && response.url.includes('/api/examsessions')) {
      throw new Error(
        'Không tìm thấy API ExamSessions. Kiểm tra backend đang chạy và cấu hình proxy/API base URL.',
      )
    }

    const message =
      typeof body === 'string'
        ? body
        : body?.message || 'Yêu cầu thất bại. Vui lòng thử lại.'
    throw new Error(message)
  }

  return body
}

const examSessionApi = {
  async getAll() {
    const response = await fetch(buildApiUrl('/api/examsessions'))
    return parseResponse(response)
  },
  async getById(id) {
    const response = await fetch(buildApiUrl(`/api/examsessions/${id}`))
    return parseResponse(response)
  },
  async create(payload) {
    const response = await fetch(buildApiUrl('/api/examsessions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return parseResponse(response)
  },
  async update(id, payload) {
    const response = await fetch(buildApiUrl(`/api/examsessions/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return parseResponse(response)
  },
  async remove(id) {
    const response = await fetch(buildApiUrl(`/api/examsessions/${id}`), {
      method: 'DELETE',
    })
    return parseResponse(response)
  },
}

const subjectApi = {
  async getAll() {
    const response = await fetch(buildApiUrl('/api/subjects'))
    return parseResponse(response)
  },
}

const semesterApi = {
  async getAll() {
    const response = await fetch(buildApiUrl('/api/semesters'))
    return parseResponse(response)
  },
}

const formatDateInput = (value) => {
  if (!value) return ''
  return String(value).split('T')[0]
}

const formatDateDisplay = (value) => {
  if (!value) return '--'
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime())
    ? '--'
    : parsedDate.toLocaleDateString('vi-VN')
}

function ExamSessionManagementPage() {
  const ITEMS_PER_PAGE = 10

  const [examSessions, setExamSessions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [semesters, setSemesters] = useState([])

  const [isLoading, setIsLoading] = useState(true)
  const [isLookupLoading, setIsLookupLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [message, setMessage] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)

  const [formData, setFormData] = useState({
    id: '',
    subjectId: '',
    semesterId: '',
    examName: '',
    startDate: '',
    endDate: '',
  })

  const isEditing = Boolean(formData.id)

  const filteredSessions = examSessions.filter((session) => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return true

    return (
      session.examName?.toLowerCase().includes(keyword) ||
      session.subjectCode?.toLowerCase().includes(keyword) ||
      session.subjectName?.toLowerCase().includes(keyword) ||
      session.semesterName?.toLowerCase().includes(keyword)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / ITEMS_PER_PAGE))
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const resetForm = () => {
    setFormData({
      id: '',
      subjectId: '',
      semesterId: '',
      examName: '',
      startDate: '',
      endDate: '',
    })
  }

  const loadExamSessions = async () => {
    try {
      setIsLoading(true)
      setMessage(null)
      const data = await examSessionApi.getAll()
      setExamSessions(Array.isArray(data) ? data : [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const loadAllData = async () => {
    try {
      setIsLoading(true)
      setIsLookupLoading(true)
      setMessage(null)

      const [sessionData, subjectData, semesterData] = await Promise.all([
        examSessionApi.getAll(),
        subjectApi.getAll(),
        semesterApi.getAll(),
      ])

      setExamSessions(Array.isArray(sessionData) ? sessionData : [])
      setSubjects(Array.isArray(subjectData) ? subjectData : [])
      setSemesters(Array.isArray(semesterData) ? semesterData : [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsLoading(false)
      setIsLookupLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (
      !formData.subjectId ||
      !formData.semesterId ||
      !formData.examName.trim() ||
      !formData.startDate ||
      !formData.endDate
    ) {
      setMessage({
        type: 'error',
        text: 'Vui lòng nhập đầy đủ môn học, kỳ học, tên đợt thi, ngày bắt đầu và ngày kết thúc.',
      })
      return
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setMessage({ type: 'error', text: 'Ngày kết thúc phải lớn hơn ngày bắt đầu.' })
      return
    }

    try {
      setIsSubmitting(true)
      setMessage(null)

      const payload = {
        id: formData.id || undefined,
        subjectId: formData.subjectId,
        semesterId: formData.semesterId,
        examName: formData.examName.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
      }

      if (isEditing) {
        await examSessionApi.update(formData.id, payload)
        setMessage({ type: 'success', text: 'Cập nhật đợt thi thành công.' })
      } else {
        await examSessionApi.create(payload)
        setMessage({ type: 'success', text: 'Tạo đợt thi thành công.' })
      }

      resetForm()
      setSelectedSession(null)
      await loadExamSessions()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (session) => {
    setMessage(null)
    setSelectedSession(session)
    setFormData({
      id: session.id,
      subjectId: session.subjectId || '',
      semesterId: session.semesterId || '',
      examName: session.examName || '',
      startDate: formatDateInput(session.startDate),
      endDate: formatDateInput(session.endDate),
    })
  }

  const handleReadOne = async (sessionId) => {
    try {
      setMessage(null)
      const data = await examSessionApi.getById(sessionId)
      setSelectedSession(data)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handleDelete = async (sessionId) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa đợt thi này?')) return

    try {
      setMessage(null)
      await examSessionApi.remove(sessionId)
      if (formData.id === sessionId) resetForm()
      if (selectedSession?.id === sessionId) setSelectedSession(null)
      setMessage({ type: 'success', text: 'Xóa đợt thi thành công.' })
      await loadExamSessions()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  return (
    <section className="min-h-[calc(100vh-7.5rem)] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Academic Console
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 md:text-3xl">
              Quản lý đợt thi
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Quản trị các đợt thi theo môn học và học kỳ, phục vụ phân công và chấm điểm.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAllData}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Tải lại dữ liệu
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Tổng đợt thi</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{examSessions.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Kết quả lọc</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {filteredSessions.length}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Dữ liệu danh mục</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {isLookupLoading ? 'Đang tải...' : 'Sẵn sàng'}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Trạng thái biểu mẫu</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {isEditing ? 'Đang chỉnh sửa' : 'Tạo mới'}
            </p>
          </article>
        </div>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-slate-50 p-5 lg:col-span-4"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditing ? 'Cập nhật đợt thi' : 'Tạo đợt thi mới'}
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Môn học</label>
              <select
                name="subjectId"
                value={formData.subjectId}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-400 transition focus:ring"
              >
                <option value="">Chọn môn học</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.subjectCode} - {subject.subjectName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Kỳ học</label>
              <select
                name="semesterId"
                value={formData.semesterId}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-400 transition focus:ring"
              >
                <option value="">Chọn kỳ học</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.semesterName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tên đợt thi
              </label>
              <input
                name="examName"
                value={formData.examName}
                onChange={handleInputChange}
                placeholder="Ví dụ: Midterm PRN232"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-400 transition focus:ring"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Ngày bắt đầu
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-400 transition focus:ring"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Ngày kết thúc
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-400 transition focus:ring"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting || isLookupLoading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? 'Đang xử lý...'
                : isEditing
                  ? 'Lưu cập nhật'
                  : 'Tạo đợt thi'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Làm mới form
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-3 lg:col-span-8">
          <div className="space-y-3 px-2 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Danh sách đợt thi</h2>
            </div>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo tên đợt thi, môn học, kỳ học..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-400 transition focus:ring sm:w-80"
            />
          </div>

          {isLoading ? (
            <p className="px-2 py-6 text-sm text-slate-500">Đang tải dữ liệu...</p>
          ) : filteredSessions.length === 0 ? (
            <p className="px-2 py-6 text-sm text-slate-500">Chưa có đợt thi nào.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Đợt thi</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Môn học</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Kỳ học</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Bắt đầu</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Kết thúc</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSessions.map((session) => (
                      <tr key={session.id} className="rounded-lg bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{session.examName}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {session.subjectCode || '--'} {session.subjectName ? `- ${session.subjectName}` : ''}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{session.semesterName || '--'}</td>
                        <td className="px-3 py-2 text-slate-700">{formatDateDisplay(session.startDate)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatDateDisplay(session.endDate)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleReadOne(session.id)}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(session)}
                              className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(session.id)}
                              className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2 pb-2">
                <p className="text-xs text-slate-500">
                  Trang {currentPage}/{totalPages} • {filteredSessions.length} kết quả
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedSession ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-base font-semibold text-slate-900">Chi tiết đợt thi</h3>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium">ID:</span> {selectedSession.id}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">Tên đợt thi:</span> {selectedSession.examName}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">Môn học:</span> {selectedSession.subjectName || '--'}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">Kỳ học:</span> {selectedSession.semesterName || '--'}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">Thời gian:</span>{' '}
            {formatDateDisplay(selectedSession.startDate)} - {formatDateDisplay(selectedSession.endDate)}
          </p>
        </div>
      ) : null}
    </section>
  )
}

export default ExamSessionManagementPage
