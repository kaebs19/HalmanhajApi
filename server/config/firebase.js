const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseApp = null;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // fallback: environment variables
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } else {
    console.warn('⚠️ Firebase: لا يوجد ملف service account أو متغيرات بيئة — الإشعارات معطلة');
    return null;
  }

  console.log('✅ Firebase Admin SDK initialized');
  return firebaseApp;
}

function getMessaging() {
  const app = getFirebaseApp();
  if (!app) return null;
  return admin.messaging();
}

module.exports = { getFirebaseApp, getMessaging };
