// controllers/propertiesController.js
const svc = require('../services/propertiesService');
const { logAction } = require('./authController');

// GET /api/properties  → public, approved only
async function getAll(req, res) {
  try {
    const items = await svc.getApproved();
    return res.json({ success: true, data: items, count: items.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
}

// GET /api/properties/pending  → admin only
async function getPending(req, res) {
  try {
    const items = await svc.getPending();
    return res.json({ success: true, data: items, count: items.length });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
}

// GET /api/properties/:id
async function getOne(req, res) {
  try {
    const item = await svc.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'الإعلان مش موجود' });

    // Only admins see non-approved items
    if (item.approvalStatus !== 'approved' && !req.isAdmin) {
      return res.status(404).json({ error: 'الإعلان مش موجود' });
    }

    // Increment views (non-blocking)
    svc.incrementViews(req.params.id).catch(() => {});

    return res.json({ success: true, data: item });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
}

// POST /api/properties
async function create(req, res) {
  try {
    const item = await svc.create(req.body, req.isAdmin || false);
    const msg = req.isAdmin
      ? 'تم نشر الإعلان مباشرةً'
      : 'تم استلام الإعلان وهيتراجع قبل النشر';

    if (req.isAdmin) logAction('CREATE_PROPERTY', item.title);
    return res.status(201).json({ success: true, data: item, message: msg });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في حفظ البيانات' });
  }
}

// PUT /api/properties/:id
async function update(req, res) {
  try {
    const item = await svc.update(req.params.id, req.body, req.isAdmin || false);
    if (!item) return res.status(404).json({ error: 'الإعلان مش موجود' });

    if (req.isAdmin) logAction('UPDATE_PROPERTY', `${req.params.id} → ${JSON.stringify(req.body)}`);
    return res.json({ success: true, data: item, message: 'تم التعديل' });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في التعديل' });
  }
}

// DELETE /api/properties/:id  → admin only
async function remove(req, res) {
  try {
    await svc.remove(req.params.id);
    logAction('DELETE_PROPERTY', req.params.id);
    return res.json({ success: true, message: 'تم الحذف' });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الحذف' });
  }
}

module.exports = { getAll, getPending, getOne, create, update, remove };
