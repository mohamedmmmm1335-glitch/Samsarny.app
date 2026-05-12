// controllers/workersController.js
const svc = require('../services/workersService');
const { logAction } = require('./authController');

// GET /api/workers  → public, approved only
async function getAll(req, res) {
  try {
    const items = await svc.getApproved();
    return res.json({ success: true, data: items, count: items.length });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
}

// GET /api/workers/pending  → admin only
async function getPending(req, res) {
  try {
    const items = await svc.getPending();
    return res.json({ success: true, data: items, count: items.length });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
}

// GET /api/workers/:id
async function getOne(req, res) {
  try {
    const item = await svc.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'الصنايعي مش موجود' });

    if (item.approvalStatus !== 'approved' && !req.isAdmin) {
      return res.status(404).json({ error: 'الصنايعي مش موجود' });
    }

    return res.json({ success: true, data: item });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ' });
  }
}

// POST /api/workers
async function create(req, res) {
  try {
    const item = await svc.create(req.body, req.isAdmin || false);
    const msg = req.isAdmin
      ? 'تم إضافة الصنايعي مباشرةً'
      : 'تم استلام البيانات وهيتراجع قبل النشر';

    if (req.isAdmin) logAction('CREATE_WORKER', item.name);
    return res.status(201).json({ success: true, data: item, message: msg });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الحفظ' });
  }
}

// PUT /api/workers/:id
async function update(req, res) {
  try {
    const item = await svc.update(req.params.id, req.body, req.isAdmin || false);
    if (!item) return res.status(404).json({ error: 'الصنايعي مش موجود' });

    if (req.isAdmin) logAction('UPDATE_WORKER', req.params.id);
    return res.json({ success: true, data: item, message: 'تم التعديل' });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في التعديل' });
  }
}

// DELETE /api/workers/:id  → admin only
async function remove(req, res) {
  try {
    await svc.remove(req.params.id);
    logAction('DELETE_WORKER', req.params.id);
    return res.json({ success: true, message: 'تم الحذف' });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الحذف' });
  }
}

module.exports = { getAll, getPending, getOne, create, update, remove };
