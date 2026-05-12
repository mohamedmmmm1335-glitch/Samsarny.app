// routes/properties.js
const router = require('express').Router();
const ctrl = require('../controllers/propertiesController');
const { requireAdmin } = require('../middleware/auth');
const { validateProperty } = require('../middleware/validate');

// Public
router.get('/',         ctrl.getAll);
router.get('/:id',      ctrl.getOne);

// Authenticated submission (anyone can submit, goes pending)
router.post('/', validateProperty, ctrl.create);

// Admin only
router.get('/admin/pending', requireAdmin, ctrl.getPending);
router.put('/:id',           requireAdmin, validateProperty, ctrl.update);
router.delete('/:id',        requireAdmin, ctrl.remove);

module.exports = router;
