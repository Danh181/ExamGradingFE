import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const buildApiUrl = (path) => (API_BASE_URL ? `${API_BASE_URL}${path}` : path)

async function parseResponse(response) {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    if (response.status === 404 && response.url.includes('/api/grades')) {
      throw new Error(
        'Không tìm thấy API Grades. Kiểm tra backend đã chạy và cấu hình API base URL.',
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

const gradeApi = {
  async getAll() {
    const response = await fetch(buildApiUrl('/api/grades'))
    return parseResponse(response)
  },
  async getById(id) {
    const response = await fetch(buildApiUrl(`/api/grades/${id}`))
    return parseResponse(response)
  },
  async update(id, payload) {
    const response = await fetch(buildApiUrl(`/api/grades/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return parseResponse(response)
  },
  async remove(id) {
    const response = await fetch(buildApiUrl(`/api/grades/${id}`), {
      method: 'DELETE',
    })
    return parseResponse(response)
  },
}

async function tryGet(path) {
  const response = await fetch(buildApiUrl(path))

  if (response.status === 404) {
    return { found: false, data: null }
  }

  const data = await parseResponse(response)
  return { found: true, data }
}

const normalizeReportId = (detail) => {
  return (
    detail?.analysisReportId ||
    detail?.reportId ||
    detail?.analysisReport?.id ||
    detail?.analysisReport?.analysisReportId ||
    null
  )
}

const submissionApi = {
  async getById(submissionId) {
    if (!submissionId) return null

    const candidates = [
      `/api/submissions/${submissionId}`,
      `/api/Submissions/${submissionId}`,
    ]

    for (const path of candidates) {
      const result = await tryGet(path)
      if (!result.found) continue
      return result.data || null
    }

    return null
  },
}

const userApi = {
  async getById(userId) {
    if (!userId) return null

    const candidates = [`/api/users/${userId}`, `/api/Users/${userId}`]

    for (const path of candidates) {
      const result = await tryGet(path)
      if (!result.found) continue
      return result.data || null
    }

    return null
  },
}

const analysisReportApi = {
  async getBySubmissionId(submissionId) {
    if (!submissionId) return null

    const candidates = [
      `/api/analysisreports/submission/${submissionId}`,
      `/api/AnalysisReports/submission/${submissionId}`,
    ]

    for (const path of candidates) {
      const result = await tryGet(path)
      if (!result.found) continue

      if (Array.isArray(result.data)) return result.data[0] || null
      return result.data || null
    }

    return null
  },
}

const violationApi = {
  async getAll() {
    const listCandidates = ['/api/violations', '/api/Violations']

    for (const path of listCandidates) {
      const result = await tryGet(path)
      if (!result.found) continue

      return Array.isArray(result.data) ? result.data : []
    }

    return []
  },

  async getByReportId(reportId) {
    if (!reportId) return []

    const reportRouteCandidates = [
      `/api/violations/report/${reportId}`,
      `/api/Violations/report/${reportId}`,
    ]

    for (const path of reportRouteCandidates) {
      const result = await tryGet(path)
      if (!result.found) continue

      return Array.isArray(result.data) ? result.data : []
    }

    const byIdCandidates = [`/api/violations/${reportId}`, `/api/Violations/${reportId}`]
    for (const path of byIdCandidates) {
      const result = await tryGet(path)
      if (!result.found) continue

      if (!result.data) return []
      return [result.data]
    }

    const list = await this.getAll()
    return list.filter(
      (item) =>
        String(item?.analysisReportId || '').toLowerCase() ===
        String(reportId || '').toLowerCase(),
    )

    return []
  },
}

const formatScore = (value) => {
  if (value === null || value === undefined) return '--'
  const score = Number(value)
  if (Number.isNaN(score)) return '--'
  return score.toFixed(2)
}

const getScoreColorClass = (value) => {
  const score = Number(value)
  if (Number.isNaN(score)) return 'text-slate-900'

  if (score === 0) return 'text-red-600'
  if (score >= 0.25 && score <= 4) return 'text-orange-600'
  if (score >= 4.25 && score <= 6.75) return 'text-amber-500'
  if (score >= 7 && score <= 10) return 'text-emerald-600'

  return 'text-slate-900'
}

function GradeReviewPage() {
  const ITEMS_PER_PAGE = 10

  const [grades, setGrades] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedGrade, setSelectedGrade] = useState(null)
  const [scoreFilter, setScoreFilter] = useState('all')
  const [scoreSort, setScoreSort] = useState('none')
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editScore, setEditScore] = useState('')
  const [violations, setViolations] = useState([])
  const [isViolationsLoading, setIsViolationsLoading] = useState(false)
  const [violationsError, setViolationsError] = useState('')

  const loadGrades = async () => {
    try {
      setIsLoading(true)
      setMessage(null)
      const data = await gradeApi.getAll()
      setGrades(Array.isArray(data) ? data : [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadGrades()
  }, [])

  const filteredGrades = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return grades.filter((grade) => {
      const matchesKeyword =
        !keyword ||
        grade.studentId?.toLowerCase().includes(keyword) ||
        grade.examinerName?.toLowerCase().includes(keyword)

      if (!matchesKeyword) return false

      const score = Number(grade.finalScore)
      if (scoreFilter === 'all' || Number.isNaN(score)) return true
      if (scoreFilter === 'zero') return score === 0
      if (scoreFilter === 'orange') return score >= 0.25 && score <= 4
      if (scoreFilter === 'yellow') return score >= 4.25 && score <= 6.75
      if (scoreFilter === 'green') return score >= 7 && score <= 10

      return true
    })
  }, [grades, searchTerm, scoreFilter])

  const sortedGrades = useMemo(() => {
    if (scoreSort === 'none') return filteredGrades

    const sorted = [...filteredGrades]
    sorted.sort((a, b) => {
      const scoreA = Number(a.finalScore)
      const scoreB = Number(b.finalScore)

      const safeScoreA = Number.isNaN(scoreA) ? -1 : scoreA
      const safeScoreB = Number.isNaN(scoreB) ? -1 : scoreB

      if (scoreSort === 'asc') return safeScoreA - safeScoreB
      return safeScoreB - safeScoreA
    })

    return sorted
  }, [filteredGrades, scoreSort])

  const totalPages = Math.max(1, Math.ceil(sortedGrades.length / ITEMS_PER_PAGE))
  const paginatedGrades = sortedGrades.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const averageScore = useMemo(() => {
    if (grades.length === 0) return 0

    const scores = grades
      .map((item) => Number(item.finalScore))
      .filter((item) => !Number.isNaN(item))

    if (scores.length === 0) return 0

    return scores.reduce((sum, item) => sum + item, 0) / scores.length
  }, [grades])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, scoreFilter, scoreSort])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleReadDetail = async (gradeItem) => {
    try {
      setIsDetailLoading(true)
      setMessage(null)
      setViolations([])
      setViolationsError('')

      const detail = await gradeApi.getById(gradeItem.id)

      const mergedDetail = {
        ...detail,
        studentId: detail?.studentId || gradeItem?.studentId || '',
        examinerName: detail?.examinerName || gradeItem?.examinerName || '',
      }

      setSelectedGrade(mergedDetail)
      setEditScore(
        detail?.finalScore === null || detail?.finalScore === undefined
          ? ''
          : String(detail.finalScore),
      )

      setIsViolationsLoading(true)
      try {
        if (!detail?.submissionId) {
          setViolations([])
          setViolationsError('Bản ghi điểm chưa có SubmissionId để truy vấn vi phạm.')
          return
        }

        const submission = await submissionApi.getById(detail.submissionId)
        if (!submission?.id) {
          setViolations([])
          setViolationsError('Không tìm thấy Submission tương ứng cho bản ghi điểm này.')
          return
        }

        if (!mergedDetail.studentId && submission?.studentId) {
          mergedDetail.studentId = submission.studentId
          setSelectedGrade((prev) => ({ ...(prev || {}), studentId: submission.studentId }))
        }

        if (!mergedDetail.examinerName && detail?.examinerId) {
          const examiner = await userApi.getById(detail.examinerId)
          if (examiner?.fullName) {
            mergedDetail.examinerName = examiner.fullName
            setSelectedGrade((prev) => ({ ...(prev || {}), examinerName: examiner.fullName }))
          }
        }

        const report = await analysisReportApi.getBySubmissionId(submission.id)
        const reportId = report?.id || normalizeReportId(detail)

        if (!reportId) {
          setViolations([])
          setViolationsError(
            'Không có AnalysisReport cho bài nộp này nên chưa có vi phạm để hiển thị.',
          )
          return
        }

        const violationData = await violationApi.getByReportId(reportId)
        setViolations(Array.isArray(violationData) ? violationData : [])
      } catch (error) {
        setViolationsError(error.message || 'Không thể tải danh sách vi phạm.')
      } finally {
        setIsViolationsLoading(false)
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleUpdateGrade = async () => {
    if (!selectedGrade?.id) return

    const parsedScore = Number(editScore)
    if (editScore === '' || Number.isNaN(parsedScore) || parsedScore < 0) {
      setMessage({
        type: 'error',
        text: 'Điểm không hợp lệ. Vui lòng nhập số lớn hơn hoặc bằng 0.',
      })
      return
    }

    if (!selectedGrade.submissionId || !selectedGrade.examinerId) {
      setMessage({
        type: 'error',
        text: 'Thiếu SubmissionId hoặc ExaminerId để cập nhật điểm.',
      })
      return
    }

    try {
      setIsUpdating(true)
      setMessage(null)

      const payload = {
        id: selectedGrade.id,
        submissionId: selectedGrade.submissionId,
        examinerId: selectedGrade.examinerId,
        finalScore: parsedScore,
      }

      await gradeApi.update(selectedGrade.id, payload)

      const updatedDetail = await gradeApi.getById(selectedGrade.id)
      setSelectedGrade(updatedDetail)
      setEditScore(String(updatedDetail?.finalScore ?? ''))
      await loadGrades()

      setMessage({ type: 'success', text: 'Cập nhật điểm thành công.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteGrade = async (id) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa bản ghi điểm này?')) return

    try {
      setIsDeleting(true)
      setMessage(null)
      await gradeApi.remove(id)
      if (selectedGrade?.id === id) {
        setSelectedGrade(null)
        setEditScore('')
      }
      await loadGrades()
      setMessage({ type: 'success', text: 'Xóa bản ghi điểm thành công.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsDeleting(false)
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
              Xem điểm sinh viên
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Theo dõi điểm cuối cùng theo từng bài nộp và giám khảo chấm điểm.
            </p>
          </div>
          <button
            type="button"
            onClick={loadGrades}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Tải lại danh sách
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Tổng bản ghi điểm</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{grades.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Điểm trung bình</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{averageScore.toFixed(2)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Điểm đạt (≥5)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {grades.filter((grade) => Number(grade.finalScore) >= 5).length}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Kết quả lọc</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{filteredGrades.length}</p>
          </article>
        </div>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            message.type === 'error'
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-base font-semibold text-slate-900">Chi tiết điểm</h2>
            <p className="mt-1 text-sm text-slate-600">Bấm “Xem” trong bảng để mở chi tiết.</p>

            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              {isDetailLoading ? (
                <p className="text-sm text-slate-600">Đang tải chi tiết...</p>
              ) : !selectedGrade ? (
                <p className="text-sm text-slate-500">Chưa chọn bản ghi điểm nào.</p>
              ) : (
                <div className="space-y-5">
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="font-medium text-slate-500">Mã sinh viên</dt>
                      <dd className="text-slate-900">{selectedGrade.studentId || '--'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Giám khảo</dt>
                      <dd className="text-slate-900">{selectedGrade.examinerName || '--'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Điểm cuối cùng</dt>
                      <dd className="text-slate-900">{formatScore(selectedGrade.finalScore)}</dd>
                    </div>
                    <div>
                      <label className="font-medium text-slate-500" htmlFor="edit-score">
                        Cập nhật điểm
                      </label>
                      <input
                        id="edit-score"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editScore}
                        onChange={(event) => setEditScore(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleUpdateGrade}
                        disabled={isUpdating || isDeleting}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isUpdating ? 'Đang lưu...' : 'Lưu điểm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGrade(selectedGrade.id)}
                        disabled={isUpdating || isDeleting}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDeleting ? 'Đang xóa...' : 'Xóa điểm'}
                      </button>
                    </div>
                  </dl>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-amber-900">Vi phạm phát hiện</h3>
                      <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        {isViolationsLoading ? 'Đang tải...' : `${violations.length} mục`}
                      </span>
                    </div>

                    {violationsError ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {violationsError}
                      </p>
                    ) : isViolationsLoading ? (
                      <p className="text-xs text-slate-600">Đang tải danh sách vi phạm...</p>
                    ) : violations.length === 0 ? (
                      <p className="text-xs text-emerald-700">
                        Không có vi phạm cho bài nộp này hoặc chưa có báo cáo phân tích.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {violations.map((violation) => (
                          <li
                            key={violation.id}
                            className="rounded-lg border border-amber-200 bg-white p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-900">
                                {violation.violationType || 'Vi phạm chưa phân loại'}
                              </p>
                              <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                                -{formatScore(violation.penaltyPoints)} điểm
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              {violation.description || 'Không có mô tả chi tiết.'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm theo mã SV hoặc giám khảo..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />

              <select
                value={scoreFilter}
                onChange={(event) => setScoreFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 md:w-52"
              >
                <option value="all">Tất cả mức điểm</option>
                <option value="zero">0 điểm (màu đỏ)</option>
                <option value="orange">0.25 - 4 điểm (màu cam)</option>
                <option value="yellow">4.25 - 6.75 điểm (màu vàng)</option>
                <option value="green">7 - 10 điểm (màu xanh lá)</option>
              </select>

              <select
                value={scoreSort}
                onChange={(event) => setScoreSort(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 md:w-52"
              >
                <option value="none">Sắp xếp điểm</option>
                <option value="asc">Điểm: thấp đến cao</option>
                <option value="desc">Điểm: cao đến thấp</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Mã sinh viên</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Giám khảo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Điểm</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-600">
                        Đang tải dữ liệu điểm...
                      </td>
                    </tr>
                  ) : paginatedGrades.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Không có dữ liệu phù hợp.
                      </td>
                    </tr>
                  ) : (
                    paginatedGrades.map((grade) => (
                      <tr key={grade.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800">{grade.studentId || '--'}</td>
                        <td className="px-4 py-3 text-slate-700">{grade.examinerName || '--'}</td>
                        <td className={`px-4 py-3 font-semibold ${getScoreColorClass(grade.finalScore)}`}>
                          {formatScore(grade.finalScore)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleReadDetail(grade)}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trước
              </button>
              <p className="text-sm text-slate-600">
                Trang {currentPage}/{totalPages} • {filteredGrades.length} kết quả
              </p>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default GradeReviewPage
