import { Hono } from 'hono'
import type { Context } from 'hono'
import { runWeeklyMatching } from './matching'
import type { Env, MatchRow, QuestionnaireRow, UserRow } from './types'
import {
  badRequest,
  base64UrlDecode,
  base64UrlEncode,
  generateSystemId,
  hmacSign,
  isEduEmail,
  json,
  nowIso,
  randomCode,
  randomId,
  sha256,
  thisWeekMonday,
  toJsonArray,
  toJsonObject,
  unauthorized,
} from './utils'

const app = new Hono<{ Bindings: Env }>()

const DEFAULT_SETTINGS = {
  matching_weekday: '5',
  matching_hour: '21',
  matching_minute: '0',
  matching_timezone: 'Asia/Shanghai',
  email_provider: 'resend',
  resend_api_key: '',
  smtp_host: '',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_user: '',
  smtp_password: '',
  sender_name: 'BIT Date',
  sender_email: '',
}

type AuthUser = {
  id: string
  email: string
  systemId: string
}

function dayCode(weekdayText: string): number {
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[weekdayText] ?? -1
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomId('s_')
  const digest = await sha256(`${salt}:${password}`)
  return `${salt}:${digest}`
}

async function verifyPassword(password: string, packed: string): Promise<boolean> {
  const parts = packed.split(':')
  if (parts.length !== 2) return false
  const [salt, expected] = parts
  const digest = await sha256(`${salt}:${password}`)
  return digest === expected
}

async function createToken(secret: string, userId: string): Promise<string> {
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
    iat: Math.floor(Date.now() / 1000),
  }
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await hmacSign(secret, encoded)
  return `${encoded}.${sig}`
}

async function verifyToken(secret: string, token: string): Promise<string | null> {
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return null
  const expected = await hmacSign(secret, encoded)
  if (expected !== sig) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as {
      sub?: string
      exp?: number
    }
    if (!payload.sub || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.sub
  } catch {
    return null
  }
}

async function requireAdmin(c: Context<{ Bindings: Env }>): Promise<Response | null> {
  const secret = c.req.header('x-admin-secret')
  if (!secret || secret !== c.env.ADMIN_SECRET) {
    return unauthorized('Invalid admin secret')
  }
  return null
}

async function getAuthedUser(c: Context<{ Bindings: Env }>): Promise<AuthUser | Response> {
  const auth = c.req.header('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return unauthorized('Missing bearer token')

  const token = auth.slice('Bearer '.length)
  const userId = await verifyToken(c.env.TOKEN_SECRET, token)
  if (!userId) return unauthorized('Invalid token')

  const row = await c.env.DB.prepare('SELECT id, email, system_id FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; system_id: string }>()

  if (!row) return unauthorized('User not found')

  return {
    id: row.id,
    email: row.email,
    systemId: row.system_id,
  }
}

async function getSettingsMap(db: D1Database): Promise<Record<string, string>> {
  const rows = await db.prepare('SELECT key, value FROM app_settings').all<{ key: string; value: string }>()
  const map: Record<string, string> = { ...DEFAULT_SETTINGS }
  for (const item of rows.results ?? []) {
    map[item.key] = item.value
  }
  return map
}

async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
    )
    .bind(key, value)
    .run()
}

function shouldRunNow(settings: Record<string, string>, now = new Date()): boolean {
  const zone = settings.matching_timezone || 'Asia/Shanghai'
  const weekdayTarget = Number(settings.matching_weekday || '5')
  const hourTarget = Number(settings.matching_hour || '21')
  const minuteTarget = Number(settings.matching_minute || '0')

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = dtf.formatToParts(now)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '-1')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '-1')
  return dayCode(weekday) === weekdayTarget && hour === hourTarget && minute === minuteTarget
}

