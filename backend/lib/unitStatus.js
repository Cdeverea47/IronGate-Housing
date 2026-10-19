const db = require('../db');

// A unit is "occupied" exactly when it has an active lease, otherwise "vacant"
// (units in maintenance are left alone).
function syncUnitStatus(unitId) {
  const unit = db.prepare('SELECT status FROM units WHERE id = ?').get(unitId);
  if (!unit) return;
  const active = db.prepare("SELECT 1 FROM leases WHERE unit_id = ? AND status = 'active'").get(unitId);
  const next = active ? 'occupied' : unit.status === 'maintenance' ? 'maintenance' : 'vacant';
  if (next !== unit.status) db.prepare('UPDATE units SET status = ? WHERE id = ?').run(next, unitId);
}

function syncAllUnitStatuses() {
  for (const { id } of db.prepare('SELECT id FROM units').all()) syncUnitStatus(id);
}

module.exports = { syncUnitStatus, syncAllUnitStatuses };
