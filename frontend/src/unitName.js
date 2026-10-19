// Rooms rented individually are units named "Room …"; everything else is "Unit …".
export const isRoomName = (n) => /^room\b/i.test(String(n || ''));
export const unitName = (n) => (isRoomName(n) ? String(n) : `Unit ${n}`);