async function queueOutbox(
  db: D1Database,
  payload: {
    toEmail: string
    subject: string
    body: string
    provider: string
    meta?: string
    status?: 'queued' | 'simulated' | 'failed' | 'sent'
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO email_outbox
       (id, to_email, subject, body, provider, status, error, created_at, sent_at, meta)
       VALUES (?, ?, ?, ?, ?, ?, '', CURRENT_TIMESTAMP, NULL, ?)`,
    )
    .bind(
      randomId('em_'),
      payload.toEmail,
      payload.subject,
      payload.body,
      payload.provider,
      payload.status ?? 'queued',
      payload.meta ?? '',
    )
    .run()
}

async function createOutboxRecord(
  db: D1Database,
  payload: {
    toEmail: string
    subject: string
    body: string
    provider: string
    meta?: string
  },
): Promise<string> {
  const id = randomId('em_')
  await db
    .prepare(
      `INSERT INTO email_outbox
       (id, to_email, subject, body, provider, status, error, created_at, sent_at, meta)
       VALUES (?, ?, ?, ?, ?, 'queued', '', CURRENT_TIMESTAMP, NULL, ?)`,
    )
    .bind(
      id,
      payload.toEmail,
      payload.subject,
      payload.body,
      payload.provider,
      payload.meta ?? '',
    )
    .run()
  return id
}

async function markOutboxSent(db: D1Database, outboxId: string): Promise<void> {
  await db
    .prepare("UPDATE email_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error = '' WHERE id = ?")
    .bind(outboxId)
    .run()
}

async function markOutboxFailed(db: D1Database, outboxId: string, error: string): Promise<void> {
  await db
    .prepare("UPDATE email_outbox SET status = 'failed', error = ? WHERE id = ?")
    .bind(error.slice(0, 2000), outboxId)
    .run()
}

async function dispatchEmail(
  db: D1Database,
  settings: Record<string, string>,
  payload: {
    toEmail: string
    subject: string
    body: string
    meta?: string
  },
): Promise<{ ok: boolean; provider: string; message: string }> {
  const provider = settings.email_provider || 'resend'
  const outboxId = await createOutboxRecord(db, {
    toEmail: payload.toEmail,
    subject: payload.subject,
    body: payload.body,
    provider,
    meta: payload.meta,
  })

  try {
    if (provider === 'resend') {
      const apiKey = settings.resend_api_key || ''
      const senderEmail = settings.sender_email || ''
      const senderName = settings.sender_name || 'BIT Date'
      if (!apiKey || !senderEmail) {
        throw new Error('Resend not configured: resend_api_key/sender_email is empty')
      }
      const from = `${senderName} <${senderEmail}>`
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [payload.toEmail],
          subject: payload.subject,
          text: payload.body,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Resend API failed: ${res.status} ${errText}`)
      }
    } else if (provider === 'mailchannels') {
      const senderEmail = settings.sender_email || ''
      const senderName = settings.sender_name || 'BIT Date'
      if (!senderEmail) {
        throw new Error('MailChannels not configured: sender_email is empty')
      }
      const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.toEmail }] }],
          from: { email: senderEmail, name: senderName },
          subject: payload.subject,
          content: [{ type: 'text/plain', value: payload.body }],
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`MailChannels API failed: ${res.status} ${errText}`)
      }
    } else {
      throw new Error(
        'Provider not supported in Cloudflare Worker runtime. Please use "resend" or "mailchannels".',
      )
    }

    await markOutboxSent(db, outboxId)
    return { ok: true, provider, message: `Email sent via ${provider}` }
  } catch (error) {
    await markOutboxFailed(db, outboxId, String(error))
    return { ok: false, provider, message: String(error) }
  }
}

async function executeMatchingRun(
  db: D1Database,
  source: 'cron' | 'manual',
): Promise<{ runId: string; created: number; weekStart: string; candidateCount: number; pairCount: number }> {
  const runId = randomId('run_')
  const startedAt = nowIso()

  await db
    .prepare(
      `INSERT INTO matching_runs
       (id, trigger_source, started_at, finished_at, status, week_start, candidate_count, pair_count, created_matches, error)
       VALUES (?, ?, ?, '', 'running', '', 0, 0, 0, '')`,
    )
    .bind(runId, source, startedAt)
    .run()

  try {
    const result = await runWeeklyMatching(db)
    await db
      .prepare(
        `UPDATE matching_runs
         SET finished_at = ?, status = 'success', week_start = ?, candidate_count = ?, pair_count = ?, created_matches = ?
         WHERE id = ?`,
      )
      .bind(nowIso(), result.weekStart, result.candidateCount, result.pairCount, result.created, runId)
      .run()
    return { runId, ...result }
  } catch (error) {
    await db
      .prepare(
        `UPDATE matching_runs
         SET finished_at = ?, status = 'failed', error = ?
         WHERE id = ?`,
      )
      .bind(nowIso(), String(error), runId)
      .run()
    throw error
  }
}

app.get('/api/health', () => json({ status: 'ok', at: nowIso() }))

