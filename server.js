require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const admin     = require('firebase-admin');
const crypto    = require('crypto');

// ===== FIREBASE =====
let db;
function initFirebase() {
  if (admin.apps.length > 0) { db = admin.database(); return db; }
  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  };
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  db = admin.database();
  console.log('✅ Firebase Admin connected');
  return db;
}
function getDb() { if (!db) initFirebase(); return db; }

// ===== FCM TOKENS =====
// بنحفظ tokens الأدمن والعملاء في Firebase
const TOKEN_REF = 'fcm_tokens';

async function saveToken(token, role = 'user') {
  try {
    await getDb().ref(TOKEN_REF + '/' + Buffer.from(token).toString('base64').slice(0,20)).set({
      token, role, time: Date.now()
    });
  } catch(e) { console.error('saveToken error:', e); }
}

async function getTokensByRole(role) {
  try {
    const snap = await getDb().ref(TOKEN_REF).once('value');
    const data = snap.val() || {};
    return Object.values(data).filter(t => t.role === role).map(t => t.token);
  } catch(e) { return []; }
}

async function sendNotification(tokens, title, body) {
  if (!tokens || tokens.length === 0) {
    console.log('📨 FCM: no tokens to send to');
    return;
  }
  const messaging = admin.messaging();
  const results = await Promise.allSettled(
    tokens.map(token =>
      messaging.send({ token, notification: { title, body }, webpush: { notification: { icon: '/logo.png', badge: '/logo.png' } } })
    )
  );
  const ok = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected');
  console.log(`📨 FCM: ${ok}/${tokens.length} sent`);
  if (failed.length > 0) {
    failed.forEach(f => console.error('FCM error:', f.reason?.message || f.reason));
  }
}



// ===== JWT AUTH =====
const JWT_SECRET = process.env.JWT_SECRET || 'samsarny_secret';

function createToken() {
  // Simple JWT-like token: base64(header).base64(payload).signature
  const payload = { admin: true, iat: Date.now() };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = require('crypto').createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return data + '.' + sig;
}

function verifyToken(token) {
  try {
    const [data, sig] = token.split('.');
    const expected = require('crypto').createHmac('sha256', JWT_SECRET).update(data).digest('hex');
    if (sig !== expected) return false;
    const payload = JSON.parse(Buffer.from(data, 'base64').toString());
    // Token valid for 30 days
    if (Date.now() - payload.iat > 30 * 24 * 60 * 60 * 1000) return false;
    return payload.admin === true;
  } catch(e) { return false; }
}

function destroySession(token) {} // JWT is stateless, nothing to destroy

function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'محتاج تسجل دخول' });
  }
  const token = authHeader.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'التوكن غلط أو انتهت صلاحيته' });
  }
  req.isAdmin = true;
  next();
}

// ===== VALIDATE MIDDLEWARE =====
const BAD_WORDS = ['سب', 'شتيمة', 'كلب', 'حمار'];
function containsBadWords(text) {
  if (!text) return false;
  return BAD_WORDS.some((w) => String(text).toLowerCase().includes(w));
}
function checkBadWords(fields) {
  for (const [key, val] of Object.entries(fields)) {
    if (containsBadWords(val)) return `الحقل "${key}" يحتوي على كلمات غير مسموح بها`;
  }
  return null;
}
function validateProperty(req, res, next) {
  const { title, phone } = req.body;
  if (!title || String(title).trim().length < 3)
    return res.status(400).json({ error: 'العنوان مطلوب (3 أحرف على الأقل)' });
  if (!phone || !/^[0-9+\s\-]{7,15}$/.test(String(phone).replace(/\s/g, '')))
    return res.status(400).json({ error: 'رقم الموبايل غير صحيح' });
  const err = checkBadWords({ title: req.body.title, desc: req.body.desc });
  if (err) return res.status(400).json({ error: err });
  next();
}
function validateWorker(req, res, next) {
  const { name, phone } = req.body;
  if (!name || String(name).trim().length < 2)
    return res.status(400).json({ error: 'اسم الصنايعي مطلوب' });
  if (!phone || !/^[0-9+\s\-]{7,15}$/.test(String(phone).replace(/\s/g, '')))
    return res.status(400).json({ error: 'رقم الموبايل غير صحيح' });
  const err = checkBadWords({ name: req.body.name, desc: req.body.desc });
  if (err) return res.status(400).json({ error: err });
  next();
}

