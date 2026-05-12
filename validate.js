// middleware/validate.js

// كلمات ممنوعة - تقدر تضيف أكتر
const BAD_WORDS = ['سب', 'شتيمة', 'كلب', 'حمار'];

function containsBadWords(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return BAD_WORDS.some((w) => lower.includes(w));
}

function checkBadWords(fields) {
  for (const [key, val] of Object.entries(fields)) {
    if (containsBadWords(val)) {
      return `الحقل "${key}" يحتوي على كلمات غير مسموح بها`;
    }
  }
  return null;
}

// Validate a property submission
function validateProperty(req, res, next) {
  const { title, phone } = req.body;

  if (!title || String(title).trim().length < 3) {
    return res.status(400).json({ error: 'العنوان مطلوب (3 أحرف على الأقل)' });
  }

  if (!phone || !/^[0-9+\s\-]{7,15}$/.test(String(phone).replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'رقم الموبايل غير صحيح' });
  }

  const badWordError = checkBadWords({ title: req.body.title, desc: req.body.desc });
  if (badWordError) {
    return res.status(400).json({ error: badWordError });
  }

  next();
}

// Validate a worker submission
function validateWorker(req, res, next) {
  const { name, phone } = req.body;

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'اسم الصنايعي مطلوب' });
  }

  if (!phone || !/^[0-9+\s\-]{7,15}$/.test(String(phone).replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'رقم الموبايل غير صحيح' });
  }

  const badWordError = checkBadWords({ name: req.body.name, desc: req.body.desc });
  if (badWordError) {
    return res.status(400).json({ error: badWordError });
  }

  next();
}

module.exports = { validateProperty, validateWorker };