app.post('/api/auth/send-code', async (c) => {
  const body = await c.req
    .json<{ email?: string }>()
    .catch(() => ({}) as { email?: string })
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!isEduEmail(email)) return badRequest('Only .edu.cn emails are allowed')

  const code = randomCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const settings = await getSettingsMap(c.env.DB)

  await c.env.DB.prepare(
    `INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at`,
  )
    .bind(email, code, expiresAt)
    .run()

  const mailResult = await dispatchEmail(c.env.DB, settings, {
    toEmail: email,
    subject: '校园慢社交验证码',
    body: `你的验证码是 ${code}，10 分钟内有效。`,
  })

  if (!mailResult.ok) {
    return json(
      {
        message: `验证码已生成，但发送失败：${mailResult.message}`,
        dev_code: code,
      },
      503,
    )
  }
  return json({ message: `验证码已发送（${mailResult.provider}）` })
})

app.post('/api/auth/register', async (c) => {
  const body = await c.req
    .json<{ email?: string; code?: string; password?: string }>()
    .catch(() => ({}) as { email?: string; code?: string; password?: string })

  const email = String(body.email ?? '').trim().toLowerCase()
  const code = String(body.code ?? '').trim()
  const password = String(body.password ?? '')

  if (!isEduEmail(email)) return badRequest('Only .edu.cn emails are allowed')
  if (password.length < 8) return badRequest('Password must be at least 8 chars')
  if (!/^\d{6}$/.test(code)) return badRequest('Invalid verification code format')

  const verifyRow = await c.env.DB
    .prepare('SELECT code, expires_at FROM verification_codes WHERE email = ?')
    .bind(email)
    .first<{ code: string; expires_at: string }>()

  if (!verifyRow || verifyRow.code !== code) return badRequest('Invalid verification code')
  if (new Date(verifyRow.expires_at).getTime() < Date.now()) return badRequest('Verification code expired')

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) return json({ detail: 'Email already exists' }, 409)

  const userId = randomId('u_')
  const systemId = generateSystemId()
  const passwordHash = await hashPassword(password)

  await c.env.DB
    .prepare('INSERT INTO users (id, system_id, email, password_hash) VALUES (?, ?, ?, ?)')
    .bind(userId, systemId, email, passwordHash)
    .run()

  await c.env.DB.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email).run()

  const token = await createToken(c.env.TOKEN_SECRET, userId)
  return json({ access_token: token, system_id: systemId })
})

app.post('/api/auth/login', async (c) => {
  const body = await c.req
    .json<{ email?: string; password?: string }>()
    .catch(() => ({}) as { email?: string; password?: string })
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')

  const user = await c.env.DB
    .prepare('SELECT id, system_id, email, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>()

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return unauthorized('Invalid credentials')
  }

  const token = await createToken(c.env.TOKEN_SECRET, user.id)
  return json({ access_token: token, system_id: user.system_id })
})

app.get('/api/questionnaire', async (c) => {
  const auth = await getAuthedUser(c)
  if (auth instanceof Response) return auth

  const row = await c.env.DB
    .prepare(
      'SELECT user_id, profile, objective_answers, personality_traits, preferences, tags, opt_in_weekly FROM questionnaires WHERE user_id = ?',
    )
    .bind(auth.id)
    .first<QuestionnaireRow>()

  if (!row) {
    return json({
      profile: {},
      objective_answers: {},
      personality_traits: {},
      preferences: {},
      tags: [],
      opt_in_weekly: false,
    })
  }

  return json({
    profile: toJsonObject(row.profile),
    objective_answers: toJsonObject(row.objective_answers),
    personality_traits: toJsonObject(row.personality_traits),
    preferences: toJsonObject(row.preferences),
    tags: toJsonArray(row.tags),
    opt_in_weekly: Boolean(row.opt_in_weekly),
  })
})

