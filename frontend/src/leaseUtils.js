// Shared "months left on lease" calculation, used on the landlord Leases page
// and the tenant Dashboard so both show the same thing the same way.
export function monthsLeftInfo(endDate) {
  if (!endDate) return { label: 'Month-to-month', tone: 'slate' };

  const end = new Date(`${endDate}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((end - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'Lease ended', tone: 'slate' };
  if (diffDays === 0) return { label: 'Ends today', tone: 'red' };

  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  months = Math.max(0, months);

  if (months === 0) {
    return { label: `${diffDays} day${diffDays === 1 ? '' : 's'} left`, tone: 'red' };
  }
  if (months === 1) {
    return { label: '1 month left', tone: 'red' };
  }
  if (months <= 3) {
    return { label: `${months} months left`, tone: 'amber' };
  }
  return { label: `${months} months left`, tone: 'slate' };
}
