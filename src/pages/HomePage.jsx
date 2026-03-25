import { useState, useEffect, useRef } from 'react'
import { authApi } from '../services/authApi'

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

  const text = await response.text()
  return text || null
}

const getRealtimeScoreColorClass = (scoreValue) => {
  const score = Number(scoreValue)
  if (Number.isNaN(score)) return 'text-slate-700'
  if (score === 0) return 'text-red-600'
  if (score > 0 && score < 5) return 'text-orange-700'
  return 'text-emerald-700'
}

// Blob <-> Base64 conversion
const blobToBase64 = async (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const base64ToBlob = (base64Data) => {
  const arr = base64Data.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  const n = bstr.length
  const u8arr = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }
  return new Blob([u8arr], { type: mime })
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

const submissionApi = {
  getAll: async () => {
    const response = await fetch(buildApiUrl('/api/submissions'))
    if (!response.ok) {
      throw new Error('Lỗi tải danh sách bài nộp')
    }
    return await parseResponse(response)
  },
}

const gradeApi = {
  getAll: async () => {
    const response = await fetch(buildApiUrl('/api/grades'))
    if (!response.ok) {
      throw new Error('Lỗi tải danh sách điểm')
    }
    return await parseResponse(response)
  },
}

const gradingApi = {
  processBatchExcel: async (formData) => {
    const token = authApi.getToken()

    const response = await fetch(buildApiUrl('/api/grading/process-batch-excel'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    if (!response.ok) {
      const error = await parseResponse(response)
      const errorMessage =
        typeof error === 'string' ? error : error?.message || 'Lỗi chấm bài thi'
      throw new Error(errorMessage)
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get('content-disposition') || ''
    const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
    const fileName = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || 'grading-result.xlsx')

    return { blob, fileName }
  },
}

function HomePage() {
  const [examSessions, setExamSessions] = useState([])
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [message, setMessage] = useState(null)
  const [gradingResult, setGradingResult] = useState(null)
  const [liveProgress, setLiveProgress] = useState({
    totalSubmissions: 0,
    gradedCount: 0,
    latestStudents: [],
  })
  const gradedSubmissionIdSetRef = useRef(new Set())
  const baselineSubmissionIdSetRef = useRef(new Set())
  const notificationQueueRef = useRef([])
  const notificationDrainIntervalRef = useRef(null)

  const getGradedCountByExamSession = async (examSessionId) => {
    const [submissions, grades] = await Promise.all([submissionApi.getAll(), gradeApi.getAll()])

    const sessionSubmissionIds = new Set(
      (Array.isArray(submissions) ? submissions : [])
        .filter((submission) => submission.examSessionId === examSessionId)
        .map((submission) => submission.id),
    )

    const gradedCount = (Array.isArray(grades) ? grades : []).filter((grade) =>
      sessionSubmissionIds.has(grade.submissionId),
    ).length

    return gradedCount
  }

  const getGradingProgressByExamSession = async (examSessionId) => {
    const [submissions, grades] = await Promise.all([submissionApi.getAll(), gradeApi.getAll()])

    const sessionSubmissions = (Array.isArray(submissions) ? submissions : []).filter(
      (submission) => submission.examSessionId === examSessionId,
    )

    const sessionSubmissionMap = new Map(sessionSubmissions.map((submission) => [submission.id, submission]))

    const gradedSubmissions = (Array.isArray(grades) ? grades : [])
      .filter((grade) => sessionSubmissionMap.has(grade.submissionId))
      .map((grade) => ({
        submissionId: grade.submissionId,
        studentId: sessionSubmissionMap.get(grade.submissionId)?.studentId || 'Không rõ MSSV',
        finalScore: grade.finalScore,
      }))

    return {
      totalSubmissions: sessionSubmissions.length,
      gradedSubmissions,
    }
  }

  const [formData, setFormData] = useState({
    examSessionId: '',
    zipFile: null,
    excelTemplate: null,
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

  // Load exam sessions
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingData(true)
        const sessions = await examSessionApi.getAll()
        setExamSessions(Array.isArray(sessions) ? sessions : [])
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
    const { name, files } = e.target
    const file = files?.[0]
    setFormData((prev) => ({
      ...prev,
      [name]: file || null,
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
    if (!formData.zipFile) {
      setMessage({ type: 'error', text: 'Vui lòng chọn file bài thi (.zip)' })
      return
    }
    if (!formData.excelTemplate) {
      setMessage({ type: 'error', text: 'Vui lòng chọn file mẫu Excel (.xlsx)' })
      return
    }

    let progressIntervalId = null

    try {
      setIsLoading(true)
      setLiveProgress({ totalSubmissions: 0, gradedCount: 0, latestStudents: [] })
      gradedSubmissionIdSetRef.current = new Set()
      baselineSubmissionIdSetRef.current = new Set()
      notificationQueueRef.current = []

      try {
        const baselineProgress = await getGradingProgressByExamSession(formData.examSessionId)
        baselineSubmissionIdSetRef.current = new Set(
          baselineProgress.gradedSubmissions.map((item) => item.submissionId),
        )
      } catch {
        baselineSubmissionIdSetRef.current = new Set()
      }

      if (notificationDrainIntervalRef.current !== null) {
        window.clearInterval(notificationDrainIntervalRef.current)
      }

      notificationDrainIntervalRef.current = window.setInterval(() => {
        if (notificationQueueRef.current.length === 0) return

        const nextItem = notificationQueueRef.current.shift()
        setLiveProgress((prev) => ({
          ...prev,
          latestStudents: [nextItem, ...prev.latestStudents].slice(0, 4),
        }))
      }, 800)

      let isPollingLocked = false
      const refreshProgress = async () => {
        if (isPollingLocked) return

        isPollingLocked = true
        try {
          const progress = await getGradingProgressByExamSession(formData.examSessionId)

          const currentRunGraded = progress.gradedSubmissions.filter(
            (item) => !baselineSubmissionIdSetRef.current.has(item.submissionId),
          )

          const newlyGraded = currentRunGraded
            .filter((item) => !gradedSubmissionIdSetRef.current.has(item.submissionId))
            .slice(-6)

          newlyGraded.forEach((item) => {
            gradedSubmissionIdSetRef.current.add(item.submissionId)
          })

          if (newlyGraded.length > 0) {
            notificationQueueRef.current.push(...newlyGraded)
          }

          setLiveProgress((prev) => ({
            ...prev,
            totalSubmissions: progress.totalSubmissions,
            gradedCount: currentRunGraded.length,
          }))
        } catch {
          // Không chặn luồng chấm điểm nếu lỗi poll tiến độ
        } finally {
          isPollingLocked = false
        }
      }

      progressIntervalId = window.setInterval(refreshProgress, 2500)

      // Get exam session info
      const selectedSession = examSessions.find((s) => s.id === formData.examSessionId)
      if (!selectedSession) {
        throw new Error('Không tìm thấy thông tin đợt thi')
      }

      // Build form data
      const requestFormData = new FormData()
      requestFormData.append('examSessionId', formData.examSessionId)
      requestFormData.append('zipFile', formData.zipFile)
      requestFormData.append('excelTemplate', formData.excelTemplate)
      requestFormData.append('subjectCode', selectedSession.subjectCode || '')
      requestFormData.append('semesterCode', selectedSession.semesterName || '')

      const result = await gradingApi.processBatchExcel(requestFormData)
      if (progressIntervalId !== null) {
        window.clearInterval(progressIntervalId)
      }
      await refreshProgress()

      let gradedCount = null
      try {
        gradedCount = await getGradedCountByExamSession(formData.examSessionId)
      } catch {
        gradedCount = null
      }

      const resultData = {
        fileName: result.fileName,
        fileBlob: result.blob,
        sizeMb: (result.blob.size / 1024 / 1024).toFixed(2),
        gradedCount,
      }

      setGradingResult(resultData)

      // Save to localStorage for GradeReviewPage access
      try {
        const base64Data = await blobToBase64(result.blob)
        localStorage.setItem(
          'gradingResult',
          JSON.stringify({
            fileName: result.fileName,
            fileBlob: base64Data,
            sizeMb: (result.blob.size / 1024 / 1024).toFixed(2),
            gradedCount,
          }),
        )
      } catch (error) {
        console.error('Lỗi lưu file vào localStorage:', error)
      }

      setMessage({
        type: 'success',
        text:
          gradedCount === null
            ? 'Chấm điểm thành công. Bấm nút bên dưới để tải file kết quả.'
            : `Đã chấm xong toàn bộ ${gradedCount} bài. Bấm nút bên dưới để tải file kết quả.`,
      })

      // Reset form
      setFormData({
        examSessionId: '',
        zipFile: null,
        excelTemplate: null,
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      if (progressIntervalId !== null) {
        window.clearInterval(progressIntervalId)
      }
      if (notificationDrainIntervalRef.current !== null) {
        window.clearInterval(notificationDrainIntervalRef.current)
        notificationDrainIntervalRef.current = null
      }
      setIsLoading(false)
    }
  }

  const closeModal = () => {
    setIsGradingModalOpen(false)
    setMessage(null)
    setGradingResult(null)
    setLiveProgress({ totalSubmissions: 0, gradedCount: 0, latestStudents: [] })
    notificationQueueRef.current = []
    if (notificationDrainIntervalRef.current !== null) {
      window.clearInterval(notificationDrainIntervalRef.current)
      notificationDrainIntervalRef.current = null
    }
    setFormData({
      examSessionId: '',
      zipFile: null,
      excelTemplate: null,
    })
  }

  const handleDownloadResult = () => {
    if (!gradingResult?.fileBlob || !gradingResult?.fileName) return

    const downloadUrl = URL.createObjectURL(gradingResult.fileBlob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = gradingResult.fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(downloadUrl)
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
              Nền tảng chấm điểm PRN231 / PRN232
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
            </div>
          </div>


          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-1">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-2xl font-bold text-slate-900">95%</h2>
              <p className="mt-1 text-sm text-slate-600">Tiết kiệm thời gian chấm điểm</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-2xl font-bold text-slate-900">Theo quy mô</h2>
              <p className="mt-1 text-sm text-slate-600">Thời gian xử lý phụ thuộc số lượng bài</p>
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
                Tải lên file bài thi (.zip) và file mẫu lớp (.xlsx) để chấm điểm tự động
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
                    <p className="font-medium">Kết quả đã sẵn sàng để tải về.</p>
                    <p className="mt-2">
                      Tệp: <span className="font-semibold">{gradingResult.fileName}</span>
                    </p>
                    <p>Dung lượng: {gradingResult.sizeMb} MB</p>
                    <p>
                      Tổng số bài đã chấm:{' '}
                      <span className="font-semibold">
                        {gradingResult.gradedCount === null ? '--' : gradingResult.gradedCount}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadResult}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Tải file Excel kết quả
                  </button>
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

                  {/* File Upload */}
                  <div>
                    <label htmlFor="zip-file" className="block text-sm font-medium text-slate-700">
                      Tải lên file bài thi (.zip) <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 rounded-lg border-2 border-dashed border-slate-300 px-6 py-8 text-center">
                      <input
                        id="zip-file"
                        name="zipFile"
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

                  <div>
                    <label htmlFor="excel-template" className="block text-sm font-medium text-slate-700">
                      Tải lên file mẫu lớp (.xlsx) <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 rounded-lg border-2 border-dashed border-slate-300 px-6 py-6 text-center">
                      <input
                        id="excel-template"
                        name="excelTemplate"
                        type="file"
                        accept=".xlsx"
                        onChange={handleFileChange}
                        disabled={isLoading}
                        className="hidden"
                      />
                      <label htmlFor="excel-template" className="cursor-pointer">
                        {formData.excelTemplate ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-emerald-700">✓ File mẫu đã chọn</p>
                            <p className="text-xs text-slate-600">{formData.excelTemplate.name}</p>
                            <p className="text-xs text-slate-500">
                              ({(formData.excelTemplate.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-700">
                              📊 Kéo thả file hoặc bấm để chọn
                            </p>
                            <p className="text-xs text-slate-500">Hỗ trợ file .xlsx</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {isLoading && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                      <p className="text-sm font-semibold text-indigo-900">Đang chấm bài thi</p>
                      <p className="mt-1 text-sm text-indigo-800">
                        Đã chấm:{' '}
                        <span className="font-semibold">
                          {liveProgress.gradedCount}
                          {liveProgress.totalSubmissions > 0 ? `/${liveProgress.totalSubmissions}` : ''}
                        </span>
                      </p>

                      {liveProgress.latestStudents.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-indigo-800">
                          {liveProgress.latestStudents.map((item) => (
                            <li key={item.submissionId} className="rounded bg-white/70 px-2 py-1">
                              ✓ Đã chấm xong bài{' '}
                              <span className="font-semibold">{item.studentId}</span>{' '}
                              • Điểm:{' '}
                              <span className={`font-semibold ${getRealtimeScoreColorClass(item.finalScore)}`}>
                                {Number.isNaN(Number(item.finalScore))
                                  ? '--'
                                  : Number(item.finalScore).toFixed(2)}
                              </span>
                              
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-indigo-700">Đang chờ bài đầu tiên hoàn tất...</p>
                      )}
                    </div>
                  )}

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
