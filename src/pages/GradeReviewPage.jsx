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

const formatScore = (value) => {
  if (value === null || value === undefined) return '--'
  const score = Number(value)
  if (Number.isNaN(score)) return '--'
  return score.toFixed(2)
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
        grade.examinerName?.toLowerCase().includes(keyword) ||
        grade.submissionId?.toLowerCase().includes(keyword)

      if (!matchesKeyword) return false

      const score = Number(grade.finalScore)
      if (scoreFilter === 'all' || Number.isNaN(score)) return true
      if (scoreFilter === 'excellent') return score >= 8
      if (scoreFilter === 'good') return score >= 6.5 && score < 8
      if (scoreFilter === 'average') return score >= 5 && score < 6.5
      if (scoreFilter === 'weak') return score < 5

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

  const handleReadDetail = async (id) => {
    try {
      setIsDetailLoading(true)
      setMessage(null)
      const detail = await gradeApi.getById(id)
      setSelectedGrade(detail)
      setEditScore(
        detail?.finalScore === null || detail?.finalScore === undefined
          ? ''
          : String(detail.finalScore),
      )
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
                  <div>
                    <dt className="font-medium text-slate-500">SubmissionId</dt>
                    <dd className="break-all font-mono text-xs text-slate-700">
                      {selectedGrade.submissionId || '--'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">GradeId</dt>
                    <dd className="break-all font-mono text-xs text-slate-700">{selectedGrade.id}</dd>
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
                placeholder="Tìm theo mã SV, giám khảo hoặc SubmissionId..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />

              <select
                value={scoreFilter}
                onChange={(event) => setScoreFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 md:w-52"
              >
                <option value="all">Tất cả mức điểm</option>
                <option value="excellent">Xuất sắc (≥ 8)</option>
                <option value="good">Khá (6.5 - &lt;8)</option>
                <option value="average">Trung bình (5 - &lt;6.5)</option>
                <option value="weak">Yếu (&lt; 5)</option>
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
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">SubmissionId</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
                        Đang tải dữ liệu điểm...
                      </td>
                    </tr>
                  ) : paginatedGrades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Không có dữ liệu phù hợp.
                      </td>
                    </tr>
                  ) : (
                    paginatedGrades.map((grade) => (
                      <tr key={grade.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800">{grade.studentId || '--'}</td>
                        <td className="px-4 py-3 text-slate-700">{grade.examinerName || '--'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatScore(grade.finalScore)}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-slate-600">
                          {grade.submissionId || '--'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleReadDetail(grade.id)}
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
