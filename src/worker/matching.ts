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

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0)
}

function objectiveVector(answers: JsonObject): number[] {
  return ['sleep_time', 'wake_time', 'spending_style', 'social_frequency', 'exercise'].map((k) => num(answers[k]))
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function complement(traitsA: JsonObject, traitsB: JsonObject): number {
  const roleA = String(traitsA.role ?? '')
  const roleB = String(traitsB.role ?? '')
  const pair = `${roleA}:${roleB}`
  if (pair === 'leader:supporter' || pair === 'supporter:leader') return 1
  if (pair === 'planner:explorer' || pair === 'explorer:planner') return 0.8
  return 0.3
}

function orientationAccepts(selfProfile: JsonObject, otherProfile: JsonObject): boolean {
  const orientation = String(selfProfile.orientation ?? 'all')
  const selfGender = String(selfProfile.gender ?? '')
  const otherGender = String(otherProfile.gender ?? '')
  if (orientation === 'all') return true
  if (orientation === 'same') return selfGender === otherGender
  if (orientation === 'different') return selfGender !== otherGender
  return false
}

function ageAccepts(pref: JsonObject, otherProfile: JsonObject): boolean {
  const minAge = num(pref.min_age || 0)
  const maxAge = num(pref.max_age || 100)
  const otherAge = num(otherProfile.age || 0)
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

function score(a: Candidate, b: Candidate): number {
  const sim = cosine(objectiveVector(a.objective), objectiveVector(b.objective))
  const comp = complement(a.traits, b.traits)
  const overlap = a.tags.filter((t) => b.tags.includes(t)).length
  const tagScore = Math.min(overlap / 5, 1)
  const final = (0.55 * sim + 0.3 * comp + 0.15 * tagScore) * 100
  return Number(final.toFixed(2))
}

function reason(a: Candidate, b: Candidate, scoreValue: number): string {
  const shared = a.tags.filter((t) => b.tags.includes(t)).slice(0, 3)
  const sharedText = shared.length > 0 ? `你们都喜欢 ${shared.join('、')}` : '你们在节奏和性格上互补'
  return `${a.systemId} 和 ${b.systemId} 匹配度 ${scoreValue}%。${sharedText}，建议先从一次轻松散步或晚饭开始。`
}

export async function runWeeklyMatching(
  db: D1Database,
): Promise<{ created: number; weekStart: string; candidateCount: number; pairCount: number }> {
  const weekStart = thisWeekMonday()

  await db.prepare('DELETE FROM match_results WHERE week_start = ?').bind(weekStart).run()

  const usersResult = await db
    .prepare('SELECT id, system_id, email, password_hash FROM users')
    .all<UserRow>()
  const users = usersResult.results ?? []
  const userMap = new Map(users.map((u) => [u.id, u]))

  const qResult = await db
    .prepare('SELECT user_id, profile, objective_answers, personality_traits, preferences, tags, opt_in_weekly FROM questionnaires WHERE opt_in_weekly = 1')
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
    .filter((v): v is Candidate => v !== null)

  const pairs: Array<{ a: Candidate; b: Candidate; score: number }> = []
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i]
      const b = candidates[j]
      if (!canMatch(a, b)) continue
      pairs.push({ a, b, score: score(a, b) })
    }
  }

  pairs.sort((x, y) => y.score - x.score)
  const used = new Set<string>()
  let created = 0

  for (const pair of pairs) {
    if (used.has(pair.a.userId) || used.has(pair.b.userId)) continue

    await db
      .prepare(
        'INSERT INTO match_results (id, week_start, user_a_id, user_b_id, score, reason_text, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        randomId('m_'),
        weekStart,
        pair.a.userId,
        pair.b.userId,
        pair.score,
        reason(pair.a, pair.b, pair.score),
        'visible',
      )
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
