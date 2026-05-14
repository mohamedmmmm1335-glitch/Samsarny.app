// server.js  —  نقطة الدخول الرئيسية
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const { initFirebase } = require('./config/firebase');

const app = express();

// ===== Init Firebase =====
initFirebase();

// ===== Middleware =====
app.use(cors({
  origin: '*',  // في production: حط دومين الموقع بدل *
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '15mb' }));  // 15mb عشان base64 الصور
app.use(morgan('dev'));

// ===== Rate Limiting =====
const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 دقيقة
  max: 200,
  message: { error: 'كتير أوي، انتظر شوية' },
  standardHeaders: true,
  legacyHeaders: false,
});

const submitLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // ساعة
  max: 10,  // 10 طلبات بس في الساعة
  message: { error: 'بعت كتير أوي، انتظر ساعة' },
});

app.use(generalLimit);

// ===== Routes =====
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/workers',    require('./routes/workers'));
app.use('/api/admin',      require('./routes/admin'));

// Submit endpoints with extra rate limiting
app.use('/api/properties', submitLimit);
app.use('/api/workers',    submitLimit);

// ===== Health check =====
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({ error: 'المسار ده مش موجود' });
});

// ===== Error handler =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'حصل خطأ في السيرفر' });
});

// ===== Start =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Samsarny Backend running on http://localhost:${PORT}`);
  console.log(`📋 API Endpoints:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/properties`);
  console.log(`   POST   /api/properties`);
  console.log(`   GET    /api/workers`);
  console.log(`   POST   /api/workers`);
  console.log(`   GET    /api/admin/dashboard`);
  console.log(`   GET    /health\n`);
});

module.exports = app;
