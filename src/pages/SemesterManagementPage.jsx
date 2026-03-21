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
    if (response.status === 404 && response.url.includes('/api/semesters')) {
      throw new Error(
        'Không tìm thấy API Semesters. Kiểm tra backend đang chạy và cấu hình proxy/API base URL.',
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

const semesterApi = {
  async getAll() {
    const response = await fetch(buildApiUrl('/api/semesters'))
    return parseResponse(response)
  },
  async getById(id) {
    const response = await fetch(buildApiUrl(`/api/semesters/${id}`))
    return parseResponse(response)
  },
  async create(payload) {
    const response = await fetch(buildApiUrl('/api/semesters'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return parseResponse(response)
  },
  async update(id, payload) {
    const response = await fetch(buildApiUrl(`/api/semesters/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return parseResponse(response)
  },
  async remove(id) {
    const response = await fetch(buildApiUrl(`/api/semesters/${id}`), {
      method: 'DELETE',
    })
    return parseResponse(response)
  },
}

function SemesterManagementPage() {
  const ITEMS_PER_PAGE = 10
  const [semesters, setSemesters] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [message, setMessage] = useState(null)
  const [selectedSemester, setSelectedSemester] = useState(null)
  const [formData, setFormData] = useState({
    id: '',
    semesterName: '',
  })

  const isEditing = Boolean(formData.id)

  const filteredSemesters = semesters.filter((semester) => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return true

    return semester.semesterName?.toLowerCase().includes(keyword)
  })

  const totalPages = Math.max(1, Math.ceil(filteredSemesters.length / ITEMS_PER_PAGE))
  const paginatedSemesters = filteredSemesters.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const resetForm = () => {
    setFormData({ id: '', semesterName: '' })
  }

  const loadSemesters = async () => {
    try {
      setIsLoading(true)
      setMessage(null)
      const data = await semesterApi.getAll()
      setSemesters(Array.isArray(data) ? data : [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSemesters()
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

    if (!formData.semesterName.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tên học kỳ.' })
      return
    }

    try {
      setIsSubmitting(true)
      setMessage(null)

      const payload = {
        id: formData.id || undefined,
        semesterName: formData.semesterName.trim(),
      }

      if (isEditing) {
        await semesterApi.update(formData.id, payload)
        setMessage({ type: 'success', text: 'Cập nhật học kỳ thành công.' })
      } else {
        await semesterApi.create(payload)
        setMessage({ type: 'success', text: 'Tạo học kỳ thành công.' })
      }

      resetForm()
      setSelectedSemester(null)
      await loadSemesters()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (semester) => {
    setMessage(null)
    setSelectedSemester(semester)
    setFormData({
      id: semester.id,
      semesterName: semester.semesterName || '',
    })
  }

  const handleReadOne = async (semesterId) => {
    try {
      setMessage(null)
      const data = await semesterApi.getById(semesterId)
      setSelectedSemester(data)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handleDelete = async (semesterId) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa học kỳ này?')) return

    try {
      setMessage(null)
      await semesterApi.remove(semesterId)
      if (formData.id === semesterId) resetForm()
      if (selectedSemester?.id === semesterId) setSelectedSemester(null)
      setMessage({ type: 'success', text: 'Xóa học kỳ thành công.' })
      await loadSemesters()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  return (
    <section className="min-h-[calc(100vh-7.5rem)] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Academic Console
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 md:text-3xl">
              Quản lý kì học
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Quản trị danh sách học kỳ và khoảng thời gian chấm điểm.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSemesters}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Tải lại danh sách
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Tổng học kỳ</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{semesters.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Kết quả lọc</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {filteredSemesters.length}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Trạng thái biểu mẫu</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {isEditing ? 'Đang chỉnh sửa' : 'Tạo mới'}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Dữ liệu đang tải</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {isLoading ? 'Đang đồng bộ...' : 'Sẵn sàng'}
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
            {isEditing ? 'Cập nhật học kỳ' : 'Tạo học kỳ mới'}
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tên học kỳ
              </label>
              <input
                name="semesterName"
                value={formData.semesterName}
                onChange={handleInputChange}
                placeholder="Ví dụ: Fall 2024, Học kì I năm học 2024-2025"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-400 transition focus:ring"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? 'Đang xử lý...'
                : isEditing
                  ? 'Lưu cập nhật'
                  : 'Tạo học kỳ'}
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
              <h2 className="text-lg font-semibold text-slate-900">Danh sách học kỳ</h2>
            </div>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo tên học kỳ..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-400 transition focus:ring sm:w-72"
            />
          </div>

          {isLoading ? (
            <p className="px-2 py-6 text-sm text-slate-500">Đang tải dữ liệu...</p>
          ) : filteredSemesters.length === 0 ? (
            <p className="px-2 py-6 text-sm text-slate-500">Chưa có học kỳ nào.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Tên học kỳ
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSemesters.map((semester) => (
                      <tr key={semester.id} className="rounded-lg bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {semester.semesterName}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleReadOne(semester.id)}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(semester)}
                              className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(semester.id)}
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
                  Trang {currentPage}/{totalPages} • {filteredSemesters.length} kết quả
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

      {selectedSemester ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-base font-semibold text-slate-900">Chi tiết học kỳ</h3>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium">ID:</span> {selectedSemester.id}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">Tên học kỳ:</span> {selectedSemester.semesterName}
          </p>
        </div>
      ) : null}
    </section>
  )
}

export default SemesterManagementPage
