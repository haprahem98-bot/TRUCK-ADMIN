/*
  Firebase shared module - جاهز للمرحلة القادمة

  حالياً Firebase ما زال داخل:
  modules/legacy/app.js
  modules/config/coordinates.js

  السبب:
  نقل Firebase بالكامل يحتاج نقل كل الأقسام مرة واحدة.
  حتى لا نخرب اللوحة، أبقيناه مستقر وأعددنا هذا الملف للترحيل القادم.
*/

export const firebaseConfig = {
  apiKey: "AIzaSyDp4_Dnaoi8LgTAIuI4_Yb7RS1cYZK-khA",
  authDomain: "truck-app-859d6.firebaseapp.com",
  databaseURL: "https://truck-app-859d6-default-rtdb.firebaseio.com",
  projectId: "truck-app-859d6",
  storageBucket: "truck-app-859d6.firebasestorage.app",
  messagingSenderId: "254005450494",
  appId: "1:254005450494:web:f780fdb6593ef69957f7af",
  measurementId: "G-Q5VBPBG3G4",
};