app.put('/api/questionnaire', async (c) => {
  const auth = await getAuthedUser(c)
  if (auth instanceof Response) return auth

  const body = await c.req
    .json<{
      profile?: Record<string, unknown>
      objective_answers?: Record<string, unknown>
      personality_traits?: Record<string, unknown>
      preferences?: Record<string, unknown>
      tags?: string[]
      opt_in_weekly?: boolean
    }>()
    .catch(
      () =>
        ({}) as {
          profile?: Record<string, unknown>
          objective_answers?: Record<string, unknown>
          personality_traits?: Record<string, unknown>
          preferences?: Record<string, unknown>
          tags?: string[]
          opt_in_weekly?: boolean
        },
    )

  const profile = body.profile ?? {}
  const objective = body.objective_answers ?? {}
  const traits = body.personality_traits ?? {}
  const preferences = body.preferences ?? {}
  const tags = Array.isArray(body.tags) ? body.tags.filter((x) => typeof x === 'string') : []
  const optInWeekly = Boolean(body.opt_in_weekly)

  await c.env.DB.prepare(
    `INSERT INTO questionnaires (user_id, profile, objective_answers, personality_traits, preferences, tags, opt_in_weekly, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       profile=excluded.profile,
       objective_answers=excluded.objective_answers,
       personality_traits=excluded.personality_traits,
       preferences=excluded.preferences,
       tags=excluded.tags,
       opt_in_weekly=excluded.opt_in_weekly,
       updated_at=CURRENT_TIMESTAMP`,
  )
    .bind(
      auth.id,
      JSON.stringify(profile),
      JSON.stringify(objective),
      JSON.stringify(traits),
      JSON.stringify(preferences),
      JSON.stringify(tags),
      optInWeekly ? 1 : 0,
    )
    .run()

  return json({
    profile,
    objective_answers: objective,
    personality_traits: traits,
    preferences,
    tags,
    opt_in_weekly: optInWeekly,
  })
})

app.get('/api/matches/current', async (c) => {
  const auth = await getAuthedUser(c)
  if (auth instanceof Response) return auth

  const weekStart = thisWeekMonday()
  const row = await c.env.DB.prepare(
    `SELECT id, week_start, user_a_id, user_b_id, score, reason_text, status
     FROM match_results
     WHERE week_start = ? AND status = 'visible' AND (user_a_id = ? OR user_b_id = ?)
     LIMIT 1`,
  )
    .bind(weekStart, auth.id, auth.id)
    .first<MatchRow>()

  if (!row) return json({ detail: 'No visible match yet' }, 404)

  const partnerId = row.user_a_id === auth.id ? row.user_b_id : row.user_a_id
  const partner = await c.env.DB.prepare('SELECT system_id FROM users WHERE id = ?')
    .bind(partnerId)
    .first<{ system_id: string }>()

  if (!partner) return json({ detail: 'Partner not found' }, 404)

  return json({
    partner_system_id: partner.system_id,
    score: row.score,
    reason_text: row.reason_text,
    week_start: row.week_start,
  })
})

