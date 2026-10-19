// Common maintenance problem types for the request form dropdown (keep in sync
// with backend/lib/maintenanceCategories.js).
export const MAINTENANCE_CATEGORIES = [
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

export function categoryLabel(value) {
  return MAINTENANCE_CATEGORIES.find((c) => c.value === value)?.label || null;
}