// ===== ACTION LOG =====
const actionLog = [];
function logAction(action, details = '') {
  const entry = { action, details, time: new Date().toISOString() };
  actionLog.push(entry);
  if (actionLog.length > 200) actionLog.shift();
  console.log(`[ADMIN LOG] ${entry.time} | ${action} | ${details}`);
}

// ===== PROPERTIES SERVICE =====
const PROP_REF = 'properties';
const propSvc = {
  async getAll() {
    const snap = await getDb().ref(PROP_REF).once('value');
    const data = snap.val() || {};
    return Object.entries(data).map(([id, val]) => ({ id, ...val }));
  },
  async getApproved() { return (await propSvc.getAll()).filter(p => (p.approvalStatus || 'approved') === 'approved'); },
  async getPending()  { return (await propSvc.getAll()).filter(p => p.approvalStatus === 'pending'); },
  async getById(id) {
    const snap = await getDb().ref(`${PROP_REF}/${id}`).once('value');
    if (!snap.exists()) return null;
    return { id, ...snap.val() };
  },
  async create(data, isAdmin = false) {
    const ref = getDb().ref(PROP_REF).push();
    const id = ref.key;
    const item = {
      mode: data.mode || 'offer', title: String(data.title || '').trim(),
      purpose: data.purpose || 'بيع', type: data.type || 'شقة',
      price: Number(data.price) || 0, area: String(data.area || '').trim(),
      phone: String(data.phone || '').replace(/\s/g, ''),
      status: data.status || 'available',
      approvalStatus: isAdmin ? 'approved' : 'pending',
      desc: String(data.desc || '').trim(),
      media: Array.isArray(data.media) ? data.media : [],
      featured: isAdmin ? Boolean(data.featured) : false,
      verified: isAdmin ? Boolean(data.verified) : false,
      views: 0, time: Date.now(),
    };
    await ref.set(item);
    return { id, ...item };
  },
  async update(id, data, isAdmin = false) {
    const existing = await propSvc.getById(id);
    if (!existing) return null;
    const u = {};
    if (data.title !== undefined)   u.title   = String(data.title).trim();
    if (data.purpose !== undefined) u.purpose = data.purpose;
    if (data.type !== undefined)    u.type    = data.type;
    if (data.price !== undefined)   u.price   = Number(data.price) || 0;
    if (data.area !== undefined)    u.area    = String(data.area).trim();
    if (data.phone !== undefined)   u.phone   = String(data.phone).replace(/\s/g, '');
    if (data.status !== undefined)  u.status  = data.status;
    if (data.desc !== undefined)    u.desc    = String(data.desc).trim();
    if (data.mode !== undefined)    u.mode    = data.mode;
    if (data.media !== undefined)   u.media   = data.media;
    if (isAdmin) {
      if (data.approvalStatus !== undefined) u.approvalStatus = data.approvalStatus;
      if (data.featured !== undefined)       u.featured       = Boolean(data.featured);
      if (data.verified !== undefined)       u.verified       = Boolean(data.verified);
    }
    u.updatedAt = Date.now();
    await getDb().ref(`${PROP_REF}/${id}`).update(u);
    return propSvc.getById(id);
  },
  async remove(id) { await getDb().ref(`${PROP_REF}/${id}`).remove(); return true; },
  async incrementViews(id) {
    await getDb().ref(`${PROP_REF}/${id}/views`).transaction(c => (c || 0) + 1);
  },
};

