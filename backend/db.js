const { DatabaseSync } = require('node:sqlite');
const { getDbPath } = require('./lib/paths');

const db = new DatabaseSync(getDbPath());
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
-- email is NOT globally unique: the same person can hold a landlord account
-- and a tenant account with the same address. Uniqueness is enforced per
-- (email, role) below via a composite index instead.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'landlord',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  bedrooms REAL,
  bathrooms REAL,
  rent_amount REAL,
  status TEXT NOT NULL DEFAULT 'vacant',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT,
  rent_amount REAL NOT NULL,
  deposit_amount REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lease_id INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  paid_date TEXT,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  lease_id INTEGER REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  uploaded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL DEFAULT 'rental',
  provider TEXT NOT NULL,
  policy_number TEXT,
  premium_amount REAL,
  premium_frequency TEXT NOT NULL DEFAULT 'annual',
  coverage_start TEXT,
  coverage_end TEXT,
  notes TEXT,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  rent_amount REAL,
  available_date TEXT,
  pet_policy TEXT,
  amenities TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  photo_document_ids TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notifications are computed live from other tables (not stored rows), so
-- "acknowledging" one just records its id here to exclude it from future
-- results for that user — until the underlying data changes and produces a
-- new notification id (e.g. a new overdue payment), which will show fresh.
CREATE TABLE IF NOT EXISTS notification_acks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  acknowledged_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, notification_id)
);

-- A landlord can send a potential tenant a link to run their own credit /
-- background check (via a third-party screening service), then record the
-- result here once the applicant reports back, so it's visible on the
-- landlord's side.
CREATE TABLE IF NOT EXISTS screening_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  result_summary TEXT,
  result_link TEXT,
  token TEXT UNIQUE,
  applicant_reported_at TEXT,
  sent_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

-- A tenant can request a different way of paying rent (split into
-- installments, temporarily or permanently) — the landlord reviews and
-- approves/denies it. Scoped to a specific tenant record (not the login
-- account) since that's what ties it to a landlord/property.
CREATE TABLE IF NOT EXISTS payment_plan_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installment_plan TEXT NOT NULL,
  duration TEXT NOT NULL DEFAULT 'temporary',
  temporary_end_date TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  decided_at TEXT
);

