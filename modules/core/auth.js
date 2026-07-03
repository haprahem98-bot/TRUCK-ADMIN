/*
  Auth module - خطة فصل تسجيل الدخول

  تسجيل دخول الأدمن حالياً داخل modules/legacy/app.js
  لكنه صار يقرأ من Firestore:

  admin_settings / admin_login
  password: "123456"
  active: true

  في المرحلة القادمة ننقل:
  - getAdminLoginSettings
  - window.adminLogin
  - window.logout

  إلى هذا الملف بعد فصل startAdmin من legacy.
*/
