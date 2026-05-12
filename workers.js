// routes/workers.js
const router = require('express').Router();
const ctrl = require('../controllers/workersController');
const { requireAdmin } = require('../middleware/auth');
const { validateWorker } = require('../middleware/validate');

// Public
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getOne);

// Anyone can submit (goes pending)
router.post('/', validateWorker, ctrl.create);

// Admin only
router.get('/admin/pending', requireAdmin, ctrl.getPending);
router.put('/:id',           requireAdmin, validateWorker, ctrl.update);
router.delete('/:id',        requireAdmin, ctrl.remove);

module.exports = router;
