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

type CardOption = {
  value: string
  title: string
  caption: string
  icon: string
}

type SliderConfig = {
  key: keyof QuestionnairePayload['objective_answers'] & string
  label: string
  hint: string
  minLabel: string
  maxLabel: string
}

const API_BASE = ''

const defaultQuestionnaire: QuestionnairePayload = {
  profile: {
    gender: '',
    orientation: 'all',
    age: 20,
    grade: '',
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

const genderOptions: CardOption[] = [
  { value: 'male', title: '男生', caption: '清晰表达你的身份认同', icon: '♂' },
  { value: 'female', title: '女生', caption: '让系统知道你的基础信息', icon: '♀' },
]

const orientationOptions: CardOption[] = [
  { value: 'same', title: '倾向同性', caption: '我更想认识与我同性的对象', icon: '↔' },
  { value: 'different', title: '倾向异性', caption: '我更期待异性的连接', icon: '⇄' },
  { value: 'all', title: '都可以', caption: '先看感觉，保持开放可能性', icon: '∞' },
]

const gradeOptions: CardOption[] = [
  { value: 'freshman', title: '大一', caption: '刚进入校园节奏，期待新鲜相遇', icon: '1' },
  { value: 'sophomore', title: '大二', caption: '慢慢稳定下来，也更知道自己要什么', icon: '2' },
  { value: 'junior', title: '大三', caption: '在忙碌与探索之间寻找平衡', icon: '3' },
  { value: 'senior', title: '大四', caption: '节奏更紧，但也更珍惜真诚关系', icon: '4' },
  { value: 'graduate', title: '研究生及以上', caption: '更成熟，也更看重价值观契合', icon: 'G' },
]

const roleOptions: CardOption[] = [
  { value: 'leader', title: 'Leader', caption: '👑 统筹者，我喜欢把握方向', icon: '👑' },
  { value: 'supporter', title: 'Supporter', caption: '🤝 支持者，我乐于辅助与照顾', icon: '🤝' },
  { value: 'planner', title: 'Planner', caption: '🧭 规划派，我习惯先把事情想清楚', icon: '🧭' },
  { value: 'explorer', title: 'Explorer', caption: '✨ 探索派，我更享受即兴与发现', icon: '✨' },
]

const lifestyleSliders: SliderConfig[] = [
  {
    key: 'sleep_time',
    label: '生物钟',
    hint: '你更接近夜猫子还是晨型选手？',
    minLabel: '🦉 凌晨修仙',
    maxLabel: '🌅 早起王者',
  },
  {
    key: 'wake_time',
    label: '起床模式',
    hint: '早课前后的状态感，也很能决定日常磨合。',
    minLabel: '😴 需要缓冲',
    maxLabel: '⚡ 起床即开机',
  },
  {
    key: 'social_frequency',
    label: '社交能量',
    hint: '独处恢复，还是热闹续航？',
    minLabel: '🔋 独处充电',
    maxLabel: '🎉 聚会派对',
  },
  {
    key: 'spending_style',
    label: '消费观念',
    hint: '你更随性，还是更有预算感？',
    minLabel: '💰 随心所欲',
    maxLabel: '📊 精打细算',
  },
  {
    key: 'exercise',
    label: '周末计划',
    hint: '周末是回血，还是冲出校门？',
    minLabel: '🛏️ 宿舍躺平',
    maxLabel: '🎒 特种兵出游',
  },
]

const stepMeta = [
  {
    eyebrow: 'Module 01',
    title: '让我们先认识最基础的你',
    description: '先用几道不费力的小问题，描出你的身份、偏好和期待范围。',
  },
  {
    eyebrow: 'Module 02',
    title: '把你的生活节奏讲给我们听',
    description: '真实的作息和能量分布，往往比空泛标签更能决定两个人是否舒服。',
  },
  {
    eyebrow: 'Module 03',
    title: '在一段关系里，你想扮演什么角色？',
    description: '最后补上互动方式与兴趣线索，让匹配不只停留在“条件对上”。',
  },
] as const

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

function RangeField(props: {
  label: string
  hint: string
  minLabel: string
  maxLabel: string
  value: number
  onChange: (value: number) => void
}) {
  const { label, hint, minLabel, maxLabel, value, onChange } = props

  return (
    <div className="range-field">
      <div className="range-field__head">
        <div>
          <p>{label}</p>
          <span>{hint}</span>
        </div>
        <strong>{value}</strong>
      </div>
      <div className="range-field__track">
        <div className="range-field__bubble" style={{ left: `${((value - 1) / 9) * 100}%` }}>
          {value}
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <div className="range-field__legend">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}

function SelectCardGroup(props: {
  title: string
  hint: string
  options: CardOption[]
  value: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  const { title, hint, options, value, onChange, compact = false } = props

  return (
    <section className="question-block">
      <div className="question-block__copy">
        <h3>{title}</h3>
        <p>{hint}</p>
      </div>
      <div className={`card-grid ${compact ? 'card-grid--compact' : ''}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`choice-card ${value === option.value ? 'is-selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            <span className="choice-card__icon">{option.icon}</span>
            <strong>{option.title}</strong>
            <small>{option.caption}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const [tab, setTab] = useState<'login' | 'register' | 'questionnaire' | 'match' | 'profile'>('login')
  const [session, setSession] = useState<UserSession | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [questionnaireStep, setQuestionnaireStep] = useState(0)

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
  const progress = useMemo(() => ((questionnaireStep + 1) / stepMeta.length) * 100, [questionnaireStep])
  const activeStep = stepMeta[questionnaireStep]

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

  function updateProfile(key: string, value: unknown) {
    setQuestionnaire((current) => ({
      ...current,
      profile: { ...current.profile, [key]: value },
    }))
  }

  function updateObjective(key: string, value: number) {
    setQuestionnaire((current) => ({
      ...current,
      objective_answers: { ...current.objective_answers, [key]: value },
    }))
  }

  function updatePreferences(key: string, value: number) {
    setQuestionnaire((current) => {
      const nextPreferences = {
        ...current.preferences,
        [key]: value,
      }

      if (key === 'min_age' && value > Number(nextPreferences.max_age ?? 25)) {
        nextPreferences.max_age = value
      }

      if (key === 'max_age' && value < Number(nextPreferences.min_age ?? 18)) {
        nextPreferences.min_age = value
      }

      return {
        ...current,
        preferences: nextPreferences,
      }
    })
  }

  async function sendCode() {
    resetMessages()
    if (!registerForm.email) {
      setError('请输入校园邮箱')
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
      setSuccess(data.message || '验证码已发送，请留意你的邮箱。')
      setDevCodeHint(data.dev_code ? `开发环境验证码：${data.dev_code}` : '')
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
      setSuccess('注册成功，欢迎开启这段缘分旅程。')
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
      setSuccess('欢迎回来，今晚的缘分正在路上。')
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
      setSuccess('你的问卷画像已经更新，本周匹配会按最新状态计算。')
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
      setSuccess('留言已经送出，接下来就等对方回应。')
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
    setQuestionnaireStep(0)
    setTab('login')
    resetMessages()
  }

  function renderQuestionnaireStep() {
    if (questionnaireStep === 0) {
      return (
        <>
          <SelectCardGroup
            title="你的性别是？"
            hint="这是最基础的匹配条件之一，我们只会用它来帮助系统更准确地筛选候选人。"
            options={genderOptions}
            value={String(questionnaire.profile.gender ?? '')}
            onChange={(value) => updateProfile('gender', value)}
            compact
          />

          <SelectCardGroup
            title="你更期待遇见怎样的对象？"
            hint="不需要想得太复杂，先按你此刻最真实的倾向来选就好。"
            options={orientationOptions}
            value={String(questionnaire.profile.orientation ?? 'all')}
            onChange={(value) => updateProfile('orientation', value)}
          />

          <SelectCardGroup
            title="你现在处在校园的哪个阶段？"
            hint="节奏相近的人，通常也更容易在联系中保持舒服。"
            options={gradeOptions}
            value={String(questionnaire.profile.grade ?? '')}
            onChange={(value) => updateProfile('grade', value)}
          />

          <section className="question-block">
            <div className="question-block__copy">
              <h3>今年的你，大概几岁？</h3>
              <p>年龄不会决定一切，但它能帮系统更自然地做第一层过滤。</p>
            </div>
            <div className="number-shell">
              <div className="number-chip">
                <span>你的年龄</span>
                <strong>{Number(questionnaire.profile.age ?? 20)} 岁</strong>
              </div>
              <input
                className="number-shell__input"
                type="range"
                min={17}
                max={30}
                value={Number(questionnaire.profile.age ?? 20)}
                onChange={(e) => updateProfile('age', Number(e.target.value))}
              />
              <div className="number-shell__legend">
                <span>17 岁</span>
                <span>30 岁</span>
              </div>
            </div>
          </section>

          <section className="question-block">
            <div className="question-block__copy">
              <h3>你期待对方落在怎样的年龄区间？</h3>
              <p>给出一个舒适范围就好，系统会优先遵守这条边界。</p>
            </div>
            <div className="dual-range">
              <div className="dual-range__card">
                <span>最小年龄</span>
                <strong>{Number(questionnaire.preferences.min_age ?? 18)} 岁</strong>
                <input
                  type="range"
                  min={17}
                  max={30}
                  value={Number(questionnaire.preferences.min_age ?? 18)}
                  onChange={(e) => updatePreferences('min_age', Number(e.target.value))}
                />
              </div>
              <div className="dual-range__card">
                <span>最大年龄</span>
                <strong>{Number(questionnaire.preferences.max_age ?? 25)} 岁</strong>
                <input
                  type="range"
                  min={17}
                  max={30}
                  value={Number(questionnaire.preferences.max_age ?? 25)}
                  onChange={(e) => updatePreferences('max_age', Number(e.target.value))}
                />
              </div>
            </div>
          </section>
        </>
      )
    }

    if (questionnaireStep === 1) {
      return (
        <section className="question-block">
          <div className="question-block__copy">
            <h3>从你的生活节奏开始，还原真实相处感</h3>
            <p>这些滑杆不是在给你打分，而是在描述你平时的默认状态。</p>
          </div>
          <div className="range-stack">
            {lifestyleSliders.map((slider) => (
              <RangeField
                key={slider.key}
                label={slider.label}
                hint={slider.hint}
                minLabel={slider.minLabel}
                maxLabel={slider.maxLabel}
                value={Number(questionnaire.objective_answers[slider.key] ?? 5)}
                onChange={(value) => updateObjective(slider.key, value)}
              />
            ))}
          </div>
        </section>
      )
    }

    return (
      <>
        <SelectCardGroup
          title="在一段关系中，你倾向于扮演什么角色？"
          hint="不用追求标准答案，只要选那个最像你在真实互动里会做的事。"
          options={roleOptions}
          value={String(questionnaire.personality_traits.role ?? '')}
          onChange={(value) =>
            setQuestionnaire((current) => ({
              ...current,
              personality_traits: { ...current.personality_traits, role: value },
            }))
          }
        />

        <section className="question-block">
          <div className="question-block__copy">
            <h3>如果要给未来的相遇留一些关键词，你会写什么？</h3>
            <p>可以是爱好、校园日常，也可以是你最希望被理解的那部分自己。</p>
          </div>
          <textarea
            className="tag-textarea"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            rows={4}
            placeholder="例如：羽毛球，二教自习，深夜散步，摇滚现场，摄影，学术型聊天"
          />
          <div className="preference-card">
            <div>
              <strong>是否参与本周匹配</strong>
              <p>开启后，系统会在每周五 21:00 按你的最新画像参与匹配。</p>
            </div>
            <button
              type="button"
              className={`toggle-pill ${questionnaire.opt_in_weekly ? 'is-on' : ''}`}
              onClick={() =>
                setQuestionnaire((current) => ({
                  ...current,
                  opt_in_weekly: !current.opt_in_weekly,
                }))
              }
            >
              <span />
              {questionnaire.opt_in_weekly ? '已加入本周匹配' : '暂不加入'}
            </button>
          </div>
        </section>
      </>
    )
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient--left" />
      <div className="ambient ambient--right" />

      <header className="hero-panel">
        <div className="hero-panel__copy">
          <p className="hero-panel__badge">BIT Date / Closed Campus Social</p>
          <h1>把“填表”变成一段值得期待的相遇旅程。</h1>
          <p className="hero-panel__body">
            为理工科学生设计的慢社交系统。每周五 21:00 派发一次匹配结果，克制、私密，也更重视真实契合。
          </p>
        </div>

        <div className="hero-panel__aside">
          <div className="metric-card">
            <span>已验证用户</span>
            <strong>{stats.verified_users}+</strong>
          </div>
          <div className="metric-card">
            <span>问卷完成率</span>
            <strong>{stats.questionnaire_completion_rate}%</strong>
          </div>
          <div className="metric-card">
            <span>下一次匹配派发</span>
            <strong>{fridayText}</strong>
          </div>
        </div>
      </header>

      <main className="content-grid">
        {!session ? (
          <>
            <section className="surface surface--auth">
              <div className="surface__header">
                <p>进入匹配系统</p>
                <div className="segmented">
                  <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>
                    登录
                  </button>
                  <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>
                    注册
                  </button>
                </div>
              </div>

              {tab === 'login' && (
                <form onSubmit={handleLogin} className="auth-form">
                  <div className="field">
                    <label htmlFor="login-email">校园邮箱</label>
                    <input
                      id="login-email"
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm((v) => ({ ...v, email: e.target.value }))}
                      placeholder="name@bit.edu.cn"
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="login-password">密码</label>
                    <input
                      id="login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((v) => ({ ...v, password: e.target.value }))}
                      placeholder="至少 8 位"
                      required
                    />
                  </div>
                  <button type="submit" className="primary-button" disabled={loading}>
                    {loading ? '正在进入...' : '进入我的匹配空间'}
                  </button>
                </form>
              )}

              {tab === 'register' && (
                <form onSubmit={handleRegister} className="auth-form">
                  <div className="field">
                    <label htmlFor="register-email">校园邮箱</label>
                    <input
                      id="register-email"
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm((v) => ({ ...v, email: e.target.value }))}
                      placeholder="name@bit.edu.cn"
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="register-code">验证码</label>
                    <div className="inline-field">
                      <input
                        id="register-code"
                        value={registerForm.code}
                        onChange={(e) => setRegisterForm((v) => ({ ...v, code: e.target.value }))}
                        placeholder="输入 6 位验证码"
                        required
                      />
                      <button type="button" className="secondary-button" onClick={sendCode} disabled={loading || codeCountdown > 0}>
                        {codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码'}
                      </button>
                    </div>
                    {devCodeHint ? <small className="inline-hint">{devCodeHint}</small> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="register-password">设置密码</label>
                    <input
                      id="register-password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((v) => ({ ...v, password: e.target.value }))}
                      placeholder="至少 8 位"
                      required
                    />
                  </div>
                  <button type="submit" className="primary-button" disabled={loading}>
                    {loading ? '正在创建...' : '开启缘分旅程'}
                  </button>
                </form>
              )}
            </section>

            <section className="surface surface--story">
              <div className="story-card">
                <p className="story-card__eyebrow">Why it feels different</p>
                <h2>不是一股脑填完信息，而是一步步建立一张可信的关系画像。</h2>
                <ul className="story-list">
                  <li>只用校园身份进入，降低噪音和不确定感。</li>
                  <li>匹配节奏固定在每周一次，让关注重新回到质量而不是刷屏。</li>
                  <li>问题设计更接近日常相处，而不是简历式自我介绍。</li>
                </ul>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="surface surface--workspace">
              <div className="workspace-bar">
                <div>
                  <p className="workspace-bar__label">你的系统身份</p>
                  <h2>{session.systemId}</h2>
                  <span>{session.email}</span>
                </div>
                <button className="secondary-button" onClick={logout}>
                  退出登录
                </button>
              </div>

              <div className="workspace-tabs">
                <button className={tab === 'questionnaire' ? 'active' : ''} onClick={() => setTab('questionnaire')}>
                  问卷旅程
                </button>
                <button className={tab === 'match' ? 'active' : ''} onClick={() => setTab('match')}>
                  我的匹配
                </button>
                <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>
                  个人中心
                </button>
              </div>

              {tab === 'questionnaire' && (
                <form onSubmit={saveQuestionnaire} className="questionnaire-shell">
                  <div className="progress-shell">
                    <div className="progress-shell__copy">
                      <p>{activeStep.eyebrow}</p>
                      <h3>{activeStep.title}</h3>
                      <span>{activeStep.description}</span>
                    </div>
                    <div className="progress-shell__meta">
                      <strong>{String(questionnaireStep + 1).padStart(2, '0')}</strong>
                      <span>/ {String(stepMeta.length).padStart(2, '0')}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="questionnaire-stage">{renderQuestionnaireStep()}</div>

                  <div className="journey-footer">
                    <div className="journey-footer__status">
                      <strong>{questionnaire.opt_in_weekly ? '已开启本周匹配' : '当前未加入本周匹配'}</strong>
                      <span>你可以先慢慢填，准备好后再加入本周配对。</span>
                    </div>
                    <div className="journey-footer__actions">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={questionnaireStep === 0}
                        onClick={() => setQuestionnaireStep((current) => Math.max(current - 1, 0))}
                      >
                        上一步
                      </button>
                      {questionnaireStep < stepMeta.length - 1 ? (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => setQuestionnaireStep((current) => Math.min(current + 1, stepMeta.length - 1))}
                        >
                          下一步
                        </button>
                      ) : (
                        <button type="submit" className="primary-button" disabled={loading}>
                          {loading ? '正在保存...' : '保存这份缘分画像'}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              )}

              {tab === 'match' && (
                <div className="match-shell">
                  {match ? (
                    <>
                      <div className="match-shell__hero">
                        <p>本周信封已经送达</p>
                        <h3>{match.partner_system_id}</h3>
                        <strong>{match.score}% 契合度</strong>
                        <span>匹配周起始日期：{match.week_start}</span>
                      </div>
                      <div className="match-shell__reason">
                        <h4>为什么你们会被放到一起？</h4>
                        <p>{match.reason_text}</p>
                      </div>
                      <form onSubmit={submitContact} className="auth-form">
                        <div className="field">
                          <label htmlFor="contact-message">留一句第一印象</label>
                          <textarea
                            id="contact-message"
                            rows={4}
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                            placeholder="可以从一个轻松的话题开始，比如校园日常、实验室作息、周末计划。"
                          />
                        </div>
                        <button type="submit" className="primary-button" disabled={loading}>
                          {loading ? '发送中...' : '发送留言'}
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="empty-state">
                      <p>本周匹配尚未生成</p>
                      <h3>先把问卷画像补完整，系统才知道该把你和谁放在同一封信里。</h3>
                      <span>记得在最后一步打开“参与本周匹配”，每周五 21:00 会自动派发。</span>
                    </div>
                  )}
                </div>
              )}

              {tab === 'profile' && (
                <div className="profile-shell">
                  <div className="profile-shell__item">
                    <span>系统 ID</span>
                    <strong>{session.systemId}</strong>
                  </div>
                  <div className="profile-shell__item">
                    <span>登录邮箱</span>
                    <strong>{session.email}</strong>
                  </div>
                  <div className="profile-shell__item">
                    <span>固定派发时间</span>
                    <strong>每周五 21:00（北京时间）</strong>
                  </div>
                  <div className="profile-shell__item">
                    <span>当前机制</span>
                    <strong>封闭校内、按画像周配对</strong>
                  </div>
                </div>
              )}
            </section>

            <aside className="surface surface--sidebar">
              <div className="sidebar-card">
                <p>匹配节奏</p>
                <strong>{fridayText}</strong>
                <span>系统会按你最近一次保存的画像，生成下一轮匹配。</span>
              </div>
              <div className="sidebar-card">
                <p>成功瞬间</p>
                <strong>{stats.successful_moments}+</strong>
                <span>每一次低噪音、高信任的连接，都来自更真实的问卷颗粒度。</span>
              </div>
            </aside>
          </>
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
