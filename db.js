const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const db = new Database(path.join(__dirname, 'loom.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  credits INTEGER DEFAULT 50,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  plan TEXT DEFAULT 'free',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  agent TEXT,
  credits_spent INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS factchecks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  claim TEXT,
  verdict TEXT,
  sources TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function getOrCreateUser(userId) {
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    const refCode = crypto.randomBytes(4).toString('hex');
    db.prepare('INSERT INTO users (id, referral_code) VALUES (?, ?)').run(userId, refCode);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }
  return user;
}

function spendCredits(userId, amount, agent) {
  const user = getOrCreateUser(userId);
  if (user.credits < amount) return false;
  db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO usage_log (user_id, agent, credits_spent) VALUES (?, ?, ?)').run(userId, agent, amount);
  return true;
}

function logFactcheck(userId, claim, verdict, sources) {
  db.prepare('INSERT INTO factchecks (user_id, claim, verdict, sources) VALUES (?, ?, ?, ?)')
    .run(userId, claim, verdict, JSON.stringify(sources));
}

function getAdminStats() {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalRequests = db.prepare('SELECT COUNT(*) as c FROM usage_log').get().c;
  const creditsSpent = db.prepare('SELECT SUM(credits_spent) as s FROM usage_log').get().s || 0;
  const totalFactchecks = db.prepare('SELECT COUNT(*) as c FROM factchecks').get().c;
  const byAgent = db.prepare('SELECT agent, COUNT(*) as count, SUM(credits_spent) as credits FROM usage_log GROUP BY agent').all();
  const recentFactchecks = db.prepare('SELECT claim, verdict, created_at FROM factchecks ORDER BY id DESC LIMIT 10').all();
  return { totalUsers, totalRequests, creditsSpent, totalFactchecks, byAgent, recentFactchecks };
}

module.exports = { db, getOrCreateUser, spendCredits, logFactcheck, getAdminStats };