-- The "My tasks" box on the dashboard also shows auto-generated items (rent
-- overdue, high-priority maintenance, insurance renewals, draft listings)
-- alongside manually-created tasks. Those auto items are computed live, not
-- stored rows, so "lining one out" just records its id here — same pattern
-- as notification_acks, kept separate so dismissing one doesn't affect the
-- notification bell.
CREATE TABLE IF NOT EXISTS dashboard_item_acks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  acknowledged_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, item_id)
);
`);

// Lightweight migrations for columns added after initial release.
// SQLite has no "ADD COLUMN IF NOT EXISTS", so we check pragma table_info first.
function ensureColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = existing.some((col) => col.name === column);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('payments', 'stripe_session_id', 'TEXT');
ensureColumn('payments', 'stripe_payment_intent_id', 'TEXT');
ensureColumn('users', 'zelle_contact', 'TEXT');
ensureColumn('tenants', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
ensureColumn('users', 'reset_token_hash', 'TEXT');
ensureColumn('users', 'reset_token_expires', 'TEXT');
ensureColumn('leases', 'renewal_reminder_sent_at', 'TEXT');
ensureColumn('documents', 'uploaded_by_role', "TEXT NOT NULL DEFAULT 'landlord'");
ensureColumn('properties', 'property_type', 'TEXT');
ensureColumn('tasks', 'property_id', 'INTEGER REFERENCES properties(id) ON DELETE SET NULL');
ensureColumn('tenants', 'active_installment_plan', 'TEXT');
ensureColumn('tenants', 'active_installment_plan_until', 'TEXT');
ensureColumn('tasks', 'audience', "TEXT NOT NULL DEFAULT 'landlord'");
ensureColumn('screening_requests', 'token', 'TEXT');
ensureColumn('screening_requests', 'applicant_reported_at', 'TEXT');
ensureColumn('users', 'avatar_data_url', 'TEXT');
ensureColumn('users', 'terms_accepted_at', 'TEXT');
ensureColumn('users', 'payment_method', 'TEXT');
ensureColumn('users', 'installment_plan', 'TEXT');
// Login & Security
ensureColumn('users', 'two_factor_enabled', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'two_factor_pending_code_hash', 'TEXT');
ensureColumn('users', 'two_factor_pending_expires', 'TEXT');
ensureColumn('users', 'two_factor_login_code_hash', 'TEXT');
ensureColumn('users', 'two_factor_login_expires', 'TEXT');
ensureColumn('users', 'email_notifications_enabled', 'INTEGER NOT NULL DEFAULT 1');
// Secure bank info — only ever the last 4 digits of the account number are
// stored; the full number is never persisted (see routes/auth.js).
ensureColumn('users', 'bank_name', 'TEXT');
ensureColumn('users', 'bank_account_name', 'TEXT');
ensureColumn('users', 'bank_account_last4', 'TEXT');
// Stripe Connect: a landlord's connected account (where rent is paid out to
// their own bank). Bank details are collected by Stripe's hosted onboarding
// and never touch this server.
// Rent setup: which day of the month rent is due, and whether the app should
// create each month's rent charge automatically (see lib/rentCharges.js).
// A single-family home has no separate units: it gets one default unit that
// represents the whole property (shown by the property name alone).
// What kind of problem a maintenance request is (plumbing, electrical, ...) — see lib/maintenanceCategories.js.
ensureColumn('maintenance_requests', 'category', 'TEXT');
ensureColumn('units', 'is_default', 'INTEGER NOT NULL DEFAULT 0');
// How much of a charge has actually been paid (supports partial payments).
ensureColumn('payments', 'amount_paid', 'REAL NOT NULL DEFAULT 0');
db.exec("UPDATE payments SET amount_paid = amount WHERE status = 'paid' AND amount_paid < amount");
ensureColumn('leases', 'rent_due_day', 'INTEGER');
ensureColumn('leases', 'rent_autogenerate', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('payments', 'auto_generated', 'INTEGER NOT NULL DEFAULT 0');
// Who started a payment plan: the tenant (a request) or the landlord (set directly).
ensureColumn('payment_plan_requests', 'initiated_by', "TEXT NOT NULL DEFAULT 'tenant'");
ensureColumn('users', 'stripe_account_id', 'TEXT');
ensureColumn('users', 'stripe_charges_enabled', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'stripe_payouts_enabled', 'INTEGER NOT NULL DEFAULT 0');
// Rent is charged directly on the landlord's connected account, so a tenant's
// Stripe Customer (and the payment methods saved on it) lives per landlord.
db.exec(`
CREATE TABLE IF NOT EXISTS stripe_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, stripe_account_id)
);
`);

// Databases created before tenant accounts existed have a single-column
// UNIQUE constraint on users.email, which blocks the same person from having
// both a landlord and a tenant account. SQLite can't drop a column
// constraint directly, so rebuild the table without it if it's still there.
function migrateUsersEmailUniqueness() {
  const indexes = db.prepare('PRAGMA index_list(users)').all();
  const hasEmailOnlyUniqueConstraint = indexes.some((idx) => {
    if (!idx.unique) return false;
    const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all();
    return cols.length === 1 && cols[0].name === 'email';
  });
  if (!hasEmailOnlyUniqueConstraint) return;

  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'landlord',
      zelle_contact TEXT,
      reset_token_hash TEXT,
      reset_token_expires TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO users_new (id, name, email, password_hash, role, zelle_contact, reset_token_hash, reset_token_expires, created_at)
      SELECT id, name, email, password_hash, role, zelle_contact, reset_token_hash, reset_token_expires, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
  `);
  db.exec('PRAGMA foreign_keys = ON;');
}

migrateUsersEmailUniqueness();

db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_role ON users(email, role);');

module.exports = db;
