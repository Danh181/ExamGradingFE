const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const buildApiUrl = (path) => (API_BASE_URL ? `${API_BASE_URL}${path}` : path)

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const decoded = atob(padded)
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0))
    const utf8 = new TextDecoder().decode(bytes)

    return JSON.parse(utf8)
  } catch {
    return null
  }
}

async function parseResponse(response) {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof body === 'string'
        ? body
        : body?.message || 'Yêu cầu thất bại. Vui lòng thử lại.'
    throw new Error(message)
  }

  return body
}

export const authApi = {
  async register(request) {
    const response = await fetch(buildApiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return parseResponse(response)
  },

  async login(request) {
    const response = await fetch(buildApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return parseResponse(response)
  },

  // Lưu token vào localStorage
  setToken(token) {
    if (token) {
      localStorage.setItem('authToken', token)
    }
  },

  // Lấy token từ localStorage
  getToken() {
    return localStorage.getItem('authToken')
  },

  // Xóa token khỏi localStorage
  clearToken() {
    localStorage.removeItem('authToken')
  },

  // Kiểm tra đã đăng nhập chưa
  isAuthenticated() {
    return !!localStorage.getItem('authToken')
  },

  getCurrentUserFullName() {
    const token = this.getToken()
    if (!token) return ''

    const payload = decodeJwtPayload(token)
    if (!payload) return ''

    return payload.FullName || ''
  },
}
