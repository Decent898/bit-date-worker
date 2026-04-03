import type { JsonObject, QuestionnaireRow, UserRow } from './types'
import { randomId, thisWeekMonday, toJsonArray, toJsonObject } from './utils'

type Candidate = {
  userId: string
  systemId: string
  profile: JsonObject
  objective: JsonObject
  traits: JsonObject
  preferences: JsonObject
  tags: string[]
}

type PairScores = {
  lifestyle: number
  coreValues: number
  emotionalDepth: number
  emotionalStyle: number
  attraction: number
  tags: number
  total: number
}

type PairReport = {
  score: number
  detail: string
}

type ScoreLabel = [string, number]

const MODULE_WEIGHTS = {
  lifestyle: 0.24,
  coreValues: 0.18,
  emotionalDepth: 0.18,
  emotionalStyle: 0.16,
  attraction: 0.16,
  tags: 0.08,
} as const

const LIFESTYLE_KEYS = [
  'sleep_time',
  'wake_time',
  'spending_style',
  'social_frequency',
  'exercise',
  'cleanliness',
  'planning_style',
  'weekend_energy',
  'study_rhythm',
] as const

const EMOTIONAL_DEPTH_KEYS = [
  'emotional_openness',
  'empathy',
  'reassurance_need',
  'conflict_tolerance',
  'need_for_space',
  'vulnerability',
] as const

const STYLE_NUMERIC_KEYS = [
  'repair_speed',
  'initiative_preference',
  'exclusivity_importance',
  'public_affection_comfort',
  'independence_balance',
  'future_stability',
  'value_alignment_importance',
] as const

const ATTRACTION_KEYS = [
  'intellectual_resonance',
  'humor_importance',
  'appearance_importance',
  'shared_hobbies_importance',
  'emotional_stability_importance',
  'ambition_importance',
  'chemistry_importance',
] as const

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : null
}

function stringValue(v: unknown): string {
  return String(v ?? '').trim()
}

function closeness(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0.55
  if (a === null || b === null) return 0.55
  return 1 - Math.min(Math.abs(a - b) / 9, 1)
}

