import { FormEvent, useEffect, useMemo, useState } from 'react'

type UserSession = {
  token: string
  email: string
  systemId: string
}

type QuestionnairePayload = {
  profile: Record<string, unknown>
  objective_answers: Record<string, unknown>
  personality_traits: Record<string, unknown>
  preferences: Record<string, unknown>
  tags: string[]
  opt_in_weekly: boolean
}

type MatchData = {
  partner_system_id: string
  score: number
  reason_text: string
  week_start: string
}

const API_BASE = ''

const defaultQuestionnaire: QuestionnairePayload = {
  profile: {
    gender: '',
    orientation: 'all',
    age: 20,
  },
  objective_answers: {
    sleep_time: 5,
    wake_time: 5,
    spending_style: 5,
    social_frequency: 5,
    exercise: 5,
  },
  personality_traits: {
    role: '',
  },
  preferences: {
    min_age: 18,
    max_age: 25,
  },
  tags: [],
  opt_in_weekly: false,
}

function nextFridayAtNineLabel(): string {
  const now = new Date()
  const target = new Date(now)
  const day = now.getDay()
  const delta = (5 - day + 7) % 7
  target.setDate(now.getDate() + delta)
  target.setHours(21, 0, 0, 0)
  if (day === 5 && now.getHours() >= 21) {
    target.setDate(target.getDate() + 7)
  }
  return target.toLocaleString('zh-CN', { hour12: false })
}

async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers || {})
  headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const data = (await res.json().catch(() => ({}))) as T & { detail?: string }
  if (!res.ok) {
    throw new Error(data.detail || `Request failed: ${res.status}`)
  }
  return data
}

