CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  system_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questionnaires (
  user_id TEXT PRIMARY KEY,
  profile TEXT NOT NULL DEFAULT '{}',
  objective_answers TEXT NOT NULL DEFAULT '{}',
  personality_traits TEXT NOT NULL DEFAULT '{}',
  preferences TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  opt_in_weekly INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_results (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  user_a_id TEXT NOT NULL,
  user_b_id TEXT NOT NULL,
  score REAL NOT NULL,
  reason_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'hidden',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_a_week ON match_results(week_start, user_a_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_match_b_week ON match_results(week_start, user_b_id);
CREATE INDEX IF NOT EXISTS idx_match_week_status ON match_results(week_start, status);
CREATE INDEX IF NOT EXISTS idx_questionnaire_optin ON questionnaires(opt_in_weekly);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);
