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
const examSessionApi = {
  getAll: async () => {
    const response = await fetch(buildApiUrl('/api/examsessions'))
    if (!response.ok) {
      throw new Error('Lỗi tải đợt thi')
    }
    return await parseResponse(response)
  },
}

const userApi = {
  getAll: async () => {
    const response = await fetch(buildApiUrl('/api/users'))
    if (!response.ok) {
      throw new Error('Lỗi tải danh sách người dùng')
    }
    return await parseResponse(response)
  },
}

const gradingApi = {
  processBatch: async (formData) => {
    const response = await fetch(buildApiUrl('/api/grading/process-batch'), {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const error = await parseResponse(response)
      throw new Error(error?.message || 'Lỗi chấm bài thi')
    }
    return await parseResponse(response)
  },
}

function HomePage() {
  const [examSessions, setExamSessions] = useState([])
  const [users, setUsers] = useState([])
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [message, setMessage] = useState(null)
  const [gradingResult, setGradingResult] = useState(null)

  const [formData, setFormData] = useState({
    examSessionId: '',
    examinerId: '',
    zipFile: null,
  })

  const features = [
    {
      title: 'Chấm điểm tự động theo đáp án',
      description:
        'Hỗ trợ câu hỏi trắc nghiệm và tự luận ngắn với bộ tiêu chí linh hoạt theo từng môn học.',
    },
    {
      title: 'Phân tích kết quả theo lớp',
      description:
        'Thống kê điểm số, phổ điểm, câu hỏi khó và mức độ hoàn thành của sinh viên chỉ trong vài giây.',
    },
    {
      title: 'Phản hồi nhanh cho sinh viên',
      description:
        'Xuất nhận xét tự động theo từng bài làm, giúp giảng viên tiết kiệm thời gian xử lý hậu kiểm.',
    },
  ]

  const workflow = [
    'Tải lên đề thi và đáp án mẫu',
    'Hệ thống tự động đối chiếu và chấm điểm',
    'Giảng viên rà soát nhanh các trường hợp ngoại lệ',
    'Xuất báo cáo điểm và phản hồi cho sinh viên',
  ]

  // Load exam sessions and users
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingData(true)
        const [sessions, usersList] = await Promise.all([
          examSessionApi.getAll(),
          userApi.getAll(),
        ])
        setExamSessions(Array.isArray(sessions) ? sessions : [])
        setUsers(Array.isArray(usersList) ? usersList : [])
      } catch (error) {
        console.error('Lỗi tải dữ liệu:', error)
      } finally {
        setIsLoadingData(false)
      }
    }
    loadData()
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    setFormData((prev) => ({
      ...prev,
      zipFile: file || null,
    }))
  }

  const handleSubmitGrading = async (e) => {
    e.preventDefault()
    setMessage(null)
    setGradingResult(null)

    // Validation
    if (!formData.examSessionId) {
      setMessage({ type: 'error', text: 'Vui lòng chọn đợt thi' })
      return
    }
    if (!formData.examinerId) {
      setMessage({ type: 'error', text: 'Vui lòng chọn người chấm' })
      return
    }
    if (!formData.zipFile) {
      setMessage({ type: 'error', text: 'Vui lòng chọn file bài thi (.zip)' })
      return
    }

    try {
      setIsLoading(true)

      // Get exam session info
      const selectedSession = examSessions.find((s) => s.id === formData.examSessionId)
      if (!selectedSession) {
        throw new Error('Không tìm thấy thông tin đợt thi')
      }

      // Build form data
      const requestFormData = new FormData()
      requestFormData.append('examSessionId', formData.examSessionId)
      requestFormData.append('examinerId', formData.examinerId)
      requestFormData.append('zipFile', formData.zipFile)
      requestFormData.append('subjectCode', selectedSession.subjectCode || '')
      requestFormData.append('semesterCode', selectedSession.semesterName || '')

      const result = await gradingApi.processBatch(requestFormData)
      setGradingResult(result)
      setMessage({ type: 'success', text: result.message })

      // Reset form
      setFormData({
        examSessionId: '',
        examinerId: '',
        zipFile: null,
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const closeModal = () => {
    setIsGradingModalOpen(false)
    setMessage(null)
    setGradingResult(null)
    setFormData({
      examSessionId: '',
      examinerId: '',
      zipFile: null,
    })
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-8 p-6 md:grid-cols-2 md:p-10">
          <div>
            <p className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
              ExamGrading Platform
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-5xl md:leading-tight">
              Nền tảng chấm điểm tự động cho giảng viên đại học
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
              Tăng tốc quy trình chấm thi, chuẩn hóa tiêu chí đánh giá và giảm tải
              công việc thủ công cho đội ngũ giảng dạy.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsGradingModalOpen(true)}
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Bắt đầu chấm điểm
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Xem demo hệ thống
              </button>
            </div>
          </div>


          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-1">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-2xl font-bold text-slate-900">95%</h2>
              <p className="mt-1 text-sm text-slate-600">Tiết kiệm thời gian chấm điểm</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-2xl font-bold text-slate-900">&lt; 2 phút</h2>
              <p className="mt-1 text-sm text-slate-600">Xử lý mỗi bộ bài thi</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-2xl font-bold text-slate-900">100%</h2>
              <p className="mt-1 text-sm text-slate-600">Chuẩn hóa theo rubric</p>
            </article>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Tính năng nổi bật</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-slate-200 bg-slate-50 p-5"
            >
              <h3 className="text-lg font-semibold leading-snug text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Quy trình sử dụng</h2>
        <ol className="mt-5 space-y-3">
          {workflow.map((step, index) => (
            <li
              key={step}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                {index + 1}
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-slate-700 md:text-base">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Grading Modal */}
      {isGradingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            {/* Modal Header */}
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Bắt đầu chấm điểm</h2>
                <button
                  onClick={closeModal}
                  className="text-slate-400 transition hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Tải lên file bài thi (.zip) để bắt đầu quá trình chấm điểm tự động
              </p>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 px-6 py-4">
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

              {/* Result Display */}
              {gradingResult && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="font-semibold text-emerald-900">✓ Chấm điểm thành công</h3>
                  <div className="text-sm text-emerald-800">
                    <p className="font-medium">{gradingResult.message}</p>
                    {Array.isArray(gradingResult.processedSubmissionIds) && (
                      <p className="mt-2">
                        ID bài thi:{' '}
                        <span className="font-mono text-xs">
                          {gradingResult.processedSubmissionIds.slice(0, 2).join(', ')}
                          {gradingResult.processedSubmissionIds.length > 2 &&
                            `, +${gradingResult.processedSubmissionIds.length - 2} bài khác`}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!gradingResult && (
                <form onSubmit={handleSubmitGrading} className="space-y-4">
                  {/* Exam Session Selection */}
                  <div>
                    <label htmlFor="exam-session" className="block text-sm font-medium text-slate-700">
                      Chọn đợt thi <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="exam-session"
                      name="examSessionId"
                      value={formData.examSessionId}
                      onChange={handleInputChange}
                      disabled={isLoadingData || isLoading}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">-- Vui lòng chọn đợt thi --</option>
                      {examSessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.examName} ({session.subjectCode} - {session.semesterName})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Examiner Selection */}
                  <div>
                    <label htmlFor="examiner" className="block text-sm font-medium text-slate-700">
                      Chọn người chấm <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="examiner"
                      name="examinerId"
                      value={formData.examinerId}
                      onChange={handleInputChange}
                      disabled={isLoadingData || isLoading}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">-- Vui lòng chọn người chấm --</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} ({user.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* File Upload */}
                  <div>
                    <label htmlFor="zip-file" className="block text-sm font-medium text-slate-700">
                      Tải lên file bài thi (.zip) <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 rounded-lg border-2 border-dashed border-slate-300 px-6 py-8 text-center">
                      <input
                        id="zip-file"
                        type="file"
                        accept=".zip,.rar"
                        onChange={handleFileChange}
                        disabled={isLoading}
                        className="hidden"
                      />
                      <label htmlFor="zip-file" className="cursor-pointer">
                        {formData.zipFile ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-emerald-700">✓ File đã chọn</p>
                            <p className="text-xs text-slate-600">{formData.zipFile.name}</p>
                            <p className="text-xs text-slate-500">
                              ({(formData.zipFile.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-700">
                              📁 Kéo thả file hoặc bấm để chọn
                            </p>
                            <p className="text-xs text-slate-500">Hỗ trợ file .zip hoặc .rar</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || isLoadingData}
                    className="w-full rounded-lg bg-violet-600 px-4 py-2.5 font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? 'Đang chấm điểm...' : 'Bắt đầu chấm điểm'}
                  </button>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            {gradingResult && (
              <div className="border-t border-slate-200 px-6 py-4">
                <button
                  onClick={closeModal}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default HomePage