function average(values: number[]): number {
  if (values.length === 0) return 0.55
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function numericModuleScore(keys: readonly string[], left: JsonObject, right: JsonObject): number {
  return average(keys.map((key) => closeness(num(left[key]), num(right[key]))))
}

function categoricalScore(
  keys: readonly string[],
  left: JsonObject,
  right: JsonObject,
  matcher?: (key: string, a: string, b: string) => number,
): number {
  return average(
    keys.map((key) => {
      const a = stringValue(left[key])
      const b = stringValue(right[key])
      if (!a && !b) return 0.55
      if (!a || !b) return 0.45
      if (matcher) return matcher(key, a, b)
      return a === b ? 1 : 0.2
    }),
  )
}

function roleComplement(roleA: string, roleB: string): number {
  const pair = `${roleA}:${roleB}`
  if (pair === 'leader:supporter' || pair === 'supporter:leader') return 1
  if (pair === 'planner:explorer' || pair === 'explorer:planner') return 0.85
  if (roleA && roleA === roleB) return 0.55
  return 0.35
}

function styleMatcher(key: string, a: string, b: string): number {
  if (key === 'role') return roleComplement(a, b)
  if (a === b) return 1

  const compatiblePairs = new Set([
    'secure:anxious',
    'anxious:secure',
    'gentle:playful',
    'playful:gentle',
    'talk:repair',
    'repair:talk',
    'pause:repair',
    'repair:pause',
    'direct:gentle',
    'gentle:direct',
  ])

  return compatiblePairs.has(`${a}:${b}`) ? 0.72 : 0.25
}

function tokenizeText(input: string): string[] {
  const lower = input.toLowerCase().replace(/[\n\r\t]/g, ' ')
  const phraseParts = lower
    .split(/[，,、；;。.!！？?\/\\|：:\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const tokens: string[] = []
  for (const part of phraseParts) {
    tokens.push(part)
    const cjk = [...part].filter((char) => /[\u4e00-\u9fff]/.test(char))
    if (cjk.length >= 2) {
      for (let i = 0; i < cjk.length - 1; i += 1) {
        tokens.push(cjk[i] + cjk[i + 1])
      }
    }
    const latinParts = part.split(/[^a-z0-9]+/).filter(Boolean)
    tokens.push(...latinParts)
  }
  return tokens
}

function tokenVector(tags: string[]): Map<string, number> {
  const map = new Map<string, number>()
  const joined = tags.join(' ')
  for (const token of tokenizeText(joined)) {
    map.set(token, (map.get(token) ?? 0) + 1)
  }
  return map
}

function tokenCosine(tagsA: string[], tagsB: string[]): number {
  const a = tokenVector(tagsA)
  const b = tokenVector(tagsB)
  if (a.size === 0 && b.size === 0) return 0.55
  if (a.size === 0 || b.size === 0) return 0.3

  let dot = 0
  let na = 0
  let nb = 0

  for (const value of a.values()) na += value * value
  for (const value of b.values()) nb += value * value
  for (const [token, value] of a.entries()) {
    dot += value * (b.get(token) ?? 0)
  }

  if (na === 0 || nb === 0) return 0.3
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function orientationAccepts(selfProfile: JsonObject, otherProfile: JsonObject): boolean {
  const orientation = stringValue(selfProfile.orientation || 'all') || 'all'
  const selfGender = stringValue(selfProfile.gender)
  const otherGender = stringValue(otherProfile.gender)
  if (orientation === 'all') return true
  if (!selfGender || !otherGender) return true
  if (orientation === 'same') return selfGender === otherGender
  if (orientation === 'different') return selfGender !== otherGender
  return false
}

function ageAccepts(pref: JsonObject, otherProfile: JsonObject): boolean {
  const minAge = num(pref.min_age) ?? 0
  const maxAge = num(pref.max_age) ?? 100
  const otherAge = num(otherProfile.age) ?? 0
  return otherAge >= minAge && otherAge <= maxAge
}

function canMatch(a: Candidate, b: Candidate): boolean {
  return (
    orientationAccepts(a.profile, b.profile) &&
    orientationAccepts(b.profile, a.profile) &&
    ageAccepts(a.preferences, b.profile) &&
    ageAccepts(b.preferences, a.profile)
  )
}

function buildScores(a: Candidate, b: Candidate): PairScores {
  const lifestyle = numericModuleScore(LIFESTYLE_KEYS, a.objective, b.objective)
  const coreValues =
    average([
      categoricalScore(
        ['relationship_goal', 'ideal_date_style'],
        a.profile,
        b.profile,
        (_key, left, right) => (left === right ? 1 : 0.35),
      ),
      categoricalScore(
        ['relationship_pace', 'life_priority', 'commitment_view', 'growth_orientation'],
        a.preferences,
        b.preferences,
        (_key, left, right) => (left === right ? 1 : 0.32),
      ),
      numericModuleScore(['independence_balance', 'future_stability', 'value_alignment_importance'], a.preferences, b.preferences),
    ])

  const emotionalDepth = numericModuleScore(EMOTIONAL_DEPTH_KEYS, a.objective, b.objective)

  const emotionalStyle =
    average([
      categoricalScore(['role', 'attachment_style', 'flirting_style', 'conflict_mode'], a.traits, b.traits, styleMatcher),
      numericModuleScore(STYLE_NUMERIC_KEYS, a.objective, b.objective),
    ])

  const attraction = numericModuleScore(ATTRACTION_KEYS, a.objective, b.objective)
  const tags = tokenCosine(a.tags, b.tags)

  const total =
    lifestyle * MODULE_WEIGHTS.lifestyle +
    coreValues * MODULE_WEIGHTS.coreValues +
    emotionalDepth * MODULE_WEIGHTS.emotionalDepth +
    emotionalStyle * MODULE_WEIGHTS.emotionalStyle +
    attraction * MODULE_WEIGHTS.attraction +
    tags * MODULE_WEIGHTS.tags

  return {
    lifestyle,
    coreValues,
    emotionalDepth,
    emotionalStyle,
    attraction,
    tags,
    total: Number((total * 100).toFixed(2)),
  }
}

function topHighlights(scores: PairScores): string[] {
  const labels: ScoreLabel[] = [
    ['生活节奏', scores.lifestyle],
    ['核心价值观', scores.coreValues],
    ['情感颗粒度', scores.emotionalDepth],
    ['情感风格', scores.emotionalStyle],
    ['吸引力预期', scores.attraction],
    ['标签语义', scores.tags],
  ]

  return labels
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, value]) => `${label}${Math.round(value * 100)}%`)
}

function topGaps(scores: PairScores): string[] {
  const labels: ScoreLabel[] = [
    ['生活节奏', scores.lifestyle],
    ['核心价值观', scores.coreValues],
    ['情感颗粒度', scores.emotionalDepth],
    ['情感风格', scores.emotionalStyle],
    ['吸引力预期', scores.attraction],
    ['标签语义', scores.tags],
  ]

  return labels
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([label, value]) => `${label}${Math.round(value * 100)}%`)
}

