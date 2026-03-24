import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../services/authApi'
import FPTLogo from '../components/FPTLogo'

export default function LoginPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.username || !formData.password) {
      setError('Vui lòng nhập username và mật khẩu')
      return
    }

    setLoading(true)

    try {
      const result = await authApi.login({
        username: formData.username,
        password: formData.password,
      })

      // Lưu token
      if (result.token) {
        authApi.setToken(result.token)
        // Chuyển hướng tới trang chủ
        navigate('/')
      } else {
        setError('Không nhận được token từ server')
      }
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center rounded-xl border border-violet-200 bg-white px-4 py-3 shadow-sm">
            <FPTLogo />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <h1 className="mb-2 text-center text-2xl font-bold text-slate-900">
            Đăng nhập
          </h1>
          <p className="mb-6 text-center text-sm text-slate-600">
            Hệ thống chấm điểm đề thi tự động
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Tên đăng nhập
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Nhập tên đăng nhập"
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-500 transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Nhập mật khẩu"
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-500 transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 flex items-center justify-center gap-1 text-sm text-slate-600">
            <span>Chưa có tài khoản?</span>
            <Link
              to="/register"
              className="font-semibold text-violet-600 hover:text-violet-700 transition"
            >
              Đăng ký tại đây
            </Link>
          </div>
        </div>

        {/* Footer Info */}
        <p className="mt-8 text-center text-xs text-slate-500">
          © 2026 FPT University. Hệ thống chấm điểm tự động.
        </p>
      </div>
    </div>
  )
}