app.post('/api/contact/message', async (c) => {
  const auth = await getAuthedUser(c)
  if (auth instanceof Response) return auth

  const body = await c.req
    .json<{ message?: string }>()
    .catch(() => ({}) as { message?: string })
  const message = String(body.message ?? '').trim()
  if (!message) return badRequest('Message is required')

  const weekStart = thisWeekMonday()
  const row = await c.env.DB.prepare(
    `SELECT id, week_start, user_a_id, user_b_id, status FROM match_results
     WHERE week_start = ? AND status = 'visible' AND (user_a_id = ? OR user_b_id = ?)
     LIMIT 1`,
  )
    .bind(weekStart, auth.id, auth.id)
    .first<{ user_a_id: string; user_b_id: string }>()

  if (!row) return badRequest('You do not have an active visible match this week')

  const partnerId = row.user_a_id === auth.id ? row.user_b_id : row.user_a_id

  await c.env.DB.prepare(
    'INSERT INTO contact_messages (id, week_start, from_user_id, to_user_id, message) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(randomId('cm_'), weekStart, auth.id, partnerId, message)
    .run()

  const partner = await c.env.DB.prepare('SELECT email, system_id FROM users WHERE id = ?')
    .bind(partnerId)
    .first<{ email: string; system_id: string }>()

  const settings = await getSettingsMap(c.env.DB)
  if (partner?.email) {
    await dispatchEmail(c.env.DB, settings, {
      toEmail: partner.email,
      subject: '你的信封已送达：新留言',
      body: `${auth.systemId} 给你留言：\n\n${message}`,
      meta: JSON.stringify({ from_system_id: auth.systemId, to_system_id: partner.system_id }),
    })
  }

  return json({ message: 'Message sent' })
})

app.get('/api/public/stats', async (c) => {
  const usersCount = await c.env.DB.prepare('SELECT COUNT(1) AS total FROM users').first<{ total: number }>()
  const questionnairesCount = await c.env.DB.prepare('SELECT COUNT(1) AS total FROM questionnaires').first<{ total: number }>()
  const matchCount = await c.env.DB
    .prepare("SELECT COUNT(1) AS total FROM match_results WHERE status='visible'")
    .first<{ total: number }>()

  const users = usersCount?.total ?? 0
  const questionnaires = questionnairesCount?.total ?? 0
  const completionRate = users > 0 ? Number(((questionnaires / users) * 100).toFixed(1)) : 0

  return json({
    verified_users: users,
    questionnaire_completion_rate: completionRate,
    successful_moments: matchCount?.total ?? 0,
  })
})

app.get('/api/admin/overview', async (c) => {
  const err = await requireAdmin(c)
  if (err) return err

  const settings = await getSettingsMap(c.env.DB)
  const counts = await c.env.DB.prepare(
    `SELECT
      (SELECT COUNT(1) FROM users) AS users,
      (SELECT COUNT(1) FROM questionnaires) AS questionnaires,
      (SELECT COUNT(1) FROM match_results) AS matches,
      (SELECT COUNT(1) FROM email_outbox) AS outbox`,
  ).first<{ users: number; questionnaires: number; matches: number; outbox: number }>()
  const runs = await c.env.DB
    .prepare('SELECT * FROM matching_runs ORDER BY started_at DESC LIMIT 20')
    .all<Record<string, unknown>>()
  return json({ settings, counts: counts ?? {}, runs: runs.results ?? [] })
})

app.get('/api/admin/settings', async (c) => {
  const err = await requireAdmin(c)
  if (err) return err
  return json(await getSettingsMap(c.env.DB))
})

app.put('/api/admin/settings', async (c) => {
  const err = await requireAdmin(c)
  if (err) return err
  const body = await c.req
    .json<Record<string, unknown>>()
    .catch(() => ({} as Record<string, unknown>))

  const allowKeys = Object.keys(DEFAULT_SETTINGS)
  for (const key of allowKeys) {
    if (key in body) {
      await setSetting(c.env.DB, key, String(body[key] ?? ''))
    }
  }
  return json({ message: 'Settings updated', settings: await getSettingsMap(c.env.DB) })
})

app.post('/api/admin/run-matching', async (c) => {
  const err = await requireAdmin(c)
  if (err) return err
  const result = await executeMatchingRun(c.env.DB, 'manual')
  return json({ message: 'Matching completed', ...result })
})

app.get('/api/admin/runs', async (c) => {
  const err = await requireAdmin(c)
  if (err) return err
  const rows = await c.env.DB
    .prepare('SELECT * FROM matching_runs ORDER BY started_at DESC LIMIT 200')
    .all<Record<string, unknown>>()
  return json({ runs: rows.results ?? [] })
})

app.get('/api/admin/outbox', async (c) => {
  const err = await requireAdmin(c)
  if (err) return err
  const rows = await c.env.DB
    .prepare('SELECT * FROM email_outbox ORDER BY created_at DESC LIMIT 200')
    .all<Record<string, unknown>>()
  return json({ outbox: rows.results ?? [] })
})

app.post('/api/admin/send-test-email', async (c) => {
  const err = await requireAdmin(c)
  if (err) return err
  const body = await c.req
    .json<{ to_email?: string }>()
    .catch(() => ({}) as { to_email?: string })
  const toEmail = String(body.to_email ?? '').trim().toLowerCase()
  if (!toEmail.includes('@')) return badRequest('to_email is required')
  const settings = await getSettingsMap(c.env.DB)
  const result = await dispatchEmail(c.env.DB, settings, {
    toEmail,
    subject: 'BIT Date 测试邮件',
    body: '这是后台控制页面发送的一封测试邮件。',
  })
  if (!result.ok) {
    return json({ detail: result.message }, 503)
  }
  return json({ message: result.message })
})

app.post('/api/admin/run-weekly-match', async (c) => {
  const secret = c.req.header('x-cron-secret')
  if (!secret || secret !== c.env.CRON_SECRET) return unauthorized('Invalid cron secret')
  const result = await executeMatchingRun(c.env.DB, 'manual')
  return json({ message: 'ok', ...result })
})

app.all('*', async (c) => c.env.ASSETS.fetch(new Request(c.req.raw)))

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    const db = env.DB
    const settings = await getSettingsMap(db)
    if (!shouldRunNow(settings)) return
    ctx.waitUntil(executeMatchingRun(db, 'cron'))
  },
}
