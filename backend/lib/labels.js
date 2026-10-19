// How a unit is named in maintenance requests, alerts and emails:
//   - a real unit:                   "Unit 2 (Oak House)"
//   - a whole-property "no units"
//     home (single family):          "Oak House"
//   - a rented-out room:             "Room 2 (Oak House)"
// Rooms are units whose number starts with "Room".
const isRoomName = (n) => /^room\b/i.test(String(n || ''));
// Display name of a unit by itself: "Unit 2" or "Room 2".
const unitName = (n) => (isRoomName(n) ? String(n) : `Unit ${n}`);
// Rooms are always stored as "Room …".
const roomName = (n) => (isRoomName(n) ? String(n).trim() : `Room ${String(n).trim()}`);

function unitLabel(unitNumber, propertyName, isDefault) {
  if (isDefault) return propertyName;
  return `${unitName(unitNumber)} (${propertyName})`;
}

module.exports = { unitLabel, unitName, roomName, isRoomName };
