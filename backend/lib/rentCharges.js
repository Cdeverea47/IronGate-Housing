// Rent setup + automatic monthly rent charges.
//
// A landlord sets a lease's rent amount and due day, and can turn on
// auto-generation. Each month's charge is then created as a normal "pending"
// payment (so it shows up for the tenant, in Pay now, in overdue alerts, etc).
// If the tenant is on an active payment plan, the month is split into 2 or 4
// installments instead of one charge.
const db = require('../db');

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoDate(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function today() {
  return isoDate(new Date());
}

// Splits an amount into n parts in whole cents (remainder cents go to the first parts).
function splitAmount(amount, n) {
  const cents = Math.round(Number(amount) * 100);
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

function installmentsFor(plan, until, firstDue) {
  const active = plan && (!until || until >= firstDue);
  if (active && plan === 'split2') return { n: 2, gapDays: 14 };
  if (active && plan === 'split4') return { n: 4, gapDays: 7 };
  return { n: 1, gapDays: 0 };
}

// The charges (due date + amount) one month of rent should produce.
function chargesForMonth(lease, tenant, year, month) {
  const dueDay = Math.min(28, Math.max(1, Number(lease.rent_due_day) || 1));
  const firstDue = `${year}-${pad(month)}-${pad(dueDay)}`;
  const { n, gapDays } = installmentsFor(tenant.active_installment_plan, tenant.active_installment_plan_until, firstDue);
  const amounts = splitAmount(lease.rent_amount, n);
  return amounts.map((amount, i) => ({ due_date: addDays(firstDue, i * gapDays), amount }));
}

// Months (counting this one) from now through the month a lease ends — capped
// so a typo'd end date can't create hundreds of charges.
const MAX_MONTHS = 60;
function monthsThroughEnd(endDate) {
  if (!endDate) return 0;
  const now = new Date();
  const [y, m] = endDate.split('-').map(Number);
  const months = (y - now.getUTCFullYear()) * 12 + (m - (now.getUTCMonth() + 1)) + 1;
  return Math.min(MAX_MONTHS, Math.max(0, months));
}

// Creates any missing charges for the current month and the next
// (monthsAhead - 1) months. Never backfills past dates and never duplicates a
// date that already has a payment. Returns how many were created.
function ensureCharges(leaseId, monthsAhead) {
  const lease = db.prepare('SELECT * FROM leases WHERE id = ?').get(leaseId);
  if (!lease || lease.status !== 'active' || !lease.rent_amount) return 0;
  const tenant = db
    .prepare('SELECT active_installment_plan, active_installment_plan_until FROM tenants WHERE id = ?')
    .get(lease.tenant_id);

  const now = new Date();
  const todayStr = today();
  const exists = db.prepare('SELECT 1 FROM payments WHERE lease_id = ? AND due_date = ?');
  const insert = db.prepare(
    `INSERT INTO payments (lease_id, amount, due_date, status, notes, auto_generated)
     VALUES (?, ?, ?, 'pending', ?, 1)`
  );

  let created = 0;
  for (let m = 0; m < monthsAhead; m += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + m, 1));
    const charges = chargesForMonth(lease, tenant || {}, d.getUTCFullYear(), d.getUTCMonth() + 1);
    charges.forEach((c, i) => {
      if (c.due_date < todayStr) return;
      if (c.due_date < lease.start_date) return;
      if (lease.end_date && c.due_date > lease.end_date) return;
      if (exists.get(lease.id, c.due_date)) return;
      insert.run(lease.id, c.amount, c.due_date, charges.length > 1 ? `Installment ${i + 1} of ${charges.length}` : null);
      created += 1;
    });
  }
  return created;
}

// Drops upcoming auto-created charges that haven't been paid, then rebuilds
// them — used after the rent amount, due day, or the tenant's plan changes.
function regenerateForLease(leaseId, monthsAhead) {
  db.prepare(
    "DELETE FROM payments WHERE lease_id = ? AND auto_generated = 1 AND status = 'pending' AND paid_date IS NULL AND due_date >= ?"
  ).run(leaseId, today());
  return ensureCharges(leaseId, monthsAhead);
}

// How many months (counting this one) the lease's upcoming unpaid auto-charges
// already reach — so a rebuild keeps the same horizon (minimum this + next month).
function horizonFor(leaseId) {
  const row = db
    .prepare(
      "SELECT MAX(due_date) AS last FROM payments WHERE lease_id = ? AND auto_generated = 1 AND status = 'pending' AND due_date >= ?"
    )
    .get(leaseId, today());
  const lease = db.prepare('SELECT end_date FROM leases WHERE id = ?').get(leaseId);
  const toEnd = lease ? monthsThroughEnd(lease.end_date) : 0;
  if (!row || !row.last) return Math.max(2, toEnd);
  const now = new Date();
  const [y, m] = row.last.split('-').map(Number);
  const months = (y - now.getUTCFullYear()) * 12 + (m - (now.getUTCMonth() + 1)) + 1;
  return Math.max(2, months, toEnd);
}

// Setting a lease end date schedules the whole term: every month's rent from
// now through the end date is created as an upcoming payment the tenant can
// pay any time. A lease that was never set up for rent gets sensible defaults
// (due on the day it started, auto-creation on); one the landlord set up
// themselves keeps their settings.
function scheduleLeaseTerm(leaseId) {
  const lease = db.prepare('SELECT * FROM leases WHERE id = ?').get(leaseId);
  if (!lease || lease.status !== 'active' || !lease.end_date || !(Number(lease.rent_amount) > 0)) return 0;

  if (!lease.rent_due_day) {
    const startDay = Number((lease.start_date || '').split('-')[2]) || 1;
    db.prepare('UPDATE leases SET rent_due_day = ?, rent_autogenerate = 1 WHERE id = ?').run(
      Math.min(28, Math.max(1, startDay)),
      lease.id
    );
  } else if (!lease.rent_autogenerate) {
    return 0;
  }
  return regenerateForLease(lease.id, Math.max(2, monthsThroughEnd(lease.end_date)));
}

// Lease ended/terminated: drop the upcoming unpaid auto-created charges and stop generating.
function cancelUpcomingCharges(leaseId) {
  db.prepare("UPDATE leases SET rent_autogenerate = 0 WHERE id = ?").run(leaseId);
  db.prepare(
    "DELETE FROM payments WHERE lease_id = ? AND auto_generated = 1 AND status = 'pending' AND paid_date IS NULL AND due_date >= ?"
  ).run(leaseId, today());
}

function regenerateForTenant(tenantId) {
  const leases = db
    .prepare("SELECT id FROM leases WHERE tenant_id = ? AND status = 'active' AND rent_autogenerate = 1")
    .all(tenantId);
  for (const l of leases) regenerateForLease(l.id, horizonFor(l.id));
}

// Daily job: keep the next couple of months of charges created.
function runAutoGeneration() {
  const leases = db.prepare("SELECT id, end_date FROM leases WHERE status = 'active' AND rent_autogenerate = 1").all();
  let created = 0;
  for (const l of leases) created += ensureCharges(l.id, Math.max(2, monthsThroughEnd(l.end_date)));
  return created;
}

module.exports = {
  ensureCharges,
  regenerateForLease,
  regenerateForTenant,
  scheduleLeaseTerm,
  cancelUpcomingCharges,
  monthsThroughEnd,
  runAutoGeneration,
  chargesForMonth,
  splitAmount,
};
