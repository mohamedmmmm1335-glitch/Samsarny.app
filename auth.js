// routes/auth.js
const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { requireAdmin } = require('../middleware/auth');

router.post('/login',  ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/logs',    requireAdmin, ctrl.getLogs);

module.exports = router;
