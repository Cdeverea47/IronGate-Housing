// One-off helper: creates a demo landlord + property + unit + tenant + lease
// + a couple of payments, plus a tenant login account already linked to that
// lease — so you can log into the tenant portal immediately and see real
// data instead of the empty "no lease on file" state. Safe to run more than
// once; it skips anything that already exists.
//
// Usage (from backend/):
//   npm run seed:demo-tenant
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { linkRecordsToUser } = require('../lib/tenantLink');

const LANDLORD_EMAIL = 'demo-landlord@example.com';
const TENANT_EMAIL = 'demo-tenant@example.com';
const DEMO_PASSWORD = 'demo1234';

const fmt = (d) => d.toISOString().slice(0, 10);

function upsertUser(name, email, role) {
  let user = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email, role);
  if (!user) {
    const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, email, hash, role);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    console.log(`Created ${role} account: ${email}`);
  } else {
    console.log(`${role} account already exists: ${email}`);
  }
  return user;
}

const landlord = upsertUser('Demo Landlord', LANDLORD_EMAIL, 'landlord');

let property = db.prepare('SELECT * FROM properties WHERE owner_id = ? AND name = ?').get(landlord.id, 'Maple Street Apartments');
if (!property) {
  const info = db
    .prepare('INSERT INTO properties (owner_id, name, address_line1, city, state, zip) VALUES (?, ?, ?, ?, ?, ?)')
    .run(landlord.id, 'Maple Street Apartments', '123 Maple St', 'Springfield', 'IL', '62704');
  property = db.prepare('SELECT * FROM properties WHERE id = ?').get(info.lastInsertRowid);
  console.log('Created demo property: Maple Street Apartments');
}

let unit = db.prepare('SELECT * FROM units WHERE property_id = ? AND unit_number = ?').get(property.id, '2A');
if (!unit) {
  const info = db
    .prepare('INSERT INTO units (property_id, unit_number, bedrooms, bathrooms, rent_amount, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(property.id, '2A', 2, 1, 1500, 'occupied');
  unit = db.prepare('SELECT * FROM units WHERE id = ?').get(info.lastInsertRowid);
  console.log('Created demo unit: 2A');
}

let tenantRecord = db.prepare('SELECT * FROM tenants WHERE owner_id = ? AND email = ?').get(landlord.id, TENANT_EMAIL);
if (!tenantRecord) {
  const info = db
    .prepare('INSERT INTO tenants (owner_id, first_name, last_name, email, phone) VALUES (?, ?, ?, ?, ?)')
    .run(landlord.id, 'Demo', 'Tenant', TENANT_EMAIL, '555-0100');
  tenantRecord = db.prepare('SELECT * FROM tenants WHERE id = ?').get(info.lastInsertRowid);
  console.log('Created demo tenant record: Demo Tenant');
}

let lease = db.prepare('SELECT * FROM leases WHERE unit_id = ? AND tenant_id = ?').get(unit.id, tenantRecord.id);
if (!lease) {
  const today = new Date();
  const start = new Date(today);
  start.setMonth(start.getMonth() - 2);
  const end = new Date(today);
  end.setDate(end.getDate() + 20); // within 30 days, so the renewal reminder shows up too

  const info = db
    .prepare(
      `INSERT INTO leases (unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    )
    .run(unit.id, tenantRecord.id, fmt(start), fmt(end), 1500, 1500);
  lease = db.prepare('SELECT * FROM leases WHERE id = ?').get(info.lastInsertRowid);
  console.log('Created demo lease (ends in 20 days, so you can see the renewal reminder too)');
}

const existingPayments = db.prepare('SELECT COUNT(*) c FROM payments WHERE lease_id = ?').get(lease.id).c;
if (existingPayments === 0) {
  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const dueSoon = new Date(today);
  dueSoon.setDate(dueSoon.getDate() + 5);

  db.prepare(
    `INSERT INTO payments (lease_id, amount, due_date, paid_date, method, status) VALUES (?, ?, ?, ?, ?, 'paid')`
  ).run(lease.id, 1500, fmt(lastMonth), fmt(lastMonth), 'bank_transfer');
  db.prepare(`INSERT INTO payments (lease_id, amount, due_date, status) VALUES (?, ?, ?, 'pending')`).run(
    lease.id,
    1500,
    fmt(dueSoon)
  );
  console.log('Created demo payments: one paid last month, one due soon');
}

const tenantUser = upsertUser('Demo Tenant', TENANT_EMAIL, 'tenant');
linkRecordsToUser(tenantUser.id, TENANT_EMAIL);

console.log('\nDone. Log into the tenant portal with:');
console.log(`  Email:    ${TENANT_EMAIL}`);
console.log(`  Password: ${DEMO_PASSWORD}`);
console.log('  (pick "Tenant" on the sign-in toggle)');
console.log('\nTo see the same lease from the landlord side:');
console.log(`  Email:    ${LANDLORD_EMAIL}`);
console.log(`  Password: ${DEMO_PASSWORD}`);
console.log('  (pick "Landlord" on the sign-in toggle)');
