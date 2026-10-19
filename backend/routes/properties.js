const express = require('express');
const db = require('../db');
const { unitLabel, roomName } = require('../lib/labels');
const { requireAuth, requireRole } = require('../middleware/auth');

const SINGLE_TYPES = ['single_family', 'townhouse', 'condo', 'mobile_home'];

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) AS unit_count
       FROM properties p WHERE p.owner_id = ? ORDER BY p.created_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const property = db
    .prepare('SELECT * FROM properties WHERE id = ? AND owner_id = ?')
    .get(req.params.id, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  // A single-family style property is one rentable home: make sure its one
  // default unit exists so a tenant can be added straight away.
  if (SINGLE_TYPES.includes(property.property_type)) {
    const any = db.prepare('SELECT 1 FROM units WHERE property_id = ?').get(property.id);
    if (!any) {
      db.prepare("INSERT INTO units (property_id, unit_number, status, is_default) VALUES (?, '1', 'vacant', 1)").run(property.id);
    }
  }
  const units = db.prepare('SELECT * FROM units WHERE property_id = ? ORDER BY unit_number').all(property.id);
  // Attach whoever currently holds an active lease on each unit so the page
  // can show the tenant (or offer "Add tenant" when it's empty).
  const activeLease = db.prepare(
    `SELECT l.id AS lease_id, l.start_date, l.end_date, l.rent_amount, l.deposit_amount, l.rent_due_day, l.rent_autogenerate, t.id AS tenant_id, t.first_name, t.last_name, t.email
     FROM leases l JOIN tenants t ON t.id = l.tenant_id
     WHERE l.unit_id = ? AND l.status = 'active'
     ORDER BY l.created_at DESC LIMIT 1`
  );
  res.json({ ...property, units: units.map((u) => ({
      ...u,
      unit_label: unitLabel(u.unit_number, property.name, u.is_default),
      current_lease: activeLease.get(u.id) || null,
    })) });
});

