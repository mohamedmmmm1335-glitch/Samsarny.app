// services/workersService.js
const { getDb } = require('../config/firebase');

const REF = 'workers';

async function getAll() {
  const snap = await getDb().ref(REF).once('value');
  const data = snap.val() || {};
  return Object.entries(data).map(([id, val]) => ({ id, ...val }));
}

async function getApproved() {
  const all = await getAll();
  return all.filter((w) => (w.approvalStatus || 'approved') === 'approved');
}

async function getPending() {
  const all = await getAll();
  return all.filter((w) => w.approvalStatus === 'pending');
}

async function getById(id) {
  const snap = await getDb().ref(`${REF}/${id}`).once('value');
  if (!snap.exists()) return null;
  return { id, ...snap.val() };
}

async function create(data, isAdmin = false) {
  const ref = getDb().ref(REF).push();
  const id = ref.key;

  const newWorker = {
    name: String(data.name || '').trim(),
    specialty: data.specialty || 'نجار',
    area: String(data.area || '').trim(),
    phone: String(data.phone || '').replace(/\s/g, ''),
    exp: data.exp || '',
    desc: String(data.desc || '').trim(),
    approvalStatus: isAdmin ? 'approved' : 'pending',
    featured: isAdmin ? Boolean(data.featured) : false,
    verified: isAdmin ? Boolean(data.verified) : false,
    time: Date.now(),
  };

  await ref.set(newWorker);
  return { id, ...newWorker };
}

async function update(id, data, isAdmin = false) {
  const existing = await getById(id);
  if (!existing) return null;

  const updates = {};

  if (data.name !== undefined)      updates.name      = String(data.name).trim();
  if (data.specialty !== undefined) updates.specialty = data.specialty;
  if (data.area !== undefined)      updates.area      = String(data.area).trim();
  if (data.phone !== undefined)     updates.phone     = String(data.phone).replace(/\s/g, '');
  if (data.exp !== undefined)       updates.exp       = data.exp;
  if (data.desc !== undefined)      updates.desc      = String(data.desc).trim();

  if (isAdmin) {
    if (data.approvalStatus !== undefined) updates.approvalStatus = data.approvalStatus;
    if (data.featured !== undefined)       updates.featured       = Boolean(data.featured);
    if (data.verified !== undefined)       updates.verified       = Boolean(data.verified);
  }

  updates.updatedAt = Date.now();

  await getDb().ref(`${REF}/${id}`).update(updates);
  return getById(id);
}

async function remove(id) {
  await getDb().ref(`${REF}/${id}`).remove();
  return true;
}

module.exports = { getApproved, getPending, getAll, getById, create, update, remove };