function buildReport(a: Candidate, b: Candidate, scores: PairScores): PairReport {
  const sharedHighlights = topHighlights(scores)
  const gapHighlights = topGaps(scores)
  const detail =
    `${a.systemId} 和 ${b.systemId} 综合匹配度 ${scores.total}%。` +
    ` 模块分布：生活节奏 ${Math.round(scores.lifestyle * 100)}%，核心价值观 ${Math.round(scores.coreValues * 100)}%，` +
    `情感颗粒度 ${Math.round(scores.emotionalDepth * 100)}%，情感风格 ${Math.round(scores.emotionalStyle * 100)}%，` +
    `吸引力预期 ${Math.round(scores.attraction * 100)}%，标签语义 ${Math.round(scores.tags * 100)}%。` +
    ` 最契合的是 ${sharedHighlights.join('、')}。` +
    ` 需要磨合的可能是 ${gapHighlights.join('、')}。` +
    ` 建议第一轮交流先围绕彼此最强的契合模块展开，再观察低分模块里的真实互动感。`

  return {
    score: scores.total,
    detail,
  }
}

export async function runWeeklyMatching(
  db: D1Database,
): Promise<{ created: number; weekStart: string; candidateCount: number; pairCount: number }> {
  const weekStart = thisWeekMonday()

  await db.prepare('DELETE FROM match_results WHERE week_start = ?').bind(weekStart).run()

  const usersResult = await db.prepare('SELECT id, system_id, email, password_hash FROM users').all<UserRow>()
  const users = usersResult.results ?? []
  const userMap = new Map(users.map((u) => [u.id, u]))

  const qResult = await db
    .prepare(
      'SELECT user_id, profile, objective_answers, personality_traits, preferences, tags, opt_in_weekly FROM questionnaires WHERE opt_in_weekly = 1',
    )
    .all<QuestionnaireRow>()
  const questionnaires = qResult.results ?? []

  const candidates: Candidate[] = questionnaires
    .map((q) => {
      const user = userMap.get(q.user_id)
      if (!user) return null
      return {
        userId: q.user_id,
        systemId: user.system_id,
        profile: toJsonObject(q.profile),
        objective: toJsonObject(q.objective_answers),
        traits: toJsonObject(q.personality_traits),
        preferences: toJsonObject(q.preferences),
        tags: toJsonArray(q.tags),
      }
    })
    .filter((value): value is Candidate => value !== null)

  const pairs: Array<{ a: Candidate; b: Candidate; score: number; detail: string }> = []
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i]
      const b = candidates[j]
      if (!canMatch(a, b)) continue
      const scores = buildScores(a, b)
      const report = buildReport(a, b, scores)
      pairs.push({ a, b, score: report.score, detail: report.detail })
    }
  }

  pairs.sort((left, right) => right.score - left.score)
  const used = new Set<string>()
  let created = 0

  for (const pair of pairs) {
    if (used.has(pair.a.userId) || used.has(pair.b.userId)) continue

    await db
      .prepare(
        'INSERT INTO match_results (id, week_start, user_a_id, user_b_id, score, reason_text, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(randomId('m_'), weekStart, pair.a.userId, pair.b.userId, pair.score, pair.detail, 'visible')
      .run()

    used.add(pair.a.userId)
    used.add(pair.b.userId)
    created += 1
  }

  return {
    created,
    weekStart,
    candidateCount: candidates.length,
    pairCount: pairs.length,
  }
}
