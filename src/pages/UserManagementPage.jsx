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
    if (response.status === 404 && response.url.includes('/api/users')) {
      throw new Error(
        'Không tìm thấy API Users. Kiểm tra backend đang chạy và cấu hình proxy/API base URL.',
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

const userApi = {
  async getAll() {
    const response = await fetch(buildApiUrl('/api/users'))
    return parseResponse(response)
  },
  async getById(id) {
    const response = await fetch(buildApiUrl(`/api/users/${id}`))
    return parseResponse(response)
  },
  async create(payload) {
    const response = await fetch(buildApiUrl('/api/users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return parseResponse(response)
  },
  async update(id, payload) {
    const response = await fetch(buildApiUrl(`/api/users/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return parseResponse(response)
  },
  async remove(id) {
    const response = await fetch(buildApiUrl(`/api/users/${id}`), {
      method: 'DELETE',
    })
    return parseResponse(response)
  },
}

function UserManagementPage() {
  const ITEMS_PER_PAGE = 10
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [message, setMessage] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [formData, setFormData] = useState({
    id: '',
    username: '',
    fullName: '',
    role: '',
    isActive: true,
  })

  const isEditing = Boolean(formData.id)

  const filteredUsers = users.filter((user) => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return true

    return (
      user.username?.toLowerCase().includes(keyword) ||
      user.fullName?.toLowerCase().includes(keyword) ||
      user.role?.toLowerCase().includes(keyword)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE))
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const resetForm = () => {
    setFormData({
      id: '',
      username: '',
      fullName: '',
      role: '',
      isActive: true,
    })
  }

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      setMessage(null)
      const data = await userApi.getAll()
      setUsers(Array.isArray(data) ? data : [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
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
    const { name, value, type, checked } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.username.trim() || !formData.fullName.trim() || !formData.role.trim()) {
      setMessage({
        type: 'error',
        text: 'Vui lòng nhập đủ username, họ tên và vai trò.',
      })
      return
    }

    try {
      setIsSubmitting(true)
      setMessage(null)

      const payload = {
        id: formData.id || undefined,
        username: formData.username.trim(),
        fullName: formData.fullName.trim(),
        role: formData.role.trim(),
        isActive: Boolean(formData.isActive),
      }

      if (isEditing) {
        await userApi.update(formData.id, payload)
        setMessage({ type: 'success', text: 'Cập nhật người dùng thành công.' })
      } else {
        await userApi.create(payload)
        setMessage({ type: 'success', text: 'Tạo người dùng thành công.' })
      }

      resetForm()
      setSelectedUser(null)
      await loadUsers()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (user) => {
    setMessage(null)
    setSelectedUser(user)
    setFormData({
      id: user.id,
      username: user.username || '',
      fullName: user.fullName || '',
      role: user.role || '',
      isActive: Boolean(user.isActive),
    })
  }

  const handleReadOne = async (userId) => {
    try {
      setMessage(null)
      const data = await userApi.getById(userId)
      setSelectedUser(data)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handleDelete = async (userId) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa người dùng này?')) return

    try {
      setMessage(null)
      await userApi.remove(userId)
      if (formData.id === userId) resetForm()
      if (selectedUser?.id === userId) setSelectedUser(null)
      setMessage({ type: 'success', text: 'Xóa người dùng thành công.' })
      await loadUsers()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  return (
    <section className="min-h-[calc(100vh-7.5rem)] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              Academic Console
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 md:text-3xl">
              Quản lý người dùng
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Quản trị tài khoản giảng viên và phân quyền sử dụng hệ thống.
            </p>
          </div>
          <button
            type="button"
            onClick={loadUsers}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Tải lại danh sách
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Tổng người dùng</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{users.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Đang hoạt động</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {users.filter((user) => user.isActive).length}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Kết quả lọc</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {filteredUsers.length}
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
            {isEditing ? 'Cập nhật người dùng' : 'Tạo người dùng mới'}
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Username</label>
              <input
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Ví dụ: giangvien01"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Họ và tên</label>
              <input
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Ví dụ: Nguyễn Văn A"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Vai trò</label>
              <input
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                placeholder="Ví dụ: Lecturer, Admin"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleInputChange}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Đang hoạt động
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? 'Đang xử lý...'
                : isEditing
                  ? 'Lưu cập nhật'
                  : 'Tạo người dùng'}
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
              <h2 className="text-lg font-semibold text-slate-900">Danh sách người dùng</h2>
            </div>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo username, họ tên hoặc vai trò..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring sm:w-80"
            />
          </div>

          {isLoading ? (
            <p className="px-2 py-6 text-sm text-slate-500">Đang tải dữ liệu...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="px-2 py-6 text-sm text-slate-500">Chưa có người dùng nào.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Username</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Họ tên</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Vai trò</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Trạng thái</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="rounded-lg bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{user.username}</td>
                        <td className="px-3 py-2 text-slate-700">{user.fullName}</td>
                        <td className="px-3 py-2 text-slate-700">{user.role}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              user.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {user.isActive ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleReadOne(user.id)}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(user.id)}
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
                  Trang {currentPage}/{totalPages} • {filteredUsers.length} kết quả
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

      {selectedUser ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-base font-semibold text-slate-900">Chi tiết người dùng</h3>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium">ID:</span> {selectedUser.id}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">Username:</span> {selectedUser.username}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">Họ tên:</span> {selectedUser.fullName}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">Vai trò:</span> {selectedUser.role}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">Trạng thái:</span>{' '}
            {selectedUser.isActive ? 'Đang hoạt động' : 'Không hoạt động'}
          </p>
        </div>
      ) : null}
    </section>
  )
}

export default UserManagementPage
