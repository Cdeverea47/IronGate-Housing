// Common maintenance problem types, offered as a dropdown alongside the free-text title.
const CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'Heating / cooling (HVAC)' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'water_heater', label: 'Water heater' },
  { value: 'pest', label: 'Pest control' },
  { value: 'roof_structure', label: 'Roof / structural' },
  { value: 'doors_windows', label: 'Doors / windows' },
  { value: 'locks_security', label: 'Locks / security' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'walls_paint', label: 'Walls / paint' },
  { value: 'mold_moisture', label: 'Mold / moisture' },
  { value: 'exterior_landscaping', label: 'Exterior / landscaping' },
  { value: 'smoke_co_detector', label: 'Smoke / CO detector' },
  { value: 'other', label: 'Other' },
];

const VALUES = CATEGORIES.map((c) => c.value);

function categoryLabel(value) {
  const found = CATEGORIES.find((c) => c.value === value);
  return found ? found.label : null;
}

// Returns { ok, value } — empty means "not specified"; anything else must be a known category.
function normalizeCategory(raw) {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  return VALUES.includes(raw) ? { ok: true, value: raw } : { ok: false, value: null };
}

module.exports = { CATEGORIES, categoryLabel, normalizeCategory };