export default function App() {
  const [tab, setTab] = useState<'login' | 'register' | 'questionnaire' | 'match' | 'profile'>('login')
  const [session, setSession] = useState<UserSession | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const [stats, setStats] = useState({
    verified_users: 0,
    questionnaire_completion_rate: 0,
    successful_moments: 0,
  })

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ email: '', code: '', password: '' })
  const [codeCountdown, setCodeCountdown] = useState(0)
  const [devCodeHint, setDevCodeHint] = useState('')

  const [questionnaire, setQuestionnaire] = useState<QuestionnairePayload>(defaultQuestionnaire)
  const [tagsInput, setTagsInput] = useState('')
  const [match, setMatch] = useState<MatchData | null>(null)
  const [contactMessage, setContactMessage] = useState('')

  const fridayText = useMemo(() => nextFridayAtNineLabel(), [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const email = localStorage.getItem('email')
    const systemId = localStorage.getItem('system_id')
    if (token && email && systemId) {
      setSession({ token, email, systemId })
      setTab('questionnaire')
    }
  }, [])

  useEffect(() => {
    void api<{
      verified_users: number
      questionnaire_completion_rate: number
      successful_moments: number
    }>('/api/public/stats')
      .then((data) => setStats(data))
      .catch(() => void 0)
  }, [])

  useEffect(() => {
    if (!session) return
    void api<QuestionnairePayload>('/api/questionnaire', { method: 'GET' }, session.token)
      .then((data) => {
        setQuestionnaire(data)
        setTagsInput(data.tags.join(', '))
      })
      .catch(() => void 0)

    void api<MatchData>('/api/matches/current', { method: 'GET' }, session.token)
      .then((data) => setMatch(data))
      .catch(() => setMatch(null))
  }, [session])

  useEffect(() => {
    if (codeCountdown <= 0) return
    const timer = setInterval(() => setCodeCountdown((v) => v - 1), 1000)
    return () => clearInterval(timer)
  }, [codeCountdown])

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  async function sendCode() {
    resetMessages()
    if (!registerForm.email) {
      setError('请输入邮箱')
      return
    }
    try {
      setLoading(true)
      const data = await api<{ message: string; dev_code?: string }>(
        '/api/auth/send-code',
        {
          method: 'POST',
          body: JSON.stringify({ email: registerForm.email }),
        },
      )
      setSuccess('验证码已生成，请查看你的邮箱系统。')
      if (data.dev_code) {
        setDevCodeHint(`当前开发验证码：${data.dev_code}`)
      }
      setCodeCountdown(60)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    try {
      setLoading(true)
      const data = await api<{ access_token: string; system_id: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(registerForm),
        },
      )
      const newSession: UserSession = {
        token: data.access_token,
        email: registerForm.email,
        systemId: data.system_id,
      }
      localStorage.setItem('token', newSession.token)
      localStorage.setItem('email', newSession.email)
      localStorage.setItem('system_id', newSession.systemId)
      setSession(newSession)
      setTab('questionnaire')
      setSuccess('注册成功，欢迎加入。')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    try {
      setLoading(true)
      const data = await api<{ access_token: string; system_id: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(loginForm),
        },
      )
      const newSession: UserSession = {
        token: data.access_token,
        email: loginForm.email,
        systemId: data.system_id,
      }
      localStorage.setItem('token', newSession.token)
      localStorage.setItem('email', newSession.email)
      localStorage.setItem('system_id', newSession.systemId)
      setSession(newSession)
      setTab('questionnaire')
      setSuccess('登录成功。')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function saveQuestionnaire(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    resetMessages()
    const payload: QuestionnairePayload = {
      ...questionnaire,
      tags: tagsInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    }
    try {
      setLoading(true)
      await api<QuestionnairePayload>(
        '/api/questionnaire',
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
        session.token,
      )
      setSuccess('问卷已保存')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function submitContact(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    resetMessages()
    try {
      setLoading(true)
      await api<{ message: string }>(
        '/api/contact/message',
        {
          method: 'POST',
          body: JSON.stringify({ message: contactMessage }),
        },
        session.token,
      )
      setContactMessage('')
      setSuccess('留言已发送')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    localStorage.removeItem('system_id')
    setSession(null)
    setMatch(null)
    setQuestionnaire(defaultQuestionnaire)
    setTagsInput('')
    setTab('login')
    resetMessages()
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__overlay" />
        <img src="/campus-bg.jpg" alt="campus" className="hero__bg" />
        <div className="hero__content">
          <p className="hero__badge">BIT Date</p>
          <h1>校园慢社交匹配系统</h1>
          <p>每周五 21:00（北京时间）派发匹配信封。下一次派发时间：{fridayText}</p>
          <div className="hero__stats">
            <div>
              <strong>{stats.verified_users}+</strong>
              <span>已验证用户</span>
            </div>
            <div>
              <strong>{stats.questionnaire_completion_rate}%</strong>
              <span>问卷完成率</span>
            </div>
            <div>
              <strong>{stats.successful_moments}+</strong>
              <span>心动瞬间</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        {!session ? (
          <section className="panel auth-panel">
            <div className="tabs">
              <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>
                登录
              </button>
              <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>
                注册
              </button>
            </div>

            {tab === 'login' && (
              <form onSubmit={handleLogin} className="form-grid">
                <label>
                  邮箱
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((v) => ({ ...v, email: e.target.value }))}
                    placeholder="name@bit.edu.cn"
                    required
                  />
                </label>
                <label>
                  密码
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((v) => ({ ...v, password: e.target.value }))}
                    placeholder="至少8位"
                    required
                  />
                </label>
                <button type="submit" disabled={loading}>
                  {loading ? '登录中...' : '登录'}
                </button>
              </form>
            )}

            {tab === 'register' && (
              <form onSubmit={handleRegister} className="form-grid">
                <label>
                  校园邮箱
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((v) => ({ ...v, email: e.target.value }))}
                    placeholder="name@bit.edu.cn"
                    required
                  />
                </label>
                <label>
                  验证码
                  <div className="inline-row">
                    <input
                      value={registerForm.code}
                      onChange={(e) => setRegisterForm((v) => ({ ...v, code: e.target.value }))}
                      placeholder="6位数字"
                      required
                    />
                    <button type="button" onClick={sendCode} disabled={loading || codeCountdown > 0}>
                      {codeCountdown > 0 ? `${codeCountdown}s` : '发送'}
                    </button>
                  </div>
                </label>
                {devCodeHint && <small className="helper">{devCodeHint}</small>}
                <label>
                  密码
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm((v) => ({ ...v, password: e.target.value }))}
                    placeholder="至少8位"
                    required
                  />
                </label>
                <button type="submit" disabled={loading}>
                  {loading ? '注册中...' : '注册'}
                </button>
              </form>
            )}
          </section>
        ) : (
          <section className="panel workspace-panel">
            <div className="workspace-head">
              <div>
                <p className="id-line">当前身份：{session.systemId}</p>
                <small>{session.email}</small>
              </div>
              <button className="ghost" onClick={logout}>
                退出登录
              </button>
            </div>

            <div className="tabs tabs--tight">
              <button className={tab === 'questionnaire' ? 'active' : ''} onClick={() => setTab('questionnaire')}>
                问卷
              </button>
              <button className={tab === 'match' ? 'active' : ''} onClick={() => setTab('match')}>
                我的匹配
              </button>
              <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>
                个人中心
              </button>
            </div>

            {tab === 'questionnaire' && (
              <form onSubmit={saveQuestionnaire} className="form-grid">
                <h2>基本信息</h2>
                <label>
                  性别
                  <select
                    value={String(questionnaire.profile.gender ?? '')}
                    onChange={(e) =>
                      setQuestionnaire((v) => ({
                        ...v,
                        profile: { ...v.profile, gender: e.target.value },
                      }))
                    }
                  >
                    <option value="">请选择</option>
                    <option value="female">女</option>
                    <option value="male">男</option>
                  </select>
                </label>
                <label>
                  取向
                  <select
                    value={String(questionnaire.profile.orientation ?? 'all')}
                    onChange={(e) =>
                      setQuestionnaire((v) => ({
                        ...v,
                        profile: { ...v.profile, orientation: e.target.value },
                      }))
                    }
                  >
                    <option value="all">全部</option>
                    <option value="same">同性</option>
                    <option value="different">异性</option>
                  </select>
                </label>
                <label>
                  年龄
                  <input
                    type="number"
                    value={Number(questionnaire.profile.age ?? 20)}
                    onChange={(e) =>
                      setQuestionnaire((v) => ({
                        ...v,
                        profile: { ...v.profile, age: Number(e.target.value) },
                      }))
                    }
                  />
                </label>

                <h2>生活习惯（1-10）</h2>
                {['sleep_time', 'wake_time', 'spending_style', 'social_frequency', 'exercise'].map((key) => (
                  <label key={key}>
                    {key}
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={Number(questionnaire.objective_answers[key] ?? 5)}
                      onChange={(e) =>
                        setQuestionnaire((v) => ({
                          ...v,
                          objective_answers: {
                            ...v.objective_answers,
                            [key]: Number(e.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                ))}

                <h2>性格与偏好</h2>
                <label>
                  角色
                  <select
                    value={String(questionnaire.personality_traits.role ?? '')}
                    onChange={(e) =>
                      setQuestionnaire((v) => ({
                        ...v,
                        personality_traits: { ...v.personality_traits, role: e.target.value },
                      }))
                    }
                  >
                    <option value="">请选择</option>
                    <option value="leader">leader</option>
                    <option value="supporter">supporter</option>
                    <option value="planner">planner</option>
                    <option value="explorer">explorer</option>
                  </select>
                </label>
                <label>
                  偏好最小年龄
                  <input
                    type="number"
                    value={Number(questionnaire.preferences.min_age ?? 18)}
                    onChange={(e) =>
                      setQuestionnaire((v) => ({
                        ...v,
                        preferences: { ...v.preferences, min_age: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
                <label>
                  偏好最大年龄
                  <input
                    type="number"
                    value={Number(questionnaire.preferences.max_age ?? 25)}
                    onChange={(e) =>
                      setQuestionnaire((v) => ({
                        ...v,
                        preferences: { ...v.preferences, max_age: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
                <label>
                  兴趣标签（逗号分隔）
                  <textarea value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} rows={3} />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={questionnaire.opt_in_weekly}
                    onChange={(e) =>
                      setQuestionnaire((v) => ({ ...v, opt_in_weekly: e.target.checked }))
                    }
                  />
                  <span>参与本周匹配</span>
                </label>

                <button type="submit" disabled={loading}>
                  {loading ? '保存中...' : '保存问卷'}
                </button>
              </form>
            )}

            {tab === 'match' && (
              <div className="match-card">
                {match ? (
                  <>
                    <h2>本周匹配对象：{match.partner_system_id}</h2>
                    <p>匹配度：{match.score}%</p>
                    <p>{match.reason_text}</p>
                    <form onSubmit={submitContact} className="form-grid">
                      <label>
                        写一条留言
                        <textarea
                          rows={4}
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                        />
                      </label>
                      <button type="submit" disabled={loading}>
                        {loading ? '发送中...' : '发送留言'}
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <h2>还没有匹配结果</h2>
                    <p>请先完成问卷并勾选“参与本周匹配”。</p>
                  </>
                )}
              </div>
            )}

            {tab === 'profile' && (
              <div className="profile-card">
                <h2>个人中心</h2>
                <p>系统ID：{session.systemId}</p>
                <p>邮箱：{session.email}</p>
                <p>每周五 21:00 自动派发匹配结果</p>
              </div>
            )}
          </section>
        )}

        {(error || success) && (
          <section className={`toast ${error ? 'toast--error' : 'toast--ok'}`}>
            {error || success}
          </section>
        )}
      </main>
    </div>
  )
}
