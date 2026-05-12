// services/propertiesService.js
const { getDb } = require('../config/firebase');

const REF = 'properties';

async function getAll() {
  const snap = await getDb().ref(REF).once('value');
  const data = snap.val() || {};
  return Object.entries(data).map(([id, val]) => ({ id, ...val }));
}

async function getApproved() {
  const all = await getAll();
  return all.filter((p) => (p.approvalStatus || 'approved') === 'approved');
}

async function getPending() {
  const all = await getAll();
  return all.filter((p) => p.approvalStatus === 'pending');
}

async function getById(id) {
  const snap = await getDb().ref(`${REF}/${id}`).once('value');
  if (!snap.exists()) return null;
  return { id, ...snap.val() };
}

async function create(data, isAdmin = false) {
  const ref = getDb().ref(REF).push();
  const id = ref.key;

  const newProp = {
    mode: data.mode || 'offer',
    title: String(data.title || '').trim(),
    purpose: data.purpose || 'بيع',
    type: data.type || 'شقة',
    price: Number(data.price) || 0,
    area: String(data.area || '').trim(),
    phone: String(data.phone || '').replace(/\s/g, ''),
    status: data.status || 'available',         // available / reserved / sold
    approvalStatus: isAdmin ? 'approved' : 'pending', // admin direct → approved
    desc: String(data.desc || '').trim(),
    media: Array.isArray(data.media) ? data.media : [],
    featured: isAdmin ? Boolean(data.featured) : false,
    verified: isAdmin ? Boolean(data.verified) : false,
    views: 0,
    time: Date.now(),
  };

  await ref.set(newProp);
  return { id, ...newProp };
}

async function update(id, data, isAdmin = false) {
  const existing = await getById(id);
  if (!existing) return null;

  const updates = {};

  if (data.title !== undefined)   updates.title   = String(data.title).trim();
  if (data.purpose !== undefined) updates.purpose = data.purpose;
  if (data.type !== undefined)    updates.type    = data.type;
  if (data.price !== undefined)   updates.price   = Number(data.price) || 0;
  if (data.area !== undefined)    updates.area    = String(data.area).trim();
  if (data.phone !== undefined)   updates.phone   = String(data.phone).replace(/\s/g, '');
  if (data.status !== undefined)  updates.status  = data.status;
  if (data.desc !== undefined)    updates.desc    = String(data.desc).trim();
  if (data.mode !== undefined)    updates.mode    = data.mode;
  if (data.media !== undefined)   updates.media   = data.media;

  // Only admin can change these
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

async function incrementViews(id) {
  await getDb()
    .ref(`${REF}/${id}/views`)
    .transaction((current) => (current || 0) + 1);
}

module.exports = { getApproved, getPending, getAll, getById, create, update, remove, incrementViews };
