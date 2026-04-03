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
    relationship_goal: '',
    ideal_date_style: '',
  },
  objective_answers: {
    sleep_time: 5,
    wake_time: 5,
    spending_style: 5,
    social_frequency: 5,
    exercise: 5,
    cleanliness: 5,
    planning_style: 5,
    weekend_energy: 5,
    study_rhythm: 5,
    emotional_openness: 5,
    empathy: 5,
    reassurance_need: 5,
    conflict_tolerance: 5,
    need_for_space: 5,
    vulnerability: 5,
    repair_speed: 5,
    initiative_preference: 5,
    exclusivity_importance: 5,
    public_affection_comfort: 5,
    intellectual_resonance: 5,
    humor_importance: 5,
    appearance_importance: 5,
    shared_hobbies_importance: 5,
    emotional_stability_importance: 5,
    ambition_importance: 5,
    chemistry_importance: 5,
  },
  personality_traits: {
    role: '',
    attachment_style: '',
    flirting_style: '',
    conflict_mode: '',
  },
  preferences: {
    min_age: 18,
    max_age: 25,
    relationship_pace: '',
    life_priority: '',
    commitment_view: '',
    growth_orientation: '',
    independence_balance: 5,
    future_stability: 5,
    value_alignment_importance: 5,
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

const relationshipGoalOptions: CardOption[] = [
  { value: 'serious', title: '认真了解', caption: '更期待长期、稳定、逐步确认的关系', icon: '💍' },
  { value: 'slow_burn', title: '慢热靠近', caption: '先从高质量相处开始，不急着定义', icon: '🌙' },
  { value: 'friendship_first', title: '朋友优先', caption: '先成为舒服的人，再看会不会更进一步', icon: '🫶' },
  { value: 'open', title: '保持开放', caption: '愿意认识新的人，也接受关系自然生长', icon: '🌿' },
]

const idealDateStyleOptions: CardOption[] = [
  { value: 'quiet', title: '安静型约会', caption: '散步、咖啡、自习之后一起吃饭', icon: '☕' },
  { value: 'citywalk', title: '校园漫游', caption: '边走边聊，慢慢从小事里熟悉彼此', icon: '🚶' },
  { value: 'activity', title: '活动体验', caption: '羽毛球、展览、livehouse、短途出走', icon: '🎫' },
  { value: 'deep_talk', title: '深聊型相处', caption: '我会被真诚、深入、有来有回的对话吸引', icon: '🗣️' },
]

const relationshipPaceOptions: CardOption[] = [
  { value: 'slow', title: '慢慢来', caption: '节奏越稳，越能确认是不是彼此舒服', icon: '🐢' },
  { value: 'balanced', title: '自然推进', caption: '有感觉就往前走，但不需要过早定义', icon: '⚖️' },
  { value: 'clear', title: '希望明确', caption: '我更喜欢比较清晰的关系推进节奏', icon: '🎯' },
]

const lifePriorityOptions: CardOption[] = [
  { value: 'career', title: '事业成长', caption: '我会被有目标感和成长欲的人吸引', icon: '🚀' },
  { value: 'balance', title: '生活平衡', caption: '我更看重稳定、松弛、长期可持续', icon: '🪞' },
  { value: 'connection', title: '情感连接', caption: '关系质量和精神共鸣对我尤其重要', icon: '💞' },
]

const commitmentViewOptions: CardOption[] = [
  { value: 'exclusive', title: '偏向专一投入', caption: '一旦开始认真了解，我倾向于收束注意力', icon: '🔒' },
  { value: 'gradual', title: '边观察边投入', caption: '确认契合后，我会自然进入更稳定的状态', icon: '🔍' },
  { value: 'light', title: '先轻松相处', caption: '前期更看感觉，不急着做承诺', icon: '🍃' },
]

const growthOrientationOptions: CardOption[] = [
  { value: 'stable', title: '稳定陪伴型', caption: '我喜欢情绪稳定、步调扎实的相处方式', icon: '🧱' },
  { value: 'mutual', title: '共同成长型', caption: '希望彼此能互相激发、互相托举', icon: '🌱' },
  { value: 'spark', title: '火花驱动型', caption: '我更容易被强烈吸引感和新鲜感点燃', icon: '⚡' },
]

const attachmentStyleOptions: CardOption[] = [
  { value: 'secure', title: '安全型', caption: '我通常表达稳定，也不太害怕靠近', icon: '🫧' },
  { value: 'anxious', title: '敏感型', caption: '我会更在意回应速度和关系确定感', icon: '💭' },
  { value: 'avoidant', title: '克制型', caption: '我需要空间，也不喜欢被关系压得太紧', icon: '🛰️' },
]

const flirtingStyleOptions: CardOption[] = [
  { value: 'gentle', title: '温柔试探', caption: '我会通过照顾、关心和陪伴慢慢靠近', icon: '🌤️' },
  { value: 'playful', title: '轻松有梗', caption: '有趣、会聊天、会接梗对我很重要', icon: '🎈' },
  { value: 'direct', title: '直接真诚', caption: '我更欣赏表达清楚、态度明确的靠近', icon: '🧭' },
]

const conflictModeOptions: CardOption[] = [
  { value: 'talk', title: '倾向当下沟通', caption: '有问题最好及时说开，不想长久悬着', icon: '🗨️' },
  { value: 'pause', title: '先缓一缓', caption: '我需要先沉淀情绪，再进入有效讨论', icon: '⏸️' },
  { value: 'repair', title: '重视修复感', caption: '比谁对谁错更重要的是彼此怎么回到同一边', icon: '🪡' },
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
  {
    key: 'cleanliness',
    label: '整洁度',
    hint: '你的日常环境更偏随性还是规整？',
    minLabel: '🌀 随手流',
    maxLabel: '🧼 强秩序感',
  },
  {
    key: 'planning_style',
    label: '计划感',
    hint: '面对生活安排时，你更偏计划还是即兴？',
    minLabel: '🎲 顺其自然',
    maxLabel: '🗂️ 提前规划',
  },
  {
    key: 'weekend_energy',
    label: '周末能量',
    hint: '周末你通常想回血，还是继续探索世界？',
    minLabel: '🧸 低耗恢复',
    maxLabel: '🚄 高能出动',
  },
  {
    key: 'study_rhythm',
    label: '学习节奏',
    hint: '你更适应稳定推进，还是冲刺爆发式完成？',
    minLabel: '📚 均匀推进',
    maxLabel: '🔥 截止驱动',
  },
]

const emotionalSliders: SliderConfig[] = [
  {
    key: 'emotional_openness',
    label: '情绪表达',
    hint: '你会把情绪状态直接说出来，还是更习惯自己消化？',
    minLabel: '🫥 比较克制',
    maxLabel: '🫱 愿意表达',
  },
  {
    key: 'empathy',
    label: '共情敏感度',
    hint: '你对他人情绪变化的感知有多强？',
    minLabel: '🧱 偏理性',
    maxLabel: '🌊 很能感受',
  },
  {
    key: 'reassurance_need',
    label: '确认感需求',
    hint: '在关系里，你有多需要被明确回应和安抚？',
    minLabel: '🛰️ 自我稳定',
    maxLabel: '💌 很需要确认',
  },
  {
    key: 'conflict_tolerance',
    label: '冲突耐受',
    hint: '你面对分歧时更容易想回避，还是愿意扛住不舒服继续沟通？',
    minLabel: '🌫️ 容易退开',
    maxLabel: '🪨 可以扛住',
  },
  {
    key: 'need_for_space',
    label: '私人空间',
    hint: '你在关系里需要多少自己的独处空间？',
    minLabel: '🤍 更想贴近',
    maxLabel: '🌌 很需要空间',
  },
  {
    key: 'vulnerability',
    label: '脆弱表达',
    hint: '你愿意把不安、疲惫、脆弱说给对方听吗？',
    minLabel: '🪞 很少说',
    maxLabel: '🫶 愿意袒露',
  },
]

const attractionSliders: SliderConfig[] = [
  {
    key: 'intellectual_resonance',
    label: '思维共鸣',
    hint: '聊得来、脑回路对上，对你有多重要？',
    minLabel: '🙂 加分项',
    maxLabel: '🧠 核心吸引力',
  },
  {
    key: 'humor_importance',
    label: '幽默感',
    hint: '会接梗、懂幽默，会大幅影响你的好感吗？',
    minLabel: '😌 可有可无',
    maxLabel: '🤣 非常重要',
  },
  {
    key: 'appearance_importance',
    label: '外在吸引',
    hint: '第一眼的外在感觉，在你的判断里占多大比重？',
    minLabel: '🌫️ 不太关键',
    maxLabel: '✨ 影响很大',
  },
  {
    key: 'shared_hobbies_importance',
    label: '共同爱好',
    hint: '有共同活动和兴趣，会不会显著提高你的进入感？',
    minLabel: '🧩 不是必须',
    maxLabel: '🎯 很重要',
  },
  {
    key: 'emotional_stability_importance',
    label: '情绪稳定',
    hint: '你会多看重一个人的稳定感和处理情绪的能力？',
    minLabel: '🙂 普通重要',
    maxLabel: '🛟 极其重要',
  },
  {
    key: 'ambition_importance',
    label: '目标感',
    hint: '你会被有方向感、有野心的人吸引吗？',
    minLabel: '🍃 顺其自然也很好',
    maxLabel: '📈 很有吸引力',
  },
  {
    key: 'chemistry_importance',
    label: '化学反应',
    hint: '比起条件匹配，你有多看重“就是有感觉”？',
    minLabel: '🧾 更看条件',
    maxLabel: '⚡ 很看感觉',
  },
]

const styleSliders: SliderConfig[] = [
  {
    key: 'repair_speed',
    label: '修复速度',
    hint: '发生不舒服后，你希望多快回到沟通和修复？',
    minLabel: '🕰️ 慢一点再说',
    maxLabel: '🔧 尽快修复',
  },
  {
    key: 'initiative_preference',
    label: '主动程度',
    hint: '关系推进里，你更习惯自己主动还是更希望对方先发出信号？',
    minLabel: '🌙 更希望被带动',
    maxLabel: '🔥 我愿意主动',
  },
  {
    key: 'exclusivity_importance',
    label: '专一感预期',
    hint: '进入认真了解阶段后，你有多在意对方是否收束注意力？',
    minLabel: '🌫️ 不急着限定',
    maxLabel: '🔒 很在意',
  },
  {
    key: 'public_affection_comfort',
    label: '公开表达舒适度',
    hint: '你对在公开场合展现亲密或关系存在感的接受度如何？',
    minLabel: '🫥 越低调越好',
    maxLabel: '🌤️ 自然公开也可以',
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
    title: '你的核心价值观，会决定一段关系的走向',
    description: '这部分不是在挑标准答案，而是在捕捉你真正重视什么。'
  },
  {
    eyebrow: 'Module 04',
    title: '你的情感颗粒度，决定彼此能否被温柔理解',
    description: '当关系开始变真实，情绪如何流动，往往比表面条件更关键。',
  },
  {
    eyebrow: 'Module 05',
    title: '你在情感里的默认风格，是怎样靠近和修复的',
    description: '关系风格不需要完美，但足够可读，系统才更容易筛到真正合适的人。'
  },
  {
    eyebrow: 'Module 06',
    title: '最后说说，你会被什么样的人真正吸引',
    description: '把吸引力、预期和关键词补全，这份画像就会更接近真实的你。',
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

  function updatePreferenceValue(key: string, value: unknown) {
    setQuestionnaire((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }))
  }

  function updateTraitValue(key: string, value: unknown) {
    setQuestionnaire((current) => ({
      ...current,
      personality_traits: { ...current.personality_traits, [key]: value },
    }))
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

    if (questionnaireStep === 2) {
      return (
        <>
          <SelectCardGroup
            title="你更希望关系以怎样的节奏推进？"
            hint="有的人需要慢慢确认，有的人更希望早一点知道彼此是不是认真。"
            options={relationshipPaceOptions}
            value={String(questionnaire.preferences.relationship_pace ?? '')}
            onChange={(value) => updatePreferenceValue('relationship_pace', value)}
          />

          <SelectCardGroup
            title="现阶段的人生里，你更看重什么？"
            hint="关系不是脱离现实的，它一定会和你眼下的重心产生互动。"
            options={lifePriorityOptions}
            value={String(questionnaire.preferences.life_priority ?? '')}
            onChange={(value) => updatePreferenceValue('life_priority', value)}
          />

          <SelectCardGroup
            title="你怎么看待“开始认真了解”这件事？"
            hint="不同人对投入边界的理解不一样，提前对齐会减少很多误解。"
            options={commitmentViewOptions}
            value={String(questionnaire.preferences.commitment_view ?? '')}
            onChange={(value) => updatePreferenceValue('commitment_view', value)}
          />

          <SelectCardGroup
            title="你理想中的关系，更像哪一种成长方式？"
            hint="稳定、共进，还是火花驱动？这会直接影响你被什么样的人打动。"
            options={growthOrientationOptions}
            value={String(questionnaire.preferences.growth_orientation ?? '')}
            onChange={(value) => updatePreferenceValue('growth_orientation', value)}
          />

          <section className="question-block">
            <div className="question-block__copy">
              <h3>再补三道更细的价值观刻度</h3>
              <p>让系统知道，你对边界感、稳定感和价值同频究竟看得有多重。</p>
            </div>
            <div className="range-stack">
              <RangeField
                label="亲密与独立"
                hint="你希望关系多紧密？又保留多少个人边界？"
                minLabel="🫱 更想贴近"
                maxLabel="🪐 更重独立"
                value={Number(questionnaire.preferences.independence_balance ?? 5)}
                onChange={(value) => updatePreferenceValue('independence_balance', value)}
              />
              <RangeField
                label="稳定感需求"
                hint="一段关系里，稳定、规律、可预期对你有多重要？"
                minLabel="🌿 自然就好"
                maxLabel="🧱 很重要"
                value={Number(questionnaire.preferences.future_stability ?? 5)}
                onChange={(value) => updatePreferenceValue('future_stability', value)}
              />
              <RangeField
                label="价值观对齐"
                hint="三观接近这件事，在你的好感形成里占多大比重？"
                minLabel="🙂 加分项"
                maxLabel="🧭 核心条件"
                value={Number(questionnaire.preferences.value_alignment_importance ?? 5)}
                onChange={(value) => updatePreferenceValue('value_alignment_importance', value)}
              />
            </div>
          </section>
        </>
      )
    }

    if (questionnaireStep === 3) {
      return (
        <section className="question-block">
          <div className="question-block__copy">
            <h3>情感颗粒度，是“聊得来”之外更深的一层契合</h3>
            <p>这一组会帮助系统判断，你是怎样感受、处理和表达情绪的。</p>
          </div>
          <div className="range-stack">
            {emotionalSliders.map((slider) => (
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

    if (questionnaireStep === 4) {
      return (
        <>
          <SelectCardGroup
            title="在一段关系中，你倾向于扮演什么角色？"
            hint="不用追求标准答案，只要选那个最像你在真实互动里会做的事。"
            options={roleOptions}
            value={String(questionnaire.personality_traits.role ?? '')}
            onChange={(value) => updateTraitValue('role', value)}
          />

          <SelectCardGroup
            title="你的情感依附风格更接近哪一种？"
            hint="不是心理学考试，只是帮助系统捕捉你在靠近关系时的默认反应。"
            options={attachmentStyleOptions}
            value={String(questionnaire.personality_traits.attachment_style ?? '')}
            onChange={(value) => updateTraitValue('attachment_style', value)}
          />

          <SelectCardGroup
            title="你会用什么方式释放好感？"
            hint="有人靠细节，有人靠幽默，有人靠直接表达。"
            options={flirtingStyleOptions}
            value={String(questionnaire.personality_traits.flirting_style ?? '')}
            onChange={(value) => updateTraitValue('flirting_style', value)}
          />

          <SelectCardGroup
            title="出现不舒服时，你更接近哪种处理方式？"
            hint="这会影响一段关系遇到摩擦时，彼此是不是容易错开。"
            options={conflictModeOptions}
            value={String(questionnaire.personality_traits.conflict_mode ?? '')}
            onChange={(value) => updateTraitValue('conflict_mode', value)}
          />

          <section className="question-block">
            <div className="question-block__copy">
              <h3>再往前一步，把你的互动风格量化出来</h3>
              <p>这些不是对错题，只是让关系风格更具体、更能被真正理解。</p>
            </div>
            <div className="range-stack">
              {styleSliders.map((slider) => (
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
        </>
      )
    }

    return (
      <>
        <SelectCardGroup
          title="你更希望第一次约会像什么？"
          hint="它不一定真的发生，但能很好地暴露你期待怎样的靠近方式。"
          options={idealDateStyleOptions}
          value={String(questionnaire.profile.ideal_date_style ?? '')}
          onChange={(value) => updateProfile('ideal_date_style', value)}
        />

        <SelectCardGroup
          title="你现在想开启的是怎样的关系旅程？"
          hint="不需要给未来下定义，只要说清楚你此刻愿意走到哪一步。"
          options={relationshipGoalOptions}
          value={String(questionnaire.profile.relationship_goal ?? '')}
          onChange={(value) => updateProfile('relationship_goal', value)}
        />

        <section className="question-block">
          <div className="question-block__copy">
            <h3>吸引力与预期，比“条件匹配”更接近真实心动</h3>
            <p>这组问题会让系统更接近你真正会心动的那种人，而不是只有表面合适。</p>
          </div>
          <div className="range-stack">
            {attractionSliders.map((slider) => (
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

        <section className="question-block">
          <div className="question-block__copy">
            <h3>最后，用关键词把这份画像补到更像你</h3>
            <p>可以是兴趣、校园日常、情绪偏好，也可以是你最希望被对方读懂的细节。</p>
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