// ===== WORKERS SERVICE =====
const WORK_REF = 'workers';
const workerSvc = {
  async getAll() {
    const snap = await getDb().ref(WORK_REF).once('value');
    const data = snap.val() || {};
    return Object.entries(data).map(([id, val]) => ({ id, ...val }));
  },
  async getApproved() { return (await workerSvc.getAll()).filter(w => (w.approvalStatus || 'approved') === 'approved'); },
  async getPending()  { return (await workerSvc.getAll()).filter(w => w.approvalStatus === 'pending'); },
  async getById(id) {
    const snap = await getDb().ref(`${WORK_REF}/${id}`).once('value');
    if (!snap.exists()) return null;
    return { id, ...snap.val() };
  },
  async create(data, isAdmin = false) {
    const ref = getDb().ref(WORK_REF).push();
    const id = ref.key;
    const item = {
      name: String(data.name || '').trim(), specialty: data.specialty || 'نجار',
      area: String(data.area || '').trim(), phone: String(data.phone || '').replace(/\s/g, ''),
      exp: data.exp || '', desc: String(data.desc || '').trim(),
      approvalStatus: isAdmin ? 'approved' : 'pending',
      featured: isAdmin ? Boolean(data.featured) : false,
      verified: isAdmin ? Boolean(data.verified) : false,
      time: Date.now(),
    };
    await ref.set(item);
    return { id, ...item };
  },
  async update(id, data, isAdmin = false) {
    const existing = await workerSvc.getById(id);
    if (!existing) return null;
    const u = {};
    if (data.name !== undefined)      u.name      = String(data.name).trim();
    if (data.specialty !== undefined) u.specialty = data.specialty;
    if (data.area !== undefined)      u.area      = String(data.area).trim();
    if (data.phone !== undefined)     u.phone     = String(data.phone).replace(/\s/g, '');
    if (data.exp !== undefined)       u.exp       = data.exp;
    if (data.desc !== undefined)      u.desc      = String(data.desc).trim();
    if (isAdmin) {
      if (data.approvalStatus !== undefined) u.approvalStatus = data.approvalStatus;
      if (data.featured !== undefined)       u.featured       = Boolean(data.featured);
      if (data.verified !== undefined)       u.verified       = Boolean(data.verified);
    }
    u.updatedAt = Date.now();
    await getDb().ref(`${WORK_REF}/${id}`).update(u);
    return workerSvc.getById(id);
  },
  async remove(id) { await getDb().ref(`${WORK_REF}/${id}`).remove(); return true; },
};

// ===== EXPRESS APP =====
const app = express();
initFirebase();

// Railway بيستخدم reverse proxy، لازم نعمل trust proxy
app.set('trust proxy', 1);

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '15mb' }));
app.use(morgan('dev'));

const generalLimit = rateLimit({ windowMs: 15*60*1000, max: 200, message: { error: 'كتير أوي، انتظر شوية' }, standardHeaders: true, legacyHeaders: false });
const submitLimit  = rateLimit({ windowMs: 60*60*1000, max: 10,  message: { error: 'بعت كتير أوي، انتظر ساعة' } });
app.use(generalLimit);


// ===== FCM TOKEN ROUTES =====
app.post('/api/fcm/token', async (req, res) => {
  const { token, role } = req.body;
  if (!token) return res.status(400).json({ error: 'token مطلوب' });
  await saveToken(token, role || 'user');
  return res.json({ success: true });
});

// ===== AUTH ROUTES =====
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'كلمة السر مطلوبة' });
  if (password !== process.env.ADMIN_PASSWORD) {
    logAction('LOGIN_FAILED', 'wrong password');
    return res.status(401).json({ error: 'كلمة السر غلط!' });
  }
  const token = createToken();
  logAction('LOGIN_SUCCESS', 'admin logged in');
  return res.json({ success: true, token, message: 'أهلاً يا مسؤول!' });
});
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    destroySession(authHeader.split(' ')[1]);
    logAction('LOGOUT', 'admin logged out');
  }
  return res.json({ success: true, message: 'تم تسجيل الخروج' });
});
app.get('/api/auth/logs', requireAdmin, (req, res) => {
  return res.json({ logs: actionLog.slice(-100).reverse() });
});

