export type JsonObject = Record<string, unknown>

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  TOKEN_SECRET: string
  CRON_SECRET: string
  ADMIN_SECRET: string
}

export interface UserRow {
  id: string
  system_id: string
  email: string
  password_hash: string
}

export interface QuestionnaireRow {
  user_id: string
  profile: string
  objective_answers: string
  personality_traits: string
  preferences: string
  tags: string
  opt_in_weekly: number
}

export interface MatchRow {
  id: string
  week_start: string
  user_a_id: string
  user_b_id: string
  score: number
  reason_text: string
  status: string
}
