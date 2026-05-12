// controllers/authController.js
require('dotenv').config();
const { createSession, destroySession } = require('../middleware/auth');

// Simple log store
const actionLog = [];

function logAction(action, details = '') {
  const entry = {
    action,
    details,
    time: new Date().toISOString(),
  };
  actionLog.push(entry);
  // Keep last 200 logs in memory
  if (actionLog.length > 200) actionLog.shift();
  console.log(`[ADMIN LOG] ${entry.time} | ${action} | ${details}`);
}

// POST /api/auth/login
async function login(req, res) {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'كلمة السر مطلوبة' });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    logAction('LOGIN_FAILED', 'wrong password');
    return res.status(401).json({ error: 'كلمة السر غلط!' });
  }

  const token = createSession();
  logAction('LOGIN_SUCCESS', 'admin logged in');

  return res.json({
    success: true,
    token,
    message: 'أهلاً يا مسؤول!',
  });
}

// POST /api/auth/logout
async function logout(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    destroySession(token);
    logAction('LOGOUT', 'admin logged out');
  }
  return res.json({ success: true, message: 'تم تسجيل الخروج' });
}

// GET /api/auth/logs  (admin only)
async function getLogs(req, res) {
  return res.json({ logs: actionLog.slice(-100).reverse() });
}

module.exports = { login, logout, getLogs, logAction };