// ===== PROPERTIES ROUTES =====
app.get('/api/properties', async (req, res) => {
  try {
    let items = await propSvc.getApproved();

    // ===== SERVER-SIDE FILTERING =====
    const { purpose, mode, status, area, q } = req.query;

    if (purpose) items = items.filter(i => i.purpose === purpose);
    if (mode)    items = items.filter(i => i.mode === mode);
    if (status)  items = items.filter(i => (i.status || 'available') === status);
    if (area)    items = items.filter(i => (i.area || '').includes(area));
    if (q) {
      const ql = q.toLowerCase();
      items = items.filter(i =>
        (i.title || '').toLowerCase().includes(ql) ||
        (i.area  || '').toLowerCase().includes(ql) ||
        (i.type  || '').toLowerCase().includes(ql)
      );
    }

    return res.json({ success: true, data: items, count: items.length });
  } catch(e) { return res.status(500).json({ error: 'خطأ في جلب البيانات' }); }
});
app.get('/api/properties/admin/pending', requireAdmin, async (req, res) => {
  try {
    const items = await propSvc.getPending();
    return res.json({ success: true, data: items, count: items.length });
  } catch(e) { return res.status(500).json({ error: 'خطأ في جلب البيانات' }); }
});
app.get('/api/properties/:id', async (req, res) => {
  try {
    const item = await propSvc.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'الإعلان مش موجود' });
    if (item.approvalStatus !== 'approved' && !req.isAdmin)
      return res.status(404).json({ error: 'الإعلان مش موجود' });
    propSvc.incrementViews(req.params.id).catch(() => {});
    return res.json({ success: true, data: item });
  } catch(e) { return res.status(500).json({ error: 'خطأ في جلب البيانات' }); }
});
app.post('/api/properties', submitLimit, validateProperty, async (req, res) => {
  try {
    const item = await propSvc.create(req.body, req.isAdmin || false);
    const msg = req.isAdmin ? 'تم نشر الإعلان مباشرةً' : 'تم استلام الإعلان وهيتراجع قبل النشر';
    if (req.isAdmin) {
      logAction('CREATE_PROPERTY', item.title);
      // إشعار للعملاء لما الأدمن ينشر عقار جديد
      getTokensByRole('user').then(tokens =>
        sendNotification(tokens, '🏠 عقار جديد على سمسرني!', item.title + ' - ' + (item.area || ''))
      ).catch(()=>{});
    } else {
      // إشعار للأدمن لما العميل يطلب إضافة
      getTokensByRole('admin').then(tokens =>
        sendNotification(tokens, '📋 طلب إضافة جديد!', 'طلب جديد: ' + item.title)
      ).catch(()=>{});
    }
    return res.status(201).json({ success: true, data: item, message: msg });
  } catch(e) { return res.status(500).json({ error: 'خطأ في حفظ البيانات' }); }
});
app.put('/api/properties/:id', requireAdmin, validateProperty, async (req, res) => {
  try {
    const item = await propSvc.update(req.params.id, req.body, true);
    if (!item) return res.status(404).json({ error: 'الإعلان مش موجود' });
    logAction('UPDATE_PROPERTY', req.params.id);
    return res.json({ success: true, data: item, message: 'تم التعديل' });
  } catch(e) { return res.status(500).json({ error: 'خطأ في التعديل' }); }
});
app.delete('/api/properties/:id', requireAdmin, async (req, res) => {
  try {
    await propSvc.remove(req.params.id);
    logAction('DELETE_PROPERTY', req.params.id);
    return res.json({ success: true, message: 'تم الحذف' });
  } catch(e) { return res.status(500).json({ error: 'خطأ في الحذف' }); }
});

// ===== WORKERS ROUTES =====
app.get('/api/workers', async (req, res) => {
  try {
    const items = await workerSvc.getApproved();
    return res.json({ success: true, data: items, count: items.length });
  } catch(e) { return res.status(500).json({ error: 'خطأ في جلب البيانات' }); }
});
app.get('/api/workers/admin/pending', requireAdmin, async (req, res) => {
  try {
    const items = await workerSvc.getPending();
    return res.json({ success: true, data: items, count: items.length });
  } catch(e) { return res.status(500).json({ error: 'خطأ في جلب البيانات' }); }
});
app.get('/api/workers/:id', async (req, res) => {
  try {
    const item = await workerSvc.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'الصنايعي مش موجود' });
    if (item.approvalStatus !== 'approved' && !req.isAdmin)
      return res.status(404).json({ error: 'الصنايعي مش موجود' });
    return res.json({ success: true, data: item });
  } catch(e) { return res.status(500).json({ error: 'خطأ' }); }
});
app.post('/api/workers', submitLimit, validateWorker, async (req, res) => {
  try {
    const item = await workerSvc.create(req.body, req.isAdmin || false);
    const msg = req.isAdmin ? 'تم إضافة الصنايعي مباشرةً' : 'تم استلام البيانات وهيتراجع قبل النشر';
    if (req.isAdmin) {
      logAction('CREATE_WORKER', item.name);
      // إشعار للعملاء لما الأدمن ينشر صنايعي جديد
      getTokensByRole('user').then(tokens =>
        sendNotification(tokens, '🔧 صنايعي جديد على سمسرني!', item.name + ' - ' + (item.specialty || '') + (item.area ? ' - ' + item.area : ''))
      ).catch(()=>{});
    } else {
      // إشعار للأدمن لما العميل يسجل صنايعي
      getTokensByRole('admin').then(tokens =>
        sendNotification(tokens, '🔧 طلب تسجيل صنايعي!', 'طلب جديد: ' + item.name + ' - ' + (item.specialty || ''))
      ).catch(()=>{});
    }
    return res.status(201).json({ success: true, data: item, message: msg });
  } catch(e) { return res.status(500).json({ error: 'خطأ في الحفظ' }); }
});
app.put('/api/workers/:id', requireAdmin, validateWorker, async (req, res) => {
  try {
    const item = await workerSvc.update(req.params.id, req.body, true);
    if (!item) return res.status(404).json({ error: 'الصنايعي مش موجود' });
    logAction('UPDATE_WORKER', req.params.id);
    return res.json({ success: true, data: item, message: 'تم التعديل' });
  } catch(e) { return res.status(500).json({ error: 'خطأ في التعديل' }); }
});
app.delete('/api/workers/:id', requireAdmin, async (req, res) => {
  try {
    await workerSvc.remove(req.params.id);
    logAction('DELETE_WORKER', req.params.id);
    return res.json({ success: true, message: 'تم الحذف' });
  } catch(e) { return res.status(500).json({ error: 'خطأ في الحذف' }); }
});

