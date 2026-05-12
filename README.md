# سمسرني Backend - تعليمات التشغيل

## الهيكل
```
samsarny-backend/
├── server.js               ← نقطة الدخول
├── .env                    ← متغيرات البيئة (مش ترفعه على GitHub!)
├── config/
│   └── firebase.js         ← إعداد Firebase Admin SDK
├── routes/
│   ├── auth.js
│   ├── properties.js
│   ├── workers.js
│   └── admin.js
├── controllers/
│   ├── authController.js
│   ├── propertiesController.js
│   ├── workersController.js
│   └── adminController.js
├── services/
│   ├── propertiesService.js
│   └── workersService.js
├── middleware/
│   ├── auth.js             ← حماية الـ routes
│   └── validate.js         ← التحقق من البيانات
└── index.html              ← الفرونت إند المعدّل
```

---

## الخطوات خطوة بخطوة

### 1. نزّل Node.js
من الموقع: https://nodejs.org (نزّل LTS)

### 2. جهّز Firebase Admin SDK

1. افتح [Firebase Console](https://console.firebase.google.com)
2. اختار مشروعك `samsarny-5a5c2`
3. اضغط على ⚙️ Project Settings
4. اختار تبويب **Service accounts**
5. اضغط **Generate new private key**
6. هيتحمل ملف JSON
7. افتح الملف ده وحط البيانات في `.env`:

```env
FIREBASE_PROJECT_ID=samsarny-5a5c2
FIREBASE_DATABASE_URL=https://samsarny-5a5c2-default-rtdb.firebaseio.com
FIREBASE_PRIVATE_KEY_ID=قيمة private_key_id من الملف
FIREBASE_PRIVATE_KEY="قيمة private_key من الملف"
FIREBASE_CLIENT_EMAIL=قيمة client_email من الملف
FIREBASE_CLIENT_ID=قيمة client_id من الملف
ADMIN_EMAIL=admin@samsarny.com
ADMIN_PASSWORD=155361
JWT_SECRET=samsarny_super_secret_2024
PORT=3000
```

> **ملاحظة مهمة للـ FIREBASE_PRIVATE_KEY:**
> في ملف الـ JSON هتلاقي السطر بيبدأ بـ `-----BEGIN RSA PRIVATE KEY-----`
> حطه بين علامات اقتباس مزدوجة وخلي `\n` موجودة زي ما هي

### 3. شغّل السيرفر

```bash
# افتح Terminal/CMD في مجلد المشروع
cd samsarny-backend

# نزّل الحزم
npm install

# شغّل (للتطوير مع إعادة تشغيل تلقائي)
npm run dev

# أو تشغيل عادي
npm start
```

هيظهر:
```
🚀 Samsarny Backend running on http://localhost:3000
```

### 4. عدّل الفرونت إند

في ملف `index.html` في أول الـ JavaScript:
```javascript
const API_BASE = 'http://localhost:3000/api';
```

لما ترفع السيرفر على الإنترنت، غيّره لـ:
```javascript
const API_BASE = 'https://your-server-domain.com/api';
```

---

## API Endpoints

### Auth
| Method | Path | الوصف |
|--------|------|-------|
| POST | `/api/auth/login` | تسجيل دخول الأدمن |
| POST | `/api/auth/logout` | تسجيل خروج |
| GET | `/api/auth/logs` | سجل العمليات (أدمن فقط) |

### Properties
| Method | Path | الوصف |
|--------|------|-------|
| GET | `/api/properties` | كل الإعلانات المعتمدة (عام) |
| GET | `/api/properties/:id` | إعلان واحد |
| POST | `/api/properties` | إضافة إعلان |
| PUT | `/api/properties/:id` | تعديل (أدمن فقط) |
| DELETE | `/api/properties/:id` | حذف (أدمن فقط) |
| GET | `/api/properties/admin/pending` | الإعلانات المعلقة (أدمن) |

### Workers
| Method | Path | الوصف |
|--------|------|-------|
| GET | `/api/workers` | كل الصنايعية المعتمدين (عام) |
| POST | `/api/workers` | إضافة صنايعي |
| PUT | `/api/workers/:id` | تعديل (أدمن) |
| DELETE | `/api/workers/:id` | حذف (أدمن) |
| GET | `/api/workers/admin/pending` | الصنايعية المعلقين (أدمن) |

### Admin Dashboard
| Method | Path | الوصف |
|--------|------|-------|
| GET | `/api/admin/dashboard` | إحصائيات كاملة + pending |
| PUT | `/api/admin/properties/:id/approve` | قبول/رفض إعلان |
| PUT | `/api/admin/workers/:id/approve` | قبول/رفض صنايعي |

**مثال للقبول:**
```json
PUT /api/admin/properties/abc123/approve
{ "status": "approved" }
```

---

## للنشر على الإنترنت

### خيار 1: Railway (مجاني وسهل)
1. اعمل حساب على https://railway.app
2. ارفع الكود على GitHub
3. اعمل New Project من GitHub repo
4. أضف متغيرات البيئة في Settings → Variables
5. هيديك رابط تلقائي

### خيار 2: Render
1. اعمل حساب على https://render.com
2. New Web Service → اربطه بـ GitHub
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. أضف Environment Variables

---

## ملاحظات أمنية مهمة

- ❌ **متحطش** `.env` على GitHub - في `.gitignore` بالفعل
- ✅ غيّر `ADMIN_PASSWORD` لكلمة سر أقوى
- ✅ غيّر `JWT_SECRET` لنص عشوائي طويل
- ✅ في production: خلي `origin` في CORS = دومين موقعك بس
- ✅ الـ Firebase Rules الحالية (read=true) هتظل شغالة لكن مش هيوصل ليها حد من الفرونت إند
