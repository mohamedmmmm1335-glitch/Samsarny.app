// controllers/adminController.js
const propSvc   = require('../services/propertiesService');
const workerSvc = require('../services/workersService');
const { logAction } = require('./authController');

// GET /api/admin/dashboard
async function getDashboard(req, res) {
  try {
    const [allProps, allWorkers] = await Promise.all([
      propSvc.getAll(),
      workerSvc.getAll(),
    ]);

    const propPending  = allProps.filter((p) => p.approvalStatus === 'pending');
    const propApproved = allProps.filter((p) => p.approvalStatus === 'approved');
    const propRejected = allProps.filter((p) => p.approvalStatus === 'rejected');

    const wrkPending  = allWorkers.filter((w) => w.approvalStatus === 'pending');
    const wrkApproved = allWorkers.filter((w) => w.approvalStatus === 'approved');
    const wrkRejected = allWorkers.filter((w) => w.approvalStatus === 'rejected');

    return res.json({
      success: true,
      properties: {
        total: allProps.length,
        pending: propPending.length,
        approved: propApproved.length,
        rejected: propRejected.length,
        pendingItems: propPending,
      },
      workers: {
        total: allWorkers.length,
        pending: wrkPending.length,
        approved: wrkApproved.length,
        rejected: wrkRejected.length,
        pendingItems: wrkPending,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
}

// PUT /api/admin/properties/:id/approve
async function approveProperty(req, res) {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status لازم يكون approved أو rejected' });
    }

    const item = await propSvc.update(req.params.id, { approvalStatus: status }, true);
    if (!item) return res.status(404).json({ error: 'الإعلان مش موجود' });

    logAction(`PROPERTY_${status.toUpperCase()}`, req.params.id);
    return res.json({
      success: true,
      data: item,
      message: status === 'approved' ? '✅ تم قبول الإعلان' : '❌ تم رفض الإعلان',
    });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ' });
  }
}

// PUT /api/admin/workers/:id/approve
async function approveWorker(req, res) {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status لازم يكون approved أو rejected' });
    }

    const item = await workerSvc.update(req.params.id, { approvalStatus: status }, true);
    if (!item) return res.status(404).json({ error: 'الصنايعي مش موجود' });

    logAction(`WORKER_${status.toUpperCase()}`, req.params.id);
    return res.json({
      success: true,
      data: item,
      message: status === 'approved' ? '✅ تم قبول الصنايعي' : '❌ تم رفض الصنايعي',
    });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ' });
  }
}

module.exports = { getDashboard, approveProperty, approveWorker };
