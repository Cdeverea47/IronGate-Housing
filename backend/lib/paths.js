// Central place for the two pieces of writable state the app keeps on disk:
// the SQLite file and uploaded documents/avatars-on-disk. In local dev these
// just live inside backend/. In production (e.g. a Render web service) the
// filesystem the app runs on is wiped on every deploy/restart unless you
// attach a persistent disk — set DATA_DIR to that disk's mount path and
// everything below moves there automatically, no other code changes needed.
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');

function getDbPath() {
  return path.join(dataDir, 'data.db');
}

function getUploadsDir() {
  return path.join(dataDir, 'uploads');
}

module.exports = { dataDir, getDbPath, getUploadsDir };
