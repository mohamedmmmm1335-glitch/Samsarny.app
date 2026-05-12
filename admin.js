// routes/admin.js
const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

// All admin routes need auth
router.use(requireAdmin);

router.get('/dashboard',                ctrl.getDashboard);
router.put('/properties/:id/approve',   ctrl.approveProperty);
router.put('/workers/:id/approve',      ctrl.approveWorker);

module.exports = router;
