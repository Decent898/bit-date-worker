import type { JsonObject } from './types'

const encoder = new TextEncoder()

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

export function badRequest(message: string): Response {
  return json({ detail: message }, 400)
}

export function unauthorized(message = 'Unauthorized'): Response {
  return json({ detail: message }, 401)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function toJsonObject(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null ? (parsed as JsonObject) : {}
  } catch {
    return {}
  }
}

export function toJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function randomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function randomId(prefix = ''): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const base = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}${base}`
}

export function generateSystemId(): string {
  return `SLOW-${randomId('').slice(0, 8).toUpperCase()}`
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return base64UrlEncode(new Uint8Array(signature))
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return base64UrlEncode(new Uint8Array(digest))
}

export function isEduEmail(email: string): boolean {
  const lower = email.trim().toLowerCase()
  return /.+@.+\.edu\.cn$/.test(lower)
}

export function thisWeekMonday(reference = new Date()): string {
  const date = new Date(reference)
  const weekday = date.getUTCDay()
  const offset = (weekday + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  date.setUTCHours(0, 0, 0, 0)
  return date.toISOString().slice(0, 10)
}
