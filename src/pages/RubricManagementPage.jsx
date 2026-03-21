import { useState, useEffect } from 'react'

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Utility functions
const buildApiUrl = (path) => {
  return new URL(path, VITE_API_BASE_URL).toString()
}

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return await response.json()
  }
  return null
}

// API functions
const rubricApi = {
  getBySessionId: async (sessionId) => {
    const response = await fetch(buildApiUrl(`/api/rubrics/session/${sessionId}`))
    if (!response.ok) {
      const error = await parseResponse(response)
      throw new Error(error?.message || 'Lỗi tải tiêu chí chấm điểm')
    }
    return await parseResponse(response)
  },

  create: async (data) => {
    const response = await fetch(buildApiUrl('/api/rubrics'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await parseResponse(response)
      throw new Error(error?.message || 'Lỗi tạo tiêu chí')
    }
    return await parseResponse(response)
  },

  delete: async (id) => {
    const response = await fetch(buildApiUrl(`/api/rubrics/${id}`), {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await parseResponse(response)
      throw new Error(error?.message || 'Lỗi xóa tiêu chí')
    }
    return true
  },
}

const examSessionApi = {
  getAll: async () => {
    const response = await fetch(buildApiUrl('/api/examsessions'))
    if (!response.ok) {
      throw new Error('Lỗi tải đợt thi')
    }
    return await parseResponse(response)
  },
}

// Main Component
export default function RubricManagementPage() {
  const [examSessions, setExamSessions] = useState([])
  const [rubrics, setRubrics] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [selectedSessionInfo, setSelectedSessionInfo] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [message, setMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedRubric, setSelectedRubric] = useState(null)

  const [formData, setFormData] = useState({
    examsessionid: '',
    criterionname: '',
    maxscore: '',
  })

  const ITEMS_PER_PAGE = 10

  // Load exam sessions on mount
  useEffect(() => {
    const loadExamSessions = async () => {
      try {
        setIsLoadingSession(true)
        const data = await examSessionApi.getAll()
        setExamSessions(Array.isArray(data) ? data : [])
      } catch (error) {
        setMessage({ type: 'error', text: error.message })
      } finally {
        setIsLoadingSession(false)
      }
    }
    loadExamSessions()
  }, [])

  // Load rubrics when session selected
  useEffect(() => {
    if (selectedSessionId) {
      loadRubricsBySession(selectedSessionId)
    } else {
      setRubrics([])
      setCurrentPage(1)
    }
  }, [selectedSessionId])

  const loadRubricsBySession = async (sessionId) => {
    try {
      setIsLoading(true)
      const data = await rubricApi.getBySessionId(sessionId)
      setRubrics(Array.isArray(data) ? data : [])
      setCurrentPage(1)
      setSelectedRubric(null)
      
      // Get session info for display
      const session = examSessions.find(s => s.id === sessionId)
      if (session) {
        setSelectedSessionInfo(session)
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
      setRubrics([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSessionChange = (e) => {
    const sessionId = e.target.value
    setSelectedSessionId(sessionId)
    setFormData({
      examsessionid: sessionId,
      criterionname: '',
      maxscore: '',
    })
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!formData.criterionname.trim()) {
      setMessage({ type: 'error', text: 'Tên tiêu chí không được để trống' })
      return
    }

    if (!formData.maxscore || parseFloat(formData.maxscore) <= 0) {
      setMessage({ type: 'error', text: 'Điểm tối đa phải lớn hơn 0' })
      return
    }

    if (!selectedSessionId) {
      setMessage({ type: 'error', text: 'Vui lòng chọn đợt thi' })
      return
    }

    try {
      setIsLoading(true)
      const payload = {
        examSessionId: selectedSessionId,
        criterionName: formData.criterionname.trim(),
        maxScore: parseFloat(formData.maxscore),
      }

      await rubricApi.create(payload)
      setMessage({ type: 'success', text: 'Tạo tiêu chí thành công' })
      setFormData({
        examsessionid: selectedSessionId,
        criterionname: '',
        maxscore: '',
      })
      await loadRubricsBySession(selectedSessionId)
      setShowDetail(false)
      setSelectedRubric(null)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Bạn chắc chắn muốn xóa tiêu chí này?')) return

    try {
      setIsLoading(true)
      await rubricApi.delete(id)
      setMessage({ type: 'success', text: 'Xóa tiêu chí thành công' })
      await loadRubricsBySession(selectedSessionId)
      setShowDetail(false)
      setSelectedRubric(null)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectRubric = (rubric) => {
    setSelectedRubric(rubric)
    setShowDetail(true)
  }

  // Filter and paginate
  const filteredRubrics = rubrics.filter((rubric) => {
    const search = searchTerm.toLowerCase()
    return rubric.criterionName.toLowerCase().includes(search)
  })

  const totalPages = Math.ceil(filteredRubrics.length / ITEMS_PER_PAGE)
  const paginatedRubrics = filteredRubrics.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Auto-adjust current page if it exceeds totalPages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [searchTerm, rubrics])

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tiêu chí chấm điểm</h1>
        <p className="mt-1 text-sm text-slate-600">
          Quản lý tiêu chí và điểm tối đa cho từng đợt thi
        </p>
      </div>

      {/* Message Alert */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Session Selector */}
      <div className="grid gap-4">
        <div>
          <label htmlFor="session-select" className="block text-sm font-medium text-slate-700">
            Chọn đợt thi <span className="text-red-500">*</span>
          </label>
          <select
            id="session-select"
            value={selectedSessionId}
            onChange={handleSessionChange}
            disabled={isLoadingSession}
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">-- Vui lòng chọn đợt thi --</option>
            {examSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.examName} ({session.subjectCode} - {session.semesterName})
              </option>
            ))}
          </select>
        </div>

        {/* Session Info Card */}
        {selectedSessionInfo && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-violet-700">Đợt thi</p>
                <p className="text-violet-900">{selectedSessionInfo.examName}</p>
              </div>
              <div>
                <p className="font-medium text-violet-700">Môn học</p>
                <p className="text-violet-900">{selectedSessionInfo.subjectName}</p>
              </div>
              <div>
                <p className="font-medium text-violet-700">Kỳ học</p>
                <p className="text-violet-900">{selectedSessionInfo.semesterName}</p>
              </div>
              <div>
                <p className="font-medium text-violet-700">Thời gian</p>
                <p className="text-violet-900">
                  {new Date(selectedSessionInfo.startDate).toLocaleDateString('vi-VN')} -
                  {new Date(selectedSessionInfo.endDate).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      {selectedSessionId && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Form Panel */}
          <div className="lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Thêm tiêu chí</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="criterion-name" className="block text-sm font-medium text-slate-700">
                    Tên tiêu chí <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="criterion-name"
                    type="text"
                    name="criterionname"
                    value={formData.criterionname}
                    onChange={handleInputChange}
                    placeholder="Ví dụ: Nộp đúng hạn, Chất lượng code..."
                    disabled={isLoading}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="max-score" className="block text-sm font-medium text-slate-700">
                    Điểm tối đa <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="max-score"
                    type="number"
                    name="maxscore"
                    value={formData.maxscore}
                    onChange={handleInputChange}
                    placeholder="Ví dụ: 10, 20..."
                    step="0.01"
                    min="0"
                    disabled={isLoading}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !selectedSessionId}
                  className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? 'Đang xử lý...' : 'Thêm tiêu chí'}
                </button>
              </form>

              {/* Metrics */}
              <div className="mt-6 grid gap-3 border-t border-slate-200 pt-6">
                <div className="rounded-lg bg-violet-50 p-3">
                  <p className="text-xs font-medium text-violet-600">Tổng tiêu chí</p>
                  <p className="mt-1 text-2xl font-bold text-violet-700">{rubrics.length}</p>
                </div>
                <div className="rounded-lg bg-indigo-50 p-3">
                  <p className="text-xs font-medium text-indigo-600">Kết quả lọc</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-700">{filteredRubrics.length}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-xs font-medium text-slate-600">Tổng điểm</p>
                  <p className="mt-1 text-2xl font-bold text-slate-700">
                    {rubrics.reduce((sum, r) => sum + (r.maxScore || 0), 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Table Panel */}
          <div className="lg:col-span-8">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* Search Bar */}
              <div className="border-b border-slate-200 px-6 py-4">
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên tiêu chí..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">
                        Tiêu chí
                      </th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">
                        Điểm tối đa
                      </th>
                      <th className="px-6 py-3 text-center font-semibold text-slate-900">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && !selectedRubric ? (
                      <tr>
                        <td colSpan="3" className="px-6 py-8 text-center text-slate-600">
                          Đang tải...
                        </td>
                      </tr>
                    ) : paginatedRubrics.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-6 py-8 text-center text-slate-600">
                          {rubrics.length === 0
                            ? 'Chưa có tiêu chí nào cho đợt thi này'
                            : 'Không tìm thấy tiêu chí phù hợp'}
                        </td>
                      </tr>
                    ) : (
                      paginatedRubrics.map((rubric) => (
                        <tr
                          key={rubric.id}
                          className="border-b border-slate-200 transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-3 font-medium text-slate-900">
                            {rubric.criterionName}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-700">
                            {rubric.maxScore.toFixed(2)} điểm
                          </td>
                          <td className="px-6 py-3 text-center">
                            <button
                              onClick={() => handleSelectRubric(rubric)}
                              className="inline-flex items-center rounded-lg bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700 transition hover:bg-violet-200"
                            >
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {paginatedRubrics.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <span className="text-sm text-slate-600">
                    Trang {currentPage}/{totalPages} • {filteredRubrics.length} kết quả
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {showDetail && selectedRubric && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Chi tiết tiêu chí</h3>
            <button
              onClick={() => {
                setShowDetail(false)
                setSelectedRubric(null)
              }}
              className="text-slate-500 transition hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 border-t border-slate-200 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-600">ID</p>
              <p className="mt-1 font-mono text-sm text-slate-900">{selectedRubric.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Tên tiêu chí</p>
              <p className="mt-1 text-slate-900">{selectedRubric.criterionName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Điểm tối đa</p>
              <p className="mt-1 text-slate-900">{selectedRubric.maxScore.toFixed(2)} điểm</p>
            </div>

            <button
              onClick={() => handleDelete(selectedRubric.id)}
              disabled={isLoading}
              className="mt-6 w-full rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Đang xóa...' : 'Xóa tiêu chí'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
