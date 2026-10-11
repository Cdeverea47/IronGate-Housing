export const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single family' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'triplex', label: 'Triplex' },
  { value: 'fourplex', label: 'Fourplex' },
  { value: 'condo', label: 'Condo' },
  { value: 'apartment', label: 'Apartment / multi-family' },
  { value: 'mobile_home', label: 'Mobile home' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'other', label: 'Other' },
];

export function propertyTypeLabel(value) {
  return PROPERTY_TYPES.find((t) => t.value === value)?.label || null;
}