router.post('/', (req, res) => {
  const { name, address_line1, address_line2, city, state, zip, notes, property_type, units } = req.body;
  if (!name || !address_line1) return res.status(400).json({ error: 'name and address_line1 are required' });

  // Optional units, created together with the property: { count, bedrooms,
  // bathrooms, rent_amount }. A single-family home is just count = 1; a
  // multifamily building passes however many units it has. Omit to add units later.
  let unitCount = 0;
  if (units && units.count !== undefined && units.count !== null && units.count !== '') {
    unitCount = Number(units.count);
    if (!Number.isInteger(unitCount) || unitCount < 0 || unitCount > 100) {
      return res.status(400).json({ error: 'units.count must be a whole number from 0 to 100' });
    }
  }

  db.exec('BEGIN');
  let info;
  try {
    info = db
    .prepare(
      `INSERT INTO properties (owner_id, name, address_line1, address_line2, city, state, zip, notes, property_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      name,
      address_line1,
      address_line2 || null,
      city || null,
      state || null,
      zip || null,
      notes || null,
      property_type || null
    );

    if (unitCount > 0) {
      const insertUnit = db.prepare(
        `INSERT INTO units (property_id, unit_number, bedrooms, bathrooms, rent_amount, status, is_default)
         VALUES (?, ?, ?, ?, ?, 'vacant', ?)`
      );
      const isDefault = units.single === true && unitCount === 1 ? 1 : 0;
      const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
      for (let i = 1; i <= unitCount; i += 1) {
        const label = units.rooms === true ? `Room ${i}` : String(i);
        insertUnit.run(info.lastInsertRowid, label, units.rooms === true ? null : num(units.bedrooms), units.rooms === true ? null : num(units.bathrooms), num(units.rent_amount), isDefault);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(property);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM properties WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });
  const { name, address_line1, address_line2, city, state, zip, notes, property_type, units } = req.body;

  // Optional unit setup change: none | single (one default unit) | multi (N units).
  // Never removes a unit that has had a lease; extra units are only ever added.
  let unitPlan = null;
  if (units && ['none', 'single', 'multi', 'rooms'].includes(units.mode)) {
    const existingUnits = db.prepare('SELECT * FROM units WHERE property_id = ? ORDER BY id').all(existing.id);
    const hasLeases = (u) => !!db.prepare('SELECT 1 FROM leases WHERE unit_id = ?').get(u.id);
    if (units.mode === 'none') {
      if (existingUnits.some(hasLeases)) {
        return res.status(409).json({ error: 'Some units have tenants or lease history, so units can\'t be removed. End and delete those leases first.' });
      }
      unitPlan = { mode: 'none', existingUnits };
    } else if (units.mode === 'single') {
      if (existingUnits.length > 1) {
        return res.status(409).json({ error: 'This property has multiple units. Delete the extras first to make it a single-family home with no units.' });
      }
      unitPlan = { mode: 'single', existingUnits };
    } else {
      const count = Number(units.count);
      if (!Number.isInteger(count) || count < 1 || count > 100) {
        return res.status(400).json({ error: 'units.count must be a whole number from 1 to 100' });
      }
      unitPlan = { mode: units.mode, count, existingUnits };
    }
  }

  if (unitPlan) {
    const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
    const insertUnit = db.prepare(
      `INSERT INTO units (property_id, unit_number, bedrooms, bathrooms, rent_amount, status, is_default)
       VALUES (?, ?, ?, ?, ?, 'vacant', ?)`
    );
    if (unitPlan.mode === 'none') {
      for (const u of unitPlan.existingUnits) db.prepare('DELETE FROM units WHERE id = ?').run(u.id);
    } else if (unitPlan.mode === 'single') {
      if (unitPlan.existingUnits.length === 1) {
        const cur = unitPlan.existingUnits[0];
        const has = (v) => v !== undefined && v !== null && v !== '';
        db.prepare('UPDATE units SET is_default = 1, bedrooms = ?, bathrooms = ?, rent_amount = ? WHERE id = ?').run(
          has(units.bedrooms) ? num(units.bedrooms) : units.bedrooms === '' ? null : cur.bedrooms,
          has(units.bathrooms) ? num(units.bathrooms) : units.bathrooms === '' ? null : cur.bathrooms,
          has(units.rent_amount) ? num(units.rent_amount) : units.rent_amount === '' ? null : cur.rent_amount,
          cur.id
        );
      } else {
        insertUnit.run(existing.id, '1', num(units.bedrooms), num(units.bathrooms), num(units.rent_amount), 1);
      }
    } else if (unitPlan.mode === 'rooms') {
      // Rent by the room: every unit becomes a "Room N"; extra rooms are added.
      db.prepare('UPDATE units SET is_default = 0 WHERE property_id = ?').run(existing.id);
      const taken = new Set();
      for (const u of unitPlan.existingUnits) {
        const nm = roomName(u.unit_number);
        taken.add(nm);
        if (nm !== u.unit_number) db.prepare('UPDATE units SET unit_number = ?, bedrooms = NULL, bathrooms = NULL WHERE id = ?').run(nm, u.id);
      }
      let n = 1;
      for (let i = unitPlan.existingUnits.length; i < unitPlan.count; i += 1) {
        while (taken.has(`Room ${n}`)) n += 1;
        taken.add(`Room ${n}`);
        insertUnit.run(existing.id, `Room ${n}`, null, null, num(units.rent_amount), 0);
      }
    } else {
      db.prepare('UPDATE units SET is_default = 0 WHERE property_id = ?').run(existing.id);
      const have = unitPlan.existingUnits.length;
      const taken = new Set(unitPlan.existingUnits.map((u) => String(u.unit_number)));
      let n = 1;
      for (let i = have; i < unitPlan.count; i += 1) {
        while (taken.has(String(n))) n += 1;
        taken.add(String(n));
        insertUnit.run(existing.id, String(n), num(units.bedrooms), num(units.bathrooms), num(units.rent_amount), 0);
      }
    }
  }

  db.prepare(
    `UPDATE properties SET name = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, zip = ?, notes = ?,
     property_type = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    address_line1 ?? existing.address_line1,
    address_line2 ?? existing.address_line2,
    city ?? existing.city,
    state ?? existing.state,
    zip ?? existing.zip,
    notes ?? existing.notes,
    property_type ?? existing.property_type,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM properties WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });
  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