// ===== ADMIN ROUTES =====
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const [allProps, allWorkers] = await Promise.all([propSvc.getAll(), workerSvc.getAll()]);
    return res.json({
      success: true,
      properties: {
        total: allProps.length,
        pending:  allProps.filter(p => p.approvalStatus === 'pending').length,
        approved: allProps.filter(p => p.approvalStatus === 'approved').length,
        rejected: allProps.filter(p => p.approvalStatus === 'rejected').length,
        pendingItems: allProps.filter(p => p.approvalStatus === 'pending'),
      },
      workers: {
        total: allWorkers.length,
        pending:  allWorkers.filter(w => w.approvalStatus === 'pending').length,
        approved: allWorkers.filter(w => w.approvalStatus === 'approved').length,
        rejected: allWorkers.filter(w => w.approvalStatus === 'rejected').length,
        pendingItems: allWorkers.filter(w => w.approvalStatus === 'pending'),
      },
    });
  } catch(e) { return res.status(500).json({ error: 'خطأ في جلب البيانات' }); }
});
app.put('/api/admin/properties/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved','rejected'].includes(status))
      return res.status(400).json({ error: 'status لازم يكون approved أو rejected' });
    const item = await propSvc.update(req.params.id, { approvalStatus: status }, true);
    if (!item) return res.status(404).json({ error: 'الإعلان مش موجود' });
    logAction(`PROPERTY_${status.toUpperCase()}`, req.params.id);
    // إشعار للعملاء لما الأدمن يوافق على عقار
    if(status === 'approved') {
      try {
        const tokens = await getTokensByRole('user');
        await sendNotification(tokens, '🏠 عقار جديد على سمسرني!', item.title + (item.area ? ' - ' + item.area : ''));
      } catch(ne) { console.error('notify error:', ne.message); }
    }
    return res.json({ success: true, data: item, message: status === 'approved' ? '✅ تم قبول الإعلان' : '❌ تم رفض الإعلان' });
  } catch(e) { return res.status(500).json({ error: 'خطأ' }); }
});
app.put('/api/admin/workers/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved','rejected'].includes(status))
      return res.status(400).json({ error: 'status لازم يكون approved أو rejected' });
    const item = await workerSvc.update(req.params.id, { approvalStatus: status }, true);
    if (!item) return res.status(404).json({ error: 'الصنايعي مش موجود' });
    logAction(`WORKER_${status.toUpperCase()}`, req.params.id);
    // إشعار للعملاء لما الأدمن يوافق على صنايعي
    if(status === 'approved') {
      try {
        const tokens = await getTokensByRole('user');
        await sendNotification(tokens, '🔧 صنايعي جديد على سمسرني!', item.name + (item.specialty ? ' - ' + item.specialty : '') + (item.area ? ' - ' + item.area : ''));
      } catch(ne) { console.error('notify error:', ne.message); }
    }
    return res.json({ success: true, data: item, message: status === 'approved' ? '✅ تم قبول الصنايعي' : '❌ تم رفض الصنايعي' });
  } catch(e) { return res.status(500).json({ error: 'خطأ' }); }
});

// ===== HEALTH =====
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ===== 404 & ERROR =====
app.use((req, res) => res.status(404).json({ error: 'المسار ده مش موجود' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'حصل خطأ في السيرفر' }); });

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Samsarny running on port ${PORT}`));
module.exports = app;
