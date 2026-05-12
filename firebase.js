// config/firebase.js
const admin = require('firebase-admin');
require('dotenv').config();

let db;

function initFirebase() {
  if (admin.apps.length > 0) {
    db = admin.database();
    return db;
  }

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

function getDb() {
  if (!db) initFirebase();
  return db;
}

module.exports = { initFirebase, getDb };
