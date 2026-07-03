import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  collection,
  collectionGroup,
  query,
  limit,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDp4_Dnaoi8LgTAIuI4_Yb7RS1cYZK-khA",
  authDomain: "truck-app-859d6.firebaseapp.com",
  databaseURL: "https://truck-app-859d6-default-rtdb.firebaseio.com",
  projectId: "truck-app-859d6",
  storageBucket: "truck-app-859d6.firebasestorage.app",
  messagingSenderId: "254005450494",
  appId: "1:254005450494:web:f780fdb6593ef69957f7af",
  measurementId: "G-Q5VBPBG3G4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_ADMIN_PASSWORD = "123456";

let usersUnsubscribe = null;
let ordersUnsubscribe = null;
let loadsUnsubscribe = null;
let availabilityUnsubscribe = null;
let trackingUnsubscribe = null;
let messageUnsubscribe = null;
let settingsUnsubscribe = null;
let countersUnsubscribe = null;
let adminLogsUnsubscribe = null;
let configUnsubscribes = [];
let filtersBound = false;

let allUsersCache = [];
let allOrdersCache = [];
let allLoadsCache = [];
let allAvailabilityCache = [];
let allTrackingCache = [];
let allAdminLogsCache = [];
let countersCache = {};
let truckTypesConfig = [];
let loadTypesConfig = [];
let governoratesConfig = [];
let citiesConfig = [];

let usersSearchText = "";
let usersRoleFilter = "all";
let usersStatusFilter = "all";
let driversSearchText = "";
let driversAvailabilityFilter = "available";
let ownersSearchText = "";
let ownersFilter = "all";
let ordersSearchText = "";
let ordersStatusFilter = "all";
let ordersTypeFilter = "all";
let loadsSearchText = "";
let loadsStatusFilter = "all";
let availabilitySearchText = "";
let availabilityStatusFilter = "active";
let trackingSearchText = "";
let trackingStatusFilter = "active";
let subscriptionsSearchText = "";
let subscriptionsStatusFilter = "all";
let subscriptionsRoleFilter = "all";
let adminNotificationsSearchText = "";
let adminNotificationsTypeFilter = "all";
let adminNotificationsLevelFilter = "all";
let windowsNotificationsEnabled = localStorage.getItem("adminWindowsNotificationsEnabled") === "true";
let notifiedAdminNotificationIds = new Set(JSON.parse(localStorage.getItem("notifiedAdminNotificationIds") || "[]"));

const pageMeta = {
  home: ["الرئيسية", "نظرة عامة على نشاط التطبيق"],
  users: ["المستخدمين", "إدارة الحسابات والتوثيق والحظر"],
  drivers: ["السائقين", "متابعة السائقين والتوفر والشاحنات"],
  owners: ["أصحاب البضاعة", "متابعة أصحاب البضاعة والطلبات والحمولات"],
  orders: ["الطلبات", "تحكم كامل بحالات الطلبات"],
  loads: ["الحمولات", "إدارة الحمولات المنشورة"],
  availability: ["التوفر", "إدارة توفر السائقين"],
  tracking: ["التتبع المباشر", "متابعة مواقع الشاحنات حسب الطلبات النشطة"],
  message: ["الرسائل", "رسائل عامة وإشعارات داخلية"],
  settings: ["الإعدادات", "إعدادات التطبيق والعدادات"],
  config: ["القوائم", "إدارة المحافظات والمدن وأنواع الشاحنات من قاعدة البيانات"],
};

pageMeta.subscriptions = ["الاشتراكات", "إدارة الاشتراكات والتجديدات وانتهاء الصلاحية"];
pageMeta.notifications = ["تنبيهات الإدارة", "كل التنبيهات المهمة من الحسابات والاشتراكات والطلبات"];

const orderStatuses = [
  "بانتظار موافقة السائق",
  "بانتظار موافقة صاحب البضاعة",
  "مقبول",
  "تم التحميل",
  "في الطريق",
  "تم التسليم",
  "مرفوض",
  "ملغي",
  "ملغي تلقائياً",
  "منتهي",
];

const loadStatuses = ["available", "reserved", "delivered", "cancelled"];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanPhone(phone) {
  return String(phone || "")
    .replaceAll("+", "")
    .replaceAll(" ", "")
    .replaceAll("-", "")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .trim();
}

function parseFirestoreDate(value) {
  try {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function formatDateTime(value) {
  const date = parseFirestoreDate(value);
  if (!date) return "-";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${h}:${min}`;
}

function setLastUpdated() {
  if ($("lastUpdatedText")) {
    $("lastUpdatedText").textContent = `آخر تحديث: ${new Date().toLocaleTimeString("ar-SY")}`;
  }
}

function toast(message, type = "success") {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function getRoleText(role) {
  if (role === "driver") return "سائق";
  if (role === "owner") return "صاحب بضاعة";
  if (role === "admin") return "أدمن";
  return "غير محدد";
}

function getRoleIcon(role) {
  if (role === "driver") return "🚚";
  if (role === "owner") return "📦";
  if (role === "admin") return "🛡️";
  return "👤";
}

function getUserStatus(user) {
  if (user.isActive === false) return "blocked";
  if (user.isVerified === true) return "verified";
  return "pending";
}

function getUserStatusText(user) {
  const status = getUserStatus(user);
  if (status === "blocked") return "محظور";
  if (status === "verified") return "موثق";
  return "بانتظار التوثيق";
}

function isActiveOrder(status) {
  return [
    "بانتظار موافقة السائق",
    "بانتظار موافقة صاحب البضاعة",
    "مقبول",
    "تم التحميل",
    "في الطريق",
  ].includes(status);
}

function isCancelledOrder(status) {
  return status === "ملغي" || status === "ملغي تلقائياً";
}

function isAvailabilityActive(availability) {
  if (availability.isActive !== true) return false;
  const until = parseFirestoreDate(availability.availableUntil);
  if (!until) return true;
  return until.getTime() > Date.now();
}

function availabilityFrom(availability) {
  return availability.fromGovernorate || availability.currentGovernorate || availability.currentCity || availability.fromCity || "-";
}

function availabilityTo(availability) {
  return availability.toGovernorate || availability.destinationGovernorate || availability.destination || availability.toCity || "-";
}

function orderNumberText(order) {
  const number = Number(order.orderNumber || 0);
  if (number > 0) return `ORD-${String(number).padStart(6, "0")}`;
  return `ORD-${shortNumberFromId(order.id || order.docId || "")}`;
}

function loadNumberText(load) {
  const number = Number(load.loadNumber || 0);
  if (number > 0) return `LOAD-${String(number).padStart(6, "0")}`;
  return `LOAD-${shortNumberFromId(load.id || load.docId || "")}`;
}

function shortNumberFromId(id) {
  const text = String(id || "");
  const digits = text.replace(/[^0-9]/g, "");
  if (digits.length >= 6) return digits.slice(-6);
  if (digits.length > 0) return digits.padStart(6, "0");
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) & 0x7fffffff;
  return String((hash % 900000) + 100000);
}

function loadStatusText(status) {
  if (status === "available") return "متاحة";
  if (status === "reserved") return "محجوزة";
  if (status === "delivered") return "تم التسليم";
  if (status === "cancelled") return "ملغاة";
  return status || "غير محدد";
}

function badgeClassForStatus(status) {
  if (String(status || "").includes("بانتظار")) return "pending";
  if (status === "تم التسليم" || status === "delivered") return "verified";
  if (status === "available") return "available";
  if (status === "reserved" || status === "مقبول" || status === "تم التحميل" || status === "في الطريق") return "active-order";
  if (String(status || "").includes("ملغي") || status === "cancelled" || status === "مرفوض") return "blocked";
  return "neutral";
}

function infoRow(title, value) {
  return `<div class="info-row"><span>${escapeHtml(title)}:</span> ${escapeHtml(value || "-")}</div>`;
}

function buildStatCard(icon, title, value) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div>
        <div class="stat-value">${escapeHtml(value)}</div>
        <div class="stat-title">${escapeHtml(title)}</div>
      </div>
    </div>`;
}

function buildMiniStat(title, value) {
  return `
    <div class="mini-stat">
      <div class="mini-stat-value">${escapeHtml(value)}</div>
      <div class="mini-stat-title">${escapeHtml(title)}</div>
    </div>`;
}

function byCreatedDesc(a, b) {
  const ad = parseFirestoreDate(a.createdAt) || new Date(0);
  const bd = parseFirestoreDate(b.createdAt) || new Date(0);
  return bd.getTime() - ad.getTime();
}


function trackingDocOrderId(item) {
  return item.orderId || item.parentOrderId || item.docId || "";
}

function getTrackingForOrder(order) {
  const orderId = String(order.id || order.docId || "").trim();
  if (!orderId) return null;

  return allTrackingCache.find((t) => {
    const tOrderId = String(trackingDocOrderId(t) || "").trim();
    return tOrderId === orderId;
  }) || null;
}

function readNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasTrackingLocation(tracking) {
  return readNumber(tracking?.driverLat) !== null && readNumber(tracking?.driverLng) !== null;
}

function isTrackingLive(tracking) {
  return tracking?.isTracking === true;
}

function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
}

function detailRow(title, value) {
  return `
    <div class="detail-row">
      <span>${escapeHtml(title)}</span>
      <b>${escapeHtml(value || "-")}</b>
    </div>`;
}

function detailLink(title, value, url) {
  if (!value || !url) return detailRow(title, value);
  return `
    <div class="detail-row">
      <span>${escapeHtml(title)}</span>
      <b><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(value)}</a></b>
    </div>`;
}

function findUserByNameOrPhone(name, phone, role = "") {
  const clean = cleanPhone(phone || "");
  const normalizedName = String(name || "").trim();

  return allUsersCache.find((user) => {
    const userPhone = cleanPhone(user.phone || "");
    const userName = String(user.name || "").trim();
    const roleOk = !role || user.role === role;

    return roleOk && (
      (clean && userPhone && clean === userPhone) ||
      (normalizedName && userName && normalizedName === userName)
    );
  }) || null;
}

function getLoadForOrder(order) {
  const loadId = String(order.loadId || order.loadDocId || "").trim();

  return allLoadsCache.find((load) => {
    return load.docId === loadId ||
      load.id === loadId ||
      load.loadId === loadId ||
      loadNumberText(load) === loadId;
  }) || null;
}

function getOrdersForLoad(load) {
  const loadIds = [
    load.docId,
    load.id,
    load.loadId,
    loadNumberText(load),
  ].filter(Boolean).map((value) => String(value).trim());

  return allOrdersCache.filter((order) => {
    const orderLoadId = String(order.loadId || order.loadDocId || "").trim();
    return orderLoadId && loadIds.includes(orderLoadId);
  }).sort(byCreatedDesc);
}

function whatsappUrl(name, phone) {
  const clean = cleanPhone(phone || "");
  if (!clean) return "";
  const message = encodeURIComponent(`مرحباً ${name || ""}\nنحن إدارة تطبيق حمولتي.\nنرغب بالتواصل معك بخصوص الطلب.`);
  return `https://wa.me/${clean}?text=${message}`;
}

function buildTimelineItem(icon, title, value, muted = false) {
  return `
    <div class="timeline-item ${muted ? "muted" : ""}">
      <div class="timeline-icon">${icon}</div>
      <div>
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(value || "-")}</p>
      </div>
    </div>`;
}

function findActiveAvailabilityForDriver(user) {
  const phone = cleanPhone(user.phone || "");
  const name = String(user.name || "").trim();
  return allAvailabilityCache.find((availability) => {
    const aPhone = cleanPhone(availability.phone || availability.driverPhone || "");
    const aName = String(availability.driverName || availability.name || "").trim();
    return isAvailabilityActive(availability) && ((phone && aPhone && phone === aPhone) || (name && aName && name === aName));
  });
}

async function getAdminLoginSettings() {
  const ref = doc(db, "admin_settings", "admin_login");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      password: DEFAULT_ADMIN_PASSWORD,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      note: "يمكن تغيير كلمة مرور لوحة الإدارة من هذه الوثيقة",
    }, { merge: true });

    return {
      password: DEFAULT_ADMIN_PASSWORD,
      active: true,
    };
  }

  const data = snap.data();

  return {
    password: String(data.password || DEFAULT_ADMIN_PASSWORD),
    active: data.active !== false,
  };
}

window.adminLogin = async function () {
  const passwordInput = $("adminPassword");
  const loginButton = document.querySelector(".login-card .primary-btn");
  const password = passwordInput?.value?.trim() || "";

  if (!password) {
    alert("اكتب كلمة مرور الإدارة");
    return;
  }

  try {
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = "جاري التحقق...";
    }

    const settings = await getAdminLoginSettings();

    if (!settings.active) {
      alert("تسجيل دخول لوحة الإدارة موقوف حالياً من قاعدة البيانات");
      return;
    }

    if (password !== settings.password) {
      alert("كلمة مرور الأدمن غير صحيحة");
      return;
    }

    localStorage.setItem("adminLoggedIn", "true");
    localStorage.setItem("adminName", "admin");
    $("loginBox").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    ensureMobileAdminShell();
    startAdmin();
    addAdminLog("login", { source: "admin_panel" });
  } catch (error) {
    console.error("Admin login error:", error);
    alert("تعذر التحقق من كلمة المرور من قاعدة البيانات. تأكد من الاتصال وقواعد Firestore.");
  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = "دخول";
    }
  }
};

window.logout = function () {
  localStorage.removeItem("adminLoggedIn");
  [usersUnsubscribe, ordersUnsubscribe, loadsUnsubscribe, availabilityUnsubscribe, trackingUnsubscribe, messageUnsubscribe, settingsUnsubscribe, countersUnsubscribe, adminLogsUnsubscribe, ...configUnsubscribes]
    .forEach((fn) => { if (fn) fn(); });
  location.reload();
};

window.showSection = function (section) {
  if (section === "settings") {
    ensureSettingsHelpTooltips();
    ensureFreeTrialEnabledSettingField();
  }

  if (section === "subscriptions") {
    ensureSubscriptionsSection();
    renderSubscriptions();
  }

  if (section === "notifications") {
    ensureAdminNotificationsSection();
    renderAdminNotifications();
  }
  document.querySelectorAll(".section").forEach((el) => el.classList.add("hidden"));
  $(`${section}Section`)?.classList.remove("hidden");
  document.querySelectorAll(".menu-btn").forEach((btn) => btn.classList.remove("active"));
  const activeMenuButton = document.querySelector(`.menu-btn[data-section="${section}"]`);
  activeMenuButton?.classList.add("active");
  activeMenuButton?.scrollIntoView({ block: "nearest", inline: "nearest" });
  const meta = pageMeta[section] || pageMeta.home;
  if ($("pageTitle")) $("pageTitle").textContent = meta[0];
  if ($("pageSubtitle")) $("pageSubtitle").textContent = meta[1];
  updateMobileAdminHeader(section);
  closeMobileAdminMenu();
};


function ensureMobileAdminShell() {
  if ($("mobileAdminHeader")) return;

  const header = document.createElement("div");
  header.id = "mobileAdminHeader";
  header.className = "mobile-admin-header";
  header.innerHTML = `
    <button id="mobileMenuToggle" class="mobile-menu-toggle" type="button" aria-label="فتح القائمة">
      <span></span><span></span><span></span>
    </button>
    <div class="mobile-admin-title">
      <strong id="mobilePageTitle">الرئيسية</strong>
      <small id="mobilePageSubtitle">لوحة الإدارة</small>
    </div>
    <button id="mobileQuickBell" class="mobile-quick-bell" type="button" aria-label="التنبيهات">🔔</button>
  `;

  const overlay = document.createElement("div");
  overlay.id = "mobileMenuOverlay";
  overlay.className = "mobile-menu-overlay";

  document.body.appendChild(header);
  document.body.appendChild(overlay);

  $("mobileMenuToggle")?.addEventListener("click", toggleMobileAdminMenu);
  $("mobileQuickBell")?.addEventListener("click", () => {
    window.showSection("notifications");
    closeMobileAdminMenu();
  });
  overlay.addEventListener("click", closeMobileAdminMenu);

  document.querySelectorAll(".menu-btn").forEach((btn) => {
    btn.addEventListener("click", closeMobileAdminMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileAdminMenu();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 960) closeMobileAdminMenu();
  });

  updateMobileAdminHeader("home");
}

function openMobileAdminMenu() {
  document.body.classList.add("mobile-menu-open");
}

function closeMobileAdminMenu() {
  document.body.classList.remove("mobile-menu-open");
}

function toggleMobileAdminMenu() {
  document.body.classList.toggle("mobile-menu-open");
}

function updateMobileAdminHeader(section) {
  const meta = pageMeta[section] || pageMeta.home;
  if ($("mobilePageTitle")) $("mobilePageTitle").textContent = meta[0];
  if ($("mobilePageSubtitle")) $("mobilePageSubtitle").textContent = meta[1];

  const badge = $("adminGlobalNotificationsBadge");
  const quickBell = $("mobileQuickBell");
  if (quickBell && badge) {
    const count = badge.classList.contains("hidden") ? "" : badge.textContent.trim();
    quickBell.dataset.count = count;
    quickBell.classList.toggle("has-count", !!count);
  }
}



function enhanceMobileAdminInteractions() {
  if (window.__mobileAdminEnhancedV2) return;
  window.__mobileAdminEnhancedV2 = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target) return;

    const closeLike = target.closest?.(
      ".modal-close-btn, .close-btn, .admin-modal-close, .details-modal-close, [data-close-modal], [onclick*='closeModal'], [onclick*='closeDetailsModal']"
    );

    if (closeLike) {
      document.body.classList.remove("mobile-modal-open");
      setTimeout(() => document.body.classList.remove("mobile-modal-open"), 250);
    }
  }, true);

  const modalObserver = new MutationObserver(() => {
    const hasOpenModal = Array.from(document.querySelectorAll(
      ".modal:not(.hidden), .admin-modal-overlay:not(.hidden), .details-modal:not(.hidden), .manage-modal:not(.hidden), .modal-overlay:not(.hidden)"
    )).some((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    });

    document.body.classList.toggle("mobile-modal-open", hasOpenModal);
  });

  modalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  document.addEventListener("touchstart", (event) => {
    if (!document.body.classList.contains("mobile-menu-open")) return;

    const sidebar = document.querySelector(".sidebar");
    const toggle = document.querySelector("#mobileMenuToggle");

    if (sidebar?.contains(event.target) || toggle?.contains(event.target)) return;

    closeMobileAdminMenu();
  }, { passive: true });
}


function startAdmin() {
  enhanceMobileAdminInteractions();
  ensureMobileAdminShell();
  ensureSettingsHelpTooltips();
  ensureFreeTrialEnabledSettingField();
  setTimeout(ensureSettingsHelpTooltips, 700);
  setTimeout(ensureFreeTrialEnabledSettingField, 700);
  ensureSubscriptionsSection();
  ensureAdminNotificationsSection();
  ensureGlobalNotificationBell();
  bindFilters();
  listenUsers();
  listenOrders();
  listenLoads();
  listenAvailability();
  listenTracking();
  listenGlobalMessage();
  listenSettings();
  listenCounters();
  listenAdminLogs();
  showAdminLogsBlockAlways();
  // listenAppConfigLists(); // moved to modules/config/config.js
}

function bindFilters() {
  if (filtersBound) return;
  filtersBound = true;

  $("usersSearchInput")?.addEventListener("input", (e) => { usersSearchText = e.target.value.trim(); renderUsers(); });
  $("usersRoleFilter")?.addEventListener("change", (e) => { usersRoleFilter = e.target.value; renderUsers(); });
  $("usersStatusFilter")?.addEventListener("change", (e) => { usersStatusFilter = e.target.value; renderUsers(); });
  $("driversSearchInput")?.addEventListener("input", (e) => { driversSearchText = e.target.value.trim(); renderDrivers(); });
  $("driversAvailabilityFilter")?.addEventListener("change", (e) => { driversAvailabilityFilter = e.target.value; renderDrivers(); });
  $("ownersSearchInput")?.addEventListener("input", (e) => { ownersSearchText = e.target.value.trim(); renderOwners(); });
  $("ownersFilter")?.addEventListener("change", (e) => { ownersFilter = e.target.value; renderOwners(); });
  $("ordersSearchInput")?.addEventListener("input", (e) => { ordersSearchText = e.target.value.trim(); renderOrders(); });
  $("ordersStatusFilter")?.addEventListener("change", (e) => { ordersStatusFilter = e.target.value; renderOrders(); renderOrdersStatusChips(); });
  $("ordersTypeFilter")?.addEventListener("change", (e) => { ordersTypeFilter = e.target.value; renderOrders(); });
  $("loadsSearchInput")?.addEventListener("input", (e) => { loadsSearchText = e.target.value.trim(); renderLoads(); });
  $("loadsStatusFilter")?.addEventListener("change", (e) => { loadsStatusFilter = e.target.value; renderLoads(); renderLoadsStatusChips(); });
  $("availabilitySearchInput")?.addEventListener("input", (e) => { availabilitySearchText = e.target.value.trim(); renderAvailability(); });
  $("availabilityStatusFilter")?.addEventListener("change", (e) => { availabilityStatusFilter = e.target.value; renderAvailability(); });
  $("trackingSearchInput")?.addEventListener("input", (e) => { trackingSearchText = e.target.value.trim(); renderTracking(); });
  $("trackingStatusFilter")?.addEventListener("change", (e) => { trackingStatusFilter = e.target.value; renderTracking(); });
}

function listenUsers() {
  if (usersUnsubscribe) return;
  usersUnsubscribe = onSnapshot(query(collection(db, "users")), (snapshot) => {
    allUsersCache = snapshot.docs.map((d) => ({ docId: d.id, ...d.data() })).sort(byCreatedDesc);
    renderAll();
    setLastUpdated();
  });
}

function listenOrders() {
  if (ordersUnsubscribe) return;
  ordersUnsubscribe = onSnapshot(query(collection(db, "orders")), (snapshot) => {
    allOrdersCache = snapshot.docs.map((d) => ({ docId: d.id, ...d.data() })).sort(byCreatedDesc);
    renderAll();
    setLastUpdated();
  });
}

function listenLoads() {
  if (loadsUnsubscribe) return;
  loadsUnsubscribe = onSnapshot(query(collection(db, "loads")), (snapshot) => {
    allLoadsCache = snapshot.docs.map((d) => ({ docId: d.id, ...d.data() })).sort(byCreatedDesc);
    renderAll();
    setLastUpdated();
  });
}

function listenAvailability() {
  if (availabilityUnsubscribe) return;
  availabilityUnsubscribe = onSnapshot(query(collection(db, "driver_availability")), (snapshot) => {
    allAvailabilityCache = snapshot.docs.map((d) => ({ docId: d.id, ...d.data() })).sort(byCreatedDesc);
    renderAll();
    setLastUpdated();
  });
}


function listenTracking() {
  if (trackingUnsubscribe) return;

  // التطبيق يقرأ الموقع من:
  // orders/{orderId}/tracking/current
  // لذلك نستخدم collectionGroup("tracking") حتى نراقب كل الطلبات من لوحة الإدارة.
  trackingUnsubscribe = onSnapshot(query(collectionGroup(db, "tracking")), (snapshot) => {
    allTrackingCache = snapshot.docs
      .filter((d) => d.id === "current")
      .map((d) => ({
        docId: d.id,
        orderId: d.ref.parent.parent?.id || "",
        ...d.data(),
      }));

    renderAll();
    setLastUpdated();
  });
}

function listenCounters() {
  if (countersUnsubscribe) return;
  countersUnsubscribe = onSnapshot(query(collection(db, "counters")), (snapshot) => {
    countersCache = {};
    snapshot.docs.forEach((d) => { countersCache[d.id] = d.data(); });
    if ($("ordersCounterInput")) $("ordersCounterInput").value = countersCache.orders?.lastNumber ?? 0;
    if ($("loadsCounterInput")) $("loadsCounterInput").value = countersCache.loads?.lastNumber ?? 0;
    renderStats();
  });
}

function listenGlobalMessage() {
  if (messageUnsubscribe) return;
  messageUnsubscribe = onSnapshot(doc(db, "app_config", "global_message"), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if ($("globalMessageTitle")) $("globalMessageTitle").value = data.title || "";
    if ($("globalMessageBody")) $("globalMessageBody").value = data.body || "";
    if ($("globalMessageActive")) $("globalMessageActive").checked = data.isActive === true;
    if ($("globalMessageEveryTime")) $("globalMessageEveryTime").checked = data.showEveryTime === true;
  });
}





function addSettingHelpIcon(inputId, tooltipText) {
  const input = $(inputId);
  if (!input) return false;

  const existing = document.querySelector(`[data-help-for="${inputId}"]`);
  if (existing) {
    existing.title = tooltipText;
    return true;
  }

  const block =
    input.closest(".form-group, .setting-card, .field, label, .toggle-row, .settings-row, div") ||
    input.parentElement;

  if (!block) return false;

  block.title = tooltipText;

  const help = document.createElement("span");
  help.className = "admin-setting-help-icon";
  help.dataset.helpFor = inputId;
  help.title = tooltipText;
  help.textContent = "؟";
  help.style.cssText = `
    width:22px;
    height:22px;
    min-width:22px;
    border-radius:999px;
    background:#e0f2fe;
    color:#0369a1;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-weight:900;
    font-size:13px;
    margin-inline-start:8px;
    cursor:help;
    vertical-align:middle;
  `;

  const strongOrLabel =
    block.querySelector("strong") ||
    block.querySelector("label") ||
    block.querySelector("span") ||
    block;

  if (strongOrLabel === block) {
    block.appendChild(help);
  } else {
    strongOrLabel.insertAdjacentElement("afterend", help);
  }

  return true;
}

function ensureSettingsHelpTooltips() {
  const registrationTooltip = "إذا كان مفعّل: المستخدمين يقدروا ينشئوا حسابات جديدة. إذا كان موقوف: زر التسجيل/إنشاء حساب يتوقف والتطبيق يخبر المستخدم أن التسجيل موقوف من الإدارة.";
  const maintenanceTooltip = "إذا كان مفعّل: التطبيق يدخل وضع الصيانة، يمنع الدخول والاستخدام مؤقتاً ويظهر للمستخدم أن التطبيق قيد الصيانة. إذا كان موقوف: التطبيق يعمل بشكل طبيعي.";

  const ok1 = addSettingHelpIcon("registrationEnabled", registrationTooltip);
  const ok2 = addSettingHelpIcon("maintenanceMode", maintenanceTooltip);

  if (!ok1 || !ok2) {
    setTimeout(ensureSettingsHelpTooltips, 500);
  }
}


function ensureFreeTrialEnabledSettingField() {
  if ($("freeTrialEnabled")) return;

  const tooltipText = "إذا فعلتها: أي مستخدم جديد بعد التوثيق يأخذ المدة المجانية المحددة. إذا أوقفتها: المستخدم بعد التوثيق يصبح موثق فقط ويحتاج اشتراك يدوي من صفحة الاشتراكات.";

  const maintenanceInput = $("maintenanceMode");
  const freeMonthsInput = $("freeMonths");
  const settingsSection =
    $("settingsSection") ||
    document.querySelector('[data-section="settings"]') ||
    document.querySelector(".settings-section") ||
    document.querySelector("#settings");

  const wrapper = document.createElement("div");
  wrapper.id = "freeTrialEnabledCard";
  wrapper.className = "admin-setting-card free-trial-toggle-card";
  wrapper.title = tooltipText;
  wrapper.style.cssText = `
    display:block;
    width:100%;
    padding:14px 16px;
    margin:12px 0;
    border-radius:18px;
    background:#f8fafc;
    border:1px solid #dbeafe;
    box-shadow:0 8px 22px rgba(15,23,42,.06);
  `;

  wrapper.innerHTML = `
    <label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;margin:0;">
      <input type="checkbox" id="freeTrialEnabled" style="margin-top:6px;transform:scale(1.25);">
      <span style="display:flex;flex-direction:column;gap:6px;line-height:1.6;flex:1;">
        <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <strong style="font-size:15px;color:#0f172a;">تفعيل المدة المجانية للحسابات الجديدة</strong>
          <span
            title="${tooltipText}"
            style="width:22px;height:22px;border-radius:999px;background:#e0f2fe;color:#0369a1;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;"
          >؟</span>
        </span>
        <small style="color:#64748b;font-weight:700;">
          مرّر الماوس فوق علامة الاستفهام لمعرفة ماذا يحدث عند التفعيل أو الإيقاف.
        </small>
      </span>
    </label>
  `;

  const findBlock = (input) => {
    if (!input) return null;
    return input.closest(".form-group, .setting-card, .field, label, .toggle-row, .settings-row, div") || input.parentElement;
  };

  // المكان الأساسي: تحت وضع الصيانة مباشرة
  const maintenanceBlock = findBlock(maintenanceInput);
  if (maintenanceBlock && maintenanceBlock.parentElement) {
    maintenanceBlock.insertAdjacentElement("afterend", wrapper);
    return;
  }

  // احتياط: فوق حقل مدة مجانية بالأشهر
  const freeMonthsBlock = findBlock(freeMonthsInput);
  if (freeMonthsBlock && freeMonthsBlock.parentElement) {
    freeMonthsBlock.parentElement.insertBefore(wrapper, freeMonthsBlock);
    return;
  }

  // احتياط أخير: داخل صفحة الإعدادات
  const saveButton =
    settingsSection?.querySelector('button[onclick*="saveAppSettings"]') ||
    settingsSection?.querySelector(".primary-btn") ||
    settingsSection?.querySelector("button");

  if (settingsSection && saveButton && saveButton.parentElement) {
    saveButton.parentElement.insertBefore(wrapper, saveButton);
    return;
  }

  if (settingsSection) {
    settingsSection.prepend(wrapper);
    return;
  }

  setTimeout(ensureFreeTrialEnabledSettingField, 500);
}


function listenSettings() {
  ensureSettingsHelpTooltips();
  ensureFreeTrialEnabledSettingField();
  if (settingsUnsubscribe) return;
  settingsUnsubscribe = onSnapshot(doc(db, "app_config", "settings"), (snapshot) => {
    ensureFreeTrialEnabledSettingField();
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if ($("registrationEnabled")) $("registrationEnabled").checked = data.registrationEnabled !== false;
    if ($("maintenanceMode")) $("maintenanceMode").checked = data.maintenanceMode === true;
    if ($("supportPhone")) $("supportPhone").value = data.adminWhatsAppPhone || data.supportPhone || "";
    ensureSettingsHelpTooltips();
    ensureFreeTrialEnabledSettingField();
    if ($("freeTrialEnabled")) $("freeTrialEnabled").checked = data.freeTrialEnabled === true;
    if ($("freeMonths")) $("freeMonths").value = data.freeMonths ?? 6;
    if ($("adminInternalNote")) $("adminInternalNote").value = data.adminInternalNote || "";
  });
}

function renderAll() {
  renderStats();
  renderHomeLists();
  renderUsers();
  renderDrivers();
  renderOwners();
  renderOrdersStats();
  renderOrdersStatusChips();
  renderOrders();
  renderLoadsStats();
  renderLoadsStatusChips();
  renderLoads();
  renderAvailabilityStats();
  renderAvailability();
  renderTrackingStats();
  renderTracking();
  renderSubscriptions();
  renderAdminNotifications();
}



/* ===== Admin logs core repair ===== */
function currentAdminName() {
  return localStorage.getItem("adminName") || "admin";
}

function adminLogTargetFields(details = {}) {
  const targetUserPhone = details.targetUserPhone || details.userPhone || details.phone || "";
  const targetUserId = details.targetUserId || details.userId || (targetUserPhone ? (details.docId || "") : "");
  const targetUserName = details.targetUserName || details.userName || details.name || "";
  const targetUserRole = details.targetUserRole || details.userRole || details.role || "";

  return {
    targetUserId,
    targetUserPhone,
    targetUserName,
    targetUserRole,
  };
}

async function addAdminLog(action, details = {}) {
  try {
    await addDoc(collection(db, "admin_logs"), {
      action,
      details,
      ...adminLogTargetFields(details),
      adminName: currentAdminName(),
      createdAt: serverTimestamp(),
      userAgent: navigator.userAgent || "",
    });
  } catch (error) {
    console.error("Failed to write admin log:", error);
  }
}

function listenAdminLogs() {
  if (adminLogsUnsubscribe) return;

  try {
    adminLogsUnsubscribe = onSnapshot(
      query(collection(db, "admin_logs"), limit(50)),
      (snapshot) => {
        allAdminLogsCache = snapshot.docs
          .map((d) => ({ docId: d.id, ...d.data() }))
          .sort(byCreatedDesc);

        renderAdminLogsPreview();
        renderStats();
      },
      (error) => {
        console.error("Admin logs listener error:", error);
        showAdminLogsBlockAlways();
      }
    );
  } catch (error) {
    console.error("Admin logs init error:", error);
    showAdminLogsBlockAlways();
  }
}

function actionLabel(action) {
  const labels = {
    login: "تسجيل دخول",
    verify_user: "توثيق مستخدم",
    unverify_user: "إلغاء توثيق",
    block_user: "حظر مستخدم",
    unblock_user: "فك حظر",
    update_order_status: "تغيير حالة طلب",
    delete_order: "حذف طلب",
    update_load_status: "تغيير حالة حمولة",
    delete_load: "حذف حمولة",
    save_app_settings: "حفظ إعدادات",
    save_counters: "حفظ عدادات",
    subscription_update: "تعديل اشتراك",
    subscription_manual_update: "تعديل يدوي للاشتراك",
    subscription_renew: "تجديد اشتراك",
    subscription_trial_grant: "منح مدة مجانية بعد التوثيق",
    subscription_extend: "تمديد اشتراك",
    subscription_open: "اشتراك مفتوح",
    subscription_stop: "إيقاف اشتراك",
    update_user: "تعديل بيانات مستخدم",
    delete_user: "حذف مستخدم",
  };

  return labels[action] || action || "عملية";
}

function actionIcon(action) {
  if (String(action).includes("subscription")) return "💳";
  if (String(action).includes("delete")) return "🗑️";
  if (String(action).includes("block")) return "⛔";
  if (String(action).includes("verify")) return "✅";
  if (String(action).includes("status")) return "🔄";
  if (String(action).includes("settings")) return "⚙️";
  if (String(action).includes("login")) return "🔐";
  return "🧾";
}

function actionColorClass(action) {
  if (String(action).includes("delete")) return "danger";
  if (String(action).includes("block") || action === "subscription_stop") return "danger";
  if (String(action).includes("verify") || String(action).includes("subscription")) return "success";
  if (String(action).includes("status")) return "info";
  return "neutral";
}

function logDetailsText(log) {
  const d = log.details || {};

  if (log.action === "update_order_status") {
    return `${d.orderNumber || d.docId || "طلب"} من "${d.oldStatus || "-"}" إلى "${d.newStatus || "-"}"`;
  }

  if (log.action === "update_load_status") {
    return `${d.loadNumber || d.docId || "حمولة"} من "${loadStatusText(d.oldStatus)}" إلى "${loadStatusText(d.newStatus)}"`;
  }

  if (["verify_user", "unverify_user", "block_user", "unblock_user"].includes(log.action)) {
    return `${d.name || "مستخدم"} - ${d.phone || "-"}`;
  }

  if (["subscription_update", "subscription_manual_update", "subscription_renew", "subscription_trial_grant", "subscription_extend", "subscription_open", "subscription_stop"].includes(log.action)) {
    return `${d.name || d.targetUserName || "مستخدم"} - ${subscriptionStatusLabel(d.status || d.newStatus)} - ينتهي: ${d.endDate || "-"}`;
  }

  if (log.action === "update_user") {
    return `${d.name || d.targetUserName || "مستخدم"} - ${d.phone || d.targetUserPhone || "-"} - ${d.changes || "تعديل بيانات"}`;
  }

  if (log.action === "delete_user") {
    return `${d.name || d.targetUserName || "مستخدم"} - ${d.phone || d.targetUserPhone || "-"}`;
  }

  if (log.action === "delete_order") {
    return `${d.orderNumber || d.docId || "طلب"} - ${d.ownerName || "-"}`;
  }

  if (log.action === "delete_load") {
    return `${d.loadNumber || d.docId || "حمولة"} - ${d.ownerName || "-"}`;
  }

  return Object.entries(d)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" • ") || "-";
}

function ensureAdminLogsBlock() {
  const homeSection = $("homeSection");
  if (!homeSection || $("adminLogsPreviewBlock")) return;

  const block = document.createElement("div");
  block.id = "adminLogsPreviewBlock";
  block.className = "dashboard-section admin-logs-preview";
  block.innerHTML = `
    <div class="section-title-row">
      <div>
        <h2>سجل عمليات الأدمن</h2>
        <p>آخر العمليات المهمة داخل لوحة الإدارة</p>
      </div>
      <div class="logs-head-actions">
        <span class="logs-count-pill" id="adminLogsCount">0 عملية</span>
        <button type="button" class="light-btn" id="openAdminLogsCenterBtn">عرض كل السجل</button>
        <button type="button" class="pdf-btn" id="printAdminLogsBtn">تقرير PDF</button>
      </div>
    </div>
    <div id="adminLogsPreviewList" class="admin-logs-list">
      <div class="empty-box">لا توجد عمليات بعد</div>
    </div>
  `;

  homeSection.appendChild(block);
}

function bindAdminLogsPreviewButtons() {
  const openBtn = $("openAdminLogsCenterBtn");
  const printBtn = $("printAdminLogsBtn");

  if (openBtn && openBtn.dataset.boundLogsCenter !== "true") {
    openBtn.dataset.boundLogsCenter = "true";
    openBtn.addEventListener("click", showAdminLogsCenterModal);
  }

  if (printBtn && printBtn.dataset.boundLogsPdf !== "true") {
    printBtn.dataset.boundLogsPdf = "true";
    printBtn.addEventListener("click", () => openAdminLogsPrintableReport());
  }
}

function showAdminLogsBlockAlways() {
  ensureAdminLogsBlock();
  bindAdminLogsPreviewButtons();

  if ($("adminLogsCount")) {
    $("adminLogsCount").textContent = `${allAdminLogsCache.length} عملية`;
  }
}

function renderAdminLogsPreview() {
  ensureAdminLogsBlock();
  bindAdminLogsPreviewButtons();

  const list = $("adminLogsPreviewList");
  if (!list) return;

  const logs = allAdminLogsCache.slice(0, 10);
  if ($("adminLogsCount")) $("adminLogsCount").textContent = `${allAdminLogsCache.length} عملية`;

  if (!logs.length) {
    list.innerHTML = `<div class="empty-box">لا توجد عمليات بعد</div>`;
    return;
  }

  list.innerHTML = logs.map((log) => `
    <div class="admin-log-item ${actionColorClass(log.action)}">
      <div class="admin-log-icon">${actionIcon(log.action)}</div>
      <div class="admin-log-content">
        <div class="admin-log-title">
          <b>${escapeHtml(actionLabel(log.action))}</b>
          <span>${escapeHtml(formatDateTime(log.createdAt))}</span>
        </div>
        <p>${escapeHtml(logDetailsText(log))}</p>
        <small>بواسطة: ${escapeHtml(log.adminName || "admin")}</small>
      </div>
    </div>
  `).join("");
}


/* ===== Admin Stage 6: full audit log center ===== */
let adminLogsCenterFilters = {
  search: "",
  action: "all",
};

function allLogActionOptions() {
  const base = [
    ["all", "كل العمليات"],
    ["login", "تسجيل دخول"],
    ["verify_user", "توثيق مستخدم"],
    ["unverify_user", "إلغاء توثيق"],
    ["block_user", "حظر مستخدم"],
    ["unblock_user", "فك حظر"],
    ["update_order_status", "تغيير حالة طلب"],
    ["delete_order", "حذف طلب"],
    ["update_load_status", "تغيير حالة حمولة"],
    ["delete_load", "حذف حمولة"],
    ["save_app_settings", "حفظ إعدادات"],
    ["save_counters", "حفظ عدادات"],
    ["subscription_update", "تعديل اشتراك"],
    ["subscription_extend", "تمديد اشتراك"],
    ["subscription_stop", "إيقاف اشتراك"],
  ];

  const existing = new Set(allAdminLogsCache.map((log) => log.action).filter(Boolean));
  existing.forEach((action) => {
    if (!base.some(([value]) => value === action)) {
      base.push([action, actionLabel(action)]);
    }
  });

  return base;
}

function filteredAdminLogs() {
  const keyword = searchText(adminLogsCenterFilters.search || "");
  const action = adminLogsCenterFilters.action || "all";

  return allAdminLogsCache.filter((log) => {
    const actionOk = action === "all" || log.action === action;
    const blob = searchText([
      actionLabel(log.action),
      log.action,
      log.adminName,
      formatDateTime(log.createdAt),
      logDetailsText(log),
      JSON.stringify(log.details || {}),
    ].join(" "));

    return actionOk && (!keyword || blob.includes(keyword));
  });
}

function renderAdminLogsCenterList() {
  const list = $("adminLogsCenterList");
  if (!list) return;

  const logs = filteredAdminLogs();
  if ($("adminLogsCenterCount")) {
    $("adminLogsCenterCount").textContent =
      logs.length === allAdminLogsCache.length ? `${logs.length} عملية` : `${logs.length} من ${allAdminLogsCache.length}`;
  }

  if (!logs.length) {
    list.innerHTML = `<div class="empty-box">لا توجد عمليات مطابقة للبحث أو الفلتر</div>`;
    return;
  }

  list.innerHTML = logs.map((log) => `
    <div class="admin-log-item ${actionColorClass(log.action)}">
      <div class="admin-log-icon">${actionIcon(log.action)}</div>
      <div class="admin-log-content">
        <div class="admin-log-title">
          <b>${escapeHtml(actionLabel(log.action))}</b>
          <span>${escapeHtml(formatDateTime(log.createdAt))}</span>
        </div>
        <p>${escapeHtml(logDetailsText(log))}</p>
        <small>
          بواسطة: ${escapeHtml(log.adminName || "admin")}
          ${log.details?.docId ? ` • Doc: ${escapeHtml(log.details.docId)}` : ""}
        </small>
      </div>
    </div>
  `).join("");
}

function showAdminLogsCenterModal() {
  closeModal();

  const options = allLogActionOptions().map(([value, label]) => `
    <option value="${escapeHtml(value)}" ${adminLogsCenterFilters.action === value ? "selected" : ""}>${escapeHtml(label)}</option>
  `).join("");

  const modal = document.createElement("div");
  modal.id = "adminModal";
  modal.className = "admin-modal-overlay";
  modal.innerHTML = `
    <div class="admin-modal wide-modal details-modal logs-center-modal">
      <div class="admin-modal-header details-modal-header">
        <div>
          <h2>مركز سجل عمليات الأدمن</h2>
          <p>بحث وفلترة وتصدير آخر العمليات الإدارية</p>
        </div>
        <button class="modal-close-btn" data-action="close">×</button>
      </div>

      <div class="admin-modal-body">
        <div class="logs-center-toolbar">
          <div>
            <label>بحث داخل السجل</label>
            <input id="adminLogsSearchInput" type="text" placeholder="ابحث بالاسم، الهاتف، رقم الطلب، نوع العملية..." value="${escapeHtml(adminLogsCenterFilters.search)}" />
          </div>
          <div>
            <label>نوع العملية</label>
            <select id="adminLogsActionFilter">${options}</select>
          </div>
          <div class="logs-center-actions">
            <button type="button" class="light-btn" id="clearAdminLogsFiltersBtn">مسح الفلتر</button>
            <button type="button" class="export-btn" id="exportAdminLogsCsvBtn">CSV</button>
            <button type="button" class="pdf-btn" id="exportAdminLogsPdfBtn">PDF</button>
          </div>
        </div>

        <div class="logs-center-count" id="adminLogsCenterCount">0 عملية</div>
        <div id="adminLogsCenterList" class="admin-logs-list logs-center-list"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('[data-action="close"]').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  $("adminLogsSearchInput")?.addEventListener("input", (e) => {
    adminLogsCenterFilters.search = e.target.value.trim();
    renderAdminLogsCenterList();
  });

  $("adminLogsActionFilter")?.addEventListener("change", (e) => {
    adminLogsCenterFilters.action = e.target.value;
    renderAdminLogsCenterList();
  });

  $("clearAdminLogsFiltersBtn")?.addEventListener("click", () => {
    adminLogsCenterFilters.search = "";
    adminLogsCenterFilters.action = "all";
    if ($("adminLogsSearchInput")) $("adminLogsSearchInput").value = "";
    if ($("adminLogsActionFilter")) $("adminLogsActionFilter").value = "all";
    renderAdminLogsCenterList();
  });

  $("exportAdminLogsCsvBtn")?.addEventListener("click", exportAdminLogsCsv);
  $("exportAdminLogsPdfBtn")?.addEventListener("click", () => openAdminLogsPrintableReport());

  renderAdminLogsCenterList();
}

function exportAdminLogsCsv() {
  const headers = ["التاريخ", "نوع العملية", "التفاصيل", "الأدمن", "Doc ID"];
  const rows = filteredAdminLogs().map((log) => ({
    "التاريخ": formatDateTime(log.createdAt),
    "نوع العملية": actionLabel(log.action),
    "التفاصيل": logDetailsText(log),
    "الأدمن": log.adminName || "admin",
    "Doc ID": log.details?.docId || "",
  }));

  downloadTextFile(`admin-logs-${todayFileDate()}.csv`, buildCsv(headers, rows));
  toast(`تم تصدير ${rows.length} عملية`);
}

function openAdminLogsPrintableReport() {
  const logs = filteredAdminLogs();
  const now = new Date().toLocaleString("ar-SY");
  const actionGroups = allLogActionOptions()
    .filter(([value]) => value !== "all")
    .map(([value, label]) => [label, logs.filter((log) => log.action === value).length])
    .filter(([, count]) => count > 0)
    .slice(0, 6);

  const summaryCards = [
    ["عدد العمليات", logs.length],
    ["توثيق/حسابات", logs.filter((log) => ["verify_user", "unverify_user", "block_user", "unblock_user"].includes(log.action)).length],
    ["الطلبات", logs.filter((log) => String(log.action).includes("order")).length],
    ["الحمولات", logs.filter((log) => String(log.action).includes("load")).length],
    ["إعدادات", logs.filter((log) => String(log.action).includes("settings") || String(log.action).includes("counters")).length],
    ...actionGroups,
  ].slice(0, 10);

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة ثم جرّب مرة ثانية.");
    return;
  }

  const rows = logs.length
    ? logs.map((log, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${htmlEscapeForReport(formatDateTime(log.createdAt))}</td>
        <td>${htmlEscapeForReport(actionLabel(log.action))}</td>
        <td>${htmlEscapeForReport(logDetailsText(log))}</td>
        <td>${htmlEscapeForReport(log.adminName || "admin")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" class="empty-report">لا توجد عمليات حسب الفلتر الحالي</td></tr>`;

  const summaryHtml = summaryCards.map(([label, value]) => `
    <div class="summary-card">
      <span>${htmlEscapeForReport(label)}</span>
      <b>${htmlEscapeForReport(value)}</b>
    </div>
  `).join("");

  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير سجل عمليات الأدمن</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:28px;font-family:Arial,Tahoma,sans-serif;background:#f1f5f9;color:#0f172a;direction:rtl}
    .report-page{max-width:1200px;margin:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 18px 45px rgba(15,23,42,.12)}
    .report-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:3px solid #0b3a67;margin-bottom:18px}
    h1{margin:0 0 8px;color:#0b3a67;font-size:28px}
    p{margin:0;color:#64748b;line-height:1.8;font-size:14px}
    .report-actions{display:flex;gap:10px}
    .report-actions button{border:none;border-radius:12px;padding:12px 16px;font-weight:900;cursor:pointer;color:#fff;background:#0b3a67}
    .report-actions .close-btn{background:#64748b}
    .summary-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:18px 0}
    .summary-card{border:1px solid #e2e8f0;background:#f8fafc;border-radius:16px;padding:14px;min-height:82px}
    .summary-card span{display:block;color:#64748b;font-size:13px;margin-bottom:10px}
    .summary-card b{font-size:24px;color:#0b3a67}
    .table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:16px}
    table{width:100%;border-collapse:collapse;font-size:13px;min-width:900px}
    th{background:#0b3a67;color:#fff;padding:12px 10px;text-align:right;white-space:nowrap}
    td{border-bottom:1px solid #e2e8f0;padding:10px;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc}
    .empty-report{text-align:center;padding:28px;color:#64748b;font-weight:900}
    .footer{margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;display:flex;justify-content:space-between;gap:12px}
    @media(max-width:800px){body{padding:12px}.report-header{flex-direction:column}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.report-actions{width:100%}.report-actions button{flex:1}}
    @media print{body{background:#fff;padding:0}.report-page{box-shadow:none;border-radius:0;max-width:none}.report-actions{display:none}.table-wrap{overflow:visible}table{min-width:0;font-size:11px}th,td{padding:7px}.summary-grid{grid-template-columns:repeat(5,1fr)}@page{size:A4 landscape;margin:10mm}}
  </style>
</head>
<body>
  <div class="report-page">
    <div class="report-header">
      <div>
        <h1>تقرير سجل عمليات الأدمن</h1>
        <p>
          لوحة إدارة تطبيق حمولتي<br>
          تاريخ التقرير: ${htmlEscapeForReport(now)}<br>
          التقرير مبني على فلتر سجل العمليات الحالي.
        </p>
      </div>
      <div class="report-actions">
        <button onclick="window.print()">طباعة / حفظ PDF</button>
        <button class="close-btn" onclick="window.close()">إغلاق</button>
      </div>
    </div>

    <div class="summary-grid">${summaryHtml}</div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>التاريخ</th>
            <th>نوع العملية</th>
            <th>التفاصيل</th>
            <th>الأدمن</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="footer">
      <span>تطبيق حمولتي - سجل عمليات الأدمن</span>
      <span>عدد السجلات: ${logs.length}</span>
    </div>
  </div>
</body>
</html>`);
  reportWindow.document.close();

  setTimeout(() => reportWindow.focus(), 300);
}


function renderStats() {
  showAdminLogsBlockAlways();
  const totalUsers = allUsersCache.length;
  const drivers = allUsersCache.filter((u) => u.role === "driver").length;
  const owners = allUsersCache.filter((u) => u.role === "owner").length;
  const pending = allUsersCache.filter((u) => getUserStatus(u) === "pending").length;
  const blocked = allUsersCache.filter((u) => getUserStatus(u) === "blocked").length;
  const activeOrders = allOrdersCache.filter((o) => isActiveOrder(o.status)).length;
  const waitingOrders = allOrdersCache.filter((o) => String(o.status || "").includes("بانتظار")).length;
  const deliveredOrders = allOrdersCache.filter((o) => o.status === "تم التسليم").length;
  const activeDrivers = allUsersCache.filter((u) => u.role === "driver" && findActiveAvailabilityForDriver(u)).length;
  const activeLoads = allLoadsCache.filter((l) => l.status === "available" || l.status === "reserved").length;
  const availableLoads = allLoadsCache.filter((l) => l.status === "available").length;
  const liveTracking = allTrackingCache.filter((t) => isTrackingLive(t) && hasTrackingLocation(t)).length;
  const activeOrdersWithoutLocation = allOrdersCache.filter((order) => {
    if (!isActiveOrder(order.status)) return false;
    const tracking = getTrackingForOrder(order);
    return !tracking || !hasTrackingLocation(tracking);
  }).length;

  if ($("statsGrid")) {
    $("statsGrid").innerHTML = `
      ${buildStatCard("👥", "كل المستخدمين", totalUsers)}
      ${buildStatCard("🚚", "السائقين", drivers)}
      ${buildStatCard("🟢", "سائقين متاحين", activeDrivers)}
      ${buildStatCard("📦", "أصحاب البضاعة", owners)}
      ${buildStatCard("⏳", "بانتظار التوثيق", pending)}
      ${buildStatCard("📋", "كل الطلبات", allOrdersCache.length)}
      ${buildStatCard("🔥", "طلبات نشطة", activeOrders)}
      ${buildStatCard("⌛", "طلبات بانتظار موافقة", waitingOrders)}
      ${buildStatCard("✅", "طلبات مكتملة", deliveredOrders)}
      ${buildStatCard("📦", "كل الحمولات", allLoadsCache.length)}
      ${buildStatCard("✅", "حمولات نشطة", activeLoads)}
      ${buildStatCard("🟢", "حمولات متاحة", availableLoads)}
      ${buildStatCard("📍", "تتبع مباشر", liveTracking)}
      ${buildStatCard("⚠️", "نشطة بدون موقع", activeOrdersWithoutLocation)}
      ${buildStatCard("⛔", "محظور", blocked)}
      ${buildStatCard("#", "آخر رقم ORD", countersCache.orders?.lastNumber ?? "-")}
      ${buildStatCard("#", "آخر رقم LOAD", countersCache.loads?.lastNumber ?? "-")}
    `;
  }

  if ($("usersStats")) {
    $("usersStats").innerHTML = `
      ${buildMiniStat("كل المستخدمين", totalUsers)}
      ${buildMiniStat("موثقين", allUsersCache.filter((u) => getUserStatus(u) === "verified").length)}
      ${buildMiniStat("بانتظار", pending)}
      ${buildMiniStat("محظور", blocked)}
    `;
  }
}

function renderHomeLists() {
  renderDashboardAlerts();

  if ($("latestOrders")) {
    const latest = [...allOrdersCache].sort(byCreatedDesc).slice(0, 5);
    $("latestOrders").innerHTML = latest.length ? "" : `<div class="empty-box">لا توجد طلبات بعد</div>`;
    latest.forEach((order) => $("latestOrders").appendChild(buildOrderCard(order, false)));
  }

  if ($("latestLoads")) {
    const latest = [...allLoadsCache].sort(byCreatedDesc).slice(0, 5);
    $("latestLoads").innerHTML = latest.length ? "" : `<div class="empty-box">لا توجد حمولات بعد</div>`;
    latest.forEach((load) => $("latestLoads").appendChild(buildLoadCard(load, false)));
  }

  if ($("latestUsers")) {
    const latest = [...allUsersCache].sort(byCreatedDesc).slice(0, 6);
    $("latestUsers").innerHTML = latest.length
      ? latest.map(buildLatestUserCard).join("")
      : `<div class="empty-box">لا يوجد مستخدمين بعد</div>`;
  }
}

function renderDashboardAlerts() {
  const box = $("adminAlerts");
  if (!box) return;

  const pendingUsers = allUsersCache.filter((u) => getUserStatus(u) === "pending").length;
  const blockedUsers = allUsersCache.filter((u) => getUserStatus(u) === "blocked").length;
  const waitingDriverOrders = allOrdersCache.filter((o) => o.status === "بانتظار موافقة السائق").length;
  const waitingOwnerOrders = allOrdersCache.filter((o) => o.status === "بانتظار موافقة صاحب البضاعة").length;
  const activeOrdersWithoutLocation = allOrdersCache.filter((order) => {
    if (!isActiveOrder(order.status)) return false;
    const tracking = getTrackingForOrder(order);
    return !tracking || !hasTrackingLocation(tracking);
  }).length;
  const availableLoads = allLoadsCache.filter((l) => l.status === "available").length;
  const activeAvailability = allAvailabilityCache.filter(isAvailabilityActive).length;

  const alerts = [
    {
      count: pendingUsers,
      icon: "🛂",
      title: "حسابات بانتظار التوثيق",
      description: "راجع بيانات السائقين وأصحاب البضاعة قبل تفعيلهم.",
      section: "users",
      level: "warning",
    },
    {
      count: waitingDriverOrders,
      icon: "⏳",
      title: "طلبات تنتظر موافقة السائق",
      description: "طلبات مرسلة للسائق ولم يتم قبولها بعد.",
      section: "orders",
      level: "warning",
    },
    {
      count: waitingOwnerOrders,
      icon: "⌛",
      title: "طلبات تنتظر موافقة صاحب البضاعة",
      description: "طلبات تحتاج قرار من صاحب البضاعة.",
      section: "orders",
      level: "warning",
    },
    {
      count: activeOrdersWithoutLocation,
      icon: "📍",
      title: "طلبات نشطة بدون موقع",
      description: "طلبات في مرحلة عمل لكن لا يوجد موقع تتبع واضح.",
      section: "tracking",
      level: "danger",
    },
    {
      count: availableLoads,
      icon: "📦",
      title: "حمولات متاحة بلا حجز",
      description: "حمولات منشورة يمكن متابعتها مع السائقين.",
      section: "loads",
      level: "info",
    },
    {
      count: activeAvailability,
      icon: "🟢",
      title: "سائقين متاحين الآن",
      description: "عدد السائقين الذين أعلنوا توفرهم حالياً.",
      section: "availability",
      level: "success",
    },
    {
      count: blockedUsers,
      icon: "⛔",
      title: "حسابات محظورة",
      description: "راجعها فقط إذا كان في اعتراض أو خطأ بالحظر.",
      section: "users",
      level: "neutral",
    },
  ].filter((item) => item.count > 0);

  if (!alerts.length) {
    box.innerHTML = `
      <div class="admin-alert-card success">
        <div class="alert-icon">✅</div>
        <div class="alert-content">
          <h3>لا توجد تنبيهات مهمة حالياً</h3>
          <p>كل المؤشرات الأساسية هادئة حسب البيانات الحالية.</p>
        </div>
      </div>
    `;
    return;
  }

  box.innerHTML = alerts.map(buildDashboardAlertCard).join("");
  updateAdminNotificationsBadge();
}

function buildDashboardAlertCard(alert) {
  return `
    <div class="admin-alert-card ${escapeHtml(alert.level)}">
      <div class="alert-icon">${escapeHtml(alert.icon)}</div>
      <div class="alert-content">
        <h3>${escapeHtml(alert.title)}</h3>
        <p>${escapeHtml(alert.description)}</p>
      </div>
      <div class="alert-side">
        <div class="alert-count">${escapeHtml(alert.count)}</div>
        <button class="ghost-btn" onclick="showSection('${escapeHtml(alert.section)}')">فتح</button>
      </div>
    </div>
  `;
}

function buildLatestUserCard(user) {
  const status = getUserStatus(user);
  const statusText = getUserStatusText(user);

  return `
    <div class="data-card latest-user-card">
      <div class="card-top">
        <div class="avatar">${escapeHtml(getRoleIcon(user.role))}</div>
        <div class="card-title">
          <h3>${escapeHtml(user.name || "بدون اسم")}</h3>
          <p>${escapeHtml(getRoleText(user.role))} • ${escapeHtml(user.phone || user.email || "-")}</p>
          <p>تاريخ التسجيل: ${escapeHtml(formatDateTime(user.createdAt))}</p>
        </div>
        <span class="badge ${escapeHtml(status)}">${escapeHtml(statusText)}</span>
      </div>
    </div>
  `;
}


/* ===== Admin Stage 3: export + clear filters tools ===== */
function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadTextFile(filename, content, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildCsv(headers, rows) {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
}

function todayFileDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function filteredUsersForExport() {
  const text = usersSearchText.toLowerCase();
  return allUsersCache.filter((u) => {
    const status = getUserStatus(u);
    const searchBlob = `${u.name || ""} ${u.phone || ""} ${u.email || ""} ${u.uid || ""} ${u.docId || ""}`.toLowerCase();
    return (usersSearchText === "" || searchBlob.includes(text)) &&
      (usersRoleFilter === "all" || u.role === usersRoleFilter) &&
      (usersStatusFilter === "all" || status === usersStatusFilter);
  });
}

function filteredDriversForExport() {
  const drivers = allUsersCache.filter((u) => u.role === "driver");
  const text = driversSearchText.toLowerCase();

  return drivers.filter((u) => {
    const availability = findActiveAvailabilityForDriver(u);
    const isAvailable = Boolean(availability);
    const blob = `${u.name || ""} ${u.phone || ""} ${u.email || ""} ${availability?.truckType || ""} ${availabilityFrom(availability || {})} ${availabilityTo(availability || {})}`.toLowerCase();
    return (driversSearchText === "" || blob.includes(text)) &&
      (driversAvailabilityFilter === "all" || (driversAvailabilityFilter === "available" && isAvailable) || (driversAvailabilityFilter === "unavailable" && !isAvailable));
  });
}

function filteredOwnersForExport() {
  const owners = allUsersCache.filter((u) => u.role === "owner");
  const text = ownersSearchText.toLowerCase();

  return owners.filter((owner) => {
    const orders = getUserOrders(owner);
    const loads = getOwnerLoads(owner);
    const blob = `${owner.name || ""} ${owner.phone || ""} ${owner.email || ""}`.toLowerCase();
    const matchesSearch = ownersSearchText === "" || blob.includes(text);

    let matchesFilter = true;
    if (ownersFilter === "active_orders") matchesFilter = orders.some((o) => isActiveOrder(o.status));
    if (ownersFilter === "published_loads") matchesFilter = loads.length > 0;
    if (ownersFilter === "no_orders") matchesFilter = orders.length === 0;
    if (ownersFilter === "verified") matchesFilter = getUserStatus(owner) === "verified";
    if (ownersFilter === "pending") matchesFilter = getUserStatus(owner) === "pending";
    if (ownersFilter === "blocked") matchesFilter = getUserStatus(owner) === "blocked";

    return matchesSearch && matchesFilter;
  });
}

function filteredOrdersForExport() {
  const text = ordersSearchText.toLowerCase();

  return allOrdersCache.filter((o) => {
    const blob = `${orderNumberText(o)} ${o.title || ""} ${o.ownerName || ""} ${o.ownerPhone || ""} ${o.driverName || ""} ${o.driverPhone || ""} ${o.fromCity || ""} ${o.toCity || ""} ${o.fromGovernorate || ""} ${o.toGovernorate || ""} ${o.loadId || ""}`.toLowerCase();
    return (ordersSearchText === "" || blob.includes(text)) &&
      (ordersStatusFilter === "all" || o.status === ordersStatusFilter) &&
      (ordersTypeFilter === "all" || o.requestType === ordersTypeFilter);
  }).sort(byCreatedDesc);
}

function filteredLoadsForExport() {
  const text = loadsSearchText.toLowerCase();

  return allLoadsCache.filter((l) => {
    const blob = `${loadNumberText(l)} ${l.loadType || ""} ${l.ownerName || ""} ${l.ownerPhone || ""} ${l.selectedDriverName || ""} ${l.selectedDriverPhone || ""} ${l.fromCity || ""} ${l.toCity || ""} ${l.fromGovernorate || ""} ${l.toGovernorate || ""} ${l.requiredTruckType || ""}`.toLowerCase();
    return (loadsSearchText === "" || blob.includes(text)) && (loadsStatusFilter === "all" || l.status === loadsStatusFilter);
  }).sort(byCreatedDesc);
}

function ensureStage3Toolbar(type, listId, title) {
  const list = $(listId);
  if (!list || $(`stage3Toolbar_${type}`)) return;

  const toolbar = document.createElement("div");
  toolbar.id = `stage3Toolbar_${type}`;
  toolbar.className = "stage3-toolbar";
  toolbar.innerHTML = `
    <div>
      <h3>${escapeHtml(title)}</h3>
      <p id="stage3Count_${type}">جاهز</p>
    </div>
    <div class="stage3-toolbar-actions">
      <button type="button" class="light-btn" data-stage3-clear="${type}">مسح الفلاتر</button>
      <button type="button" class="pdf-btn" data-stage4-pdf="${type}">تقرير PDF</button>
      <button type="button" class="export-btn" data-stage3-export="${type}">تصدير CSV</button>
    </div>
  `;

  list.parentNode.insertBefore(toolbar, list);

  toolbar.querySelector(`[data-stage3-clear="${type}"]`)?.addEventListener("click", () => clearStage3Filters(type));
  toolbar.querySelector(`[data-stage4-pdf="${type}"]`)?.addEventListener("click", () => openPrintableReport(type));
  toolbar.querySelector(`[data-stage3-export="${type}"]`)?.addEventListener("click", () => exportStage3Csv(type));
}

function updateStage3Count(type, current, total) {
  const el = $(`stage3Count_${type}`);
  if (!el) return;

  el.textContent = current === total
    ? `المعروض: ${total}`
    : `المعروض: ${current} من أصل ${total}`;
}

function clearStage3Filters(type) {
  if (type === "users") {
    usersSearchText = "";
    usersRoleFilter = "all";
    usersStatusFilter = "all";
    if ($("usersSearchInput")) $("usersSearchInput").value = "";
    if ($("usersRoleFilter")) $("usersRoleFilter").value = "all";
    if ($("usersStatusFilter")) $("usersStatusFilter").value = "all";
    renderUsers();
  }

  if (type === "drivers") {
    driversSearchText = "";
    driversAvailabilityFilter = "all";
    if ($("driversSearchInput")) $("driversSearchInput").value = "";
    if ($("driversAvailabilityFilter")) $("driversAvailabilityFilter").value = "all";
    renderDrivers();
  }

  if (type === "owners") {
    ownersSearchText = "";
    ownersFilter = "all";
    if ($("ownersSearchInput")) $("ownersSearchInput").value = "";
    if ($("ownersFilter")) $("ownersFilter").value = "all";
    renderOwners();
  }

  if (type === "orders") {
    ordersSearchText = "";
    ordersStatusFilter = "all";
    ordersTypeFilter = "all";
    if ($("ordersSearchInput")) $("ordersSearchInput").value = "";
    if ($("ordersStatusFilter")) $("ordersStatusFilter").value = "all";
    if ($("ordersTypeFilter")) $("ordersTypeFilter").value = "all";
    renderOrdersStatusChips();
    renderOrders();
  }

  if (type === "loads") {
    loadsSearchText = "";
    loadsStatusFilter = "all";
    if ($("loadsSearchInput")) $("loadsSearchInput").value = "";
    if ($("loadsStatusFilter")) $("loadsStatusFilter").value = "all";
    renderLoadsStatusChips();
    renderLoads();
  }

  toast("تم مسح الفلاتر");
}


/* ===== Admin Stage 4: printable PDF reports ===== */
function reportTitleForType(type) {
  const titles = {
    users: "تقرير المستخدمين",
    drivers: "تقرير السائقين",
    owners: "تقرير أصحاب البضاعة",
    orders: "تقرير الطلبات",
    loads: "تقرير الحمولات",
  };
  return titles[type] || "تقرير لوحة الإدارة";
}

function reportRowsForType(type) {
  if (type === "users") {
    return {
      headers: ["الاسم", "الدور", "الهاتف", "الحالة", "الاشتراك", "نهاية الاشتراك", "الأيام المتبقية", "تاريخ التسجيل"],
      rows: filteredUsersForExport().map((u) => [
        u.name || "-",
        getRoleText(u.role),
        u.phone || "-",
        getUserStatusText(u),
        subscriptionBadgeText(u),
        formatDateTimeDisplay(u.subscriptionEndDate),
        subscriptionRemainingDays(u),
        formatDateTime(u.createdAt),
      ]),
    };
  }

  if (type === "drivers") {
    return {
      headers: ["الاسم", "الهاتف", "الحالة", "متاح", "نوع الشاحنة", "من", "إلى"],
      rows: filteredDriversForExport().map((u) => {
        const availability = findActiveAvailabilityForDriver(u);
        return [
          u.name || "-",
          u.phone || "-",
          getUserStatusText(u),
          availability ? "نعم" : "لا",
          availability?.truckType || "-",
          availabilityFrom(availability || {}),
          availabilityTo(availability || {}),
        ];
      }),
    };
  }

  if (type === "owners") {
    return {
      headers: ["الاسم", "الهاتف", "الحالة", "طلبات نشطة", "حمولات منشورة"],
      rows: filteredOwnersForExport().map((u) => [
        u.name || "-",
        u.phone || "-",
        getUserStatusText(u),
        getUserOrders(u).filter((o) => isActiveOrder(o.status)).length,
        getOwnerLoads(u).length,
      ]),
    };
  }

  if (type === "orders") {
    return {
      headers: ["رقم الطلب", "الحالة", "صاحب البضاعة", "السائق", "من", "إلى", "السعر", "التاريخ"],
      rows: filteredOrdersForExport().map((o) => [
        orderNumberText(o),
        o.status || "-",
        o.ownerName || "-",
        o.driverName || "-",
        `${o.fromGovernorate || "-"} / ${o.fromCity || "-"}`,
        `${o.toGovernorate || "-"} / ${o.toCity || "-"}`,
        o.price || "-",
        formatDateTime(o.createdAt),
      ]),
    };
  }

  if (type === "loads") {
    return {
      headers: ["رقم الحمولة", "الحالة", "النوع", "صاحب البضاعة", "من", "إلى", "الشاحنة", "السعر", "التاريخ"],
      rows: filteredLoadsForExport().map((l) => [
        loadNumberText(l),
        loadStatusText(l.status),
        l.loadType || "-",
        l.ownerName || "-",
        `${l.fromGovernorate || "-"} / ${l.fromCity || "-"}`,
        `${l.toGovernorate || "-"} / ${l.toCity || "-"}`,
        l.requiredTruckType || "-",
        l.price || "-",
        formatDateTime(l.createdAt),
      ]),
    };
  }

  return { headers: [], rows: [] };
}

function buildReportSummary(type, rowsCount) {
  if (type === "users") {
    const data = filteredUsersForExport();
    return [
      ["عدد المستخدمين", rowsCount],
      ["سائقين", data.filter((u) => u.role === "driver").length],
      ["أصحاب بضاعة", data.filter((u) => u.role === "owner").length],
      ["بانتظار التوثيق", data.filter((u) => getUserStatus(u) === "pending").length],
      ["محظورين", data.filter((u) => getUserStatus(u) === "blocked").length],
    ];
  }

  if (type === "drivers") {
    const data = filteredDriversForExport();
    return [
      ["عدد السائقين", rowsCount],
      ["متاح الآن", data.filter((u) => findActiveAvailabilityForDriver(u)).length],
      ["غير متاح", data.filter((u) => !findActiveAvailabilityForDriver(u)).length],
      ["بانتظار التوثيق", data.filter((u) => getUserStatus(u) === "pending").length],
      ["محظورين", data.filter((u) => getUserStatus(u) === "blocked").length],
    ];
  }

  if (type === "owners") {
    const data = filteredOwnersForExport();
    return [
      ["عدد أصحاب البضاعة", rowsCount],
      ["لديهم طلبات نشطة", data.filter((u) => getUserOrders(u).some((o) => isActiveOrder(o.status))).length],
      ["لديهم حمولات", data.filter((u) => getOwnerLoads(u).length > 0).length],
      ["بانتظار التوثيق", data.filter((u) => getUserStatus(u) === "pending").length],
      ["محظورين", data.filter((u) => getUserStatus(u) === "blocked").length],
    ];
  }

  if (type === "orders") {
    const data = filteredOrdersForExport();
    return [
      ["عدد الطلبات", rowsCount],
      ["بانتظار", data.filter((o) => String(o.status || "").includes("بانتظار")).length],
      ["في الطريق", data.filter((o) => o.status === "في الطريق").length],
      ["تم التسليم", data.filter((o) => o.status === "تم التسليم").length],
      ["ملغي", data.filter((o) => isCancelledOrder(o.status)).length],
    ];
  }

  if (type === "loads") {
    const data = filteredLoadsForExport();
    return [
      ["عدد الحمولات", rowsCount],
      ["متاحة", data.filter((l) => l.status === "available").length],
      ["محجوزة", data.filter((l) => l.status === "reserved").length],
      ["تم التسليم", data.filter((l) => l.status === "delivered").length],
      ["ملغاة", data.filter((l) => l.status === "cancelled").length],
    ];
  }

  return [["عدد العناصر", rowsCount]];
}

function htmlEscapeForReport(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openPrintableReport(type) {
  const title = reportTitleForType(type);
  const { headers, rows } = reportRowsForType(type);
  const summary = buildReportSummary(type, rows.length);
  const now = new Date().toLocaleString("ar-SY");

  if (!headers.length) {
    toast("لا يوجد تقرير لهذا القسم", "error");
    return;
  }

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة ثم جرّب مرة ثانية.");
    return;
  }

  const tableHead = headers.map((h) => `<th>${htmlEscapeForReport(h)}</th>`).join("");
  const tableRows = rows.length
    ? rows.map((row, index) => `
      <tr>
        <td class="row-number">${index + 1}</td>
        ${row.map((cell) => `<td>${htmlEscapeForReport(cell)}</td>`).join("")}
      </tr>
    `).join("")
    : `<tr><td colspan="${headers.length + 1}" class="empty-report">لا توجد بيانات حسب الفلتر الحالي</td></tr>`;

  const summaryCards = summary.map(([label, value]) => `
    <div class="summary-card">
      <span>${htmlEscapeForReport(label)}</span>
      <b>${htmlEscapeForReport(value)}</b>
    </div>
  `).join("");

  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${htmlEscapeForReport(title)}</title>
  <style>
    *{box-sizing:border-box}
    body{
      margin:0;
      padding:28px;
      font-family:Arial, Tahoma, sans-serif;
      background:#f1f5f9;
      color:#0f172a;
      direction:rtl;
    }
    .report-page{
      max-width:1200px;
      margin:auto;
      background:#fff;
      border-radius:18px;
      padding:24px;
      box-shadow:0 18px 45px rgba(15,23,42,.12);
    }
    .report-header{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      padding-bottom:18px;
      border-bottom:3px solid #0b3a67;
      margin-bottom:18px;
    }
    .brand h1{
      margin:0 0 8px;
      color:#0b3a67;
      font-size:28px;
    }
    .brand p{
      margin:0;
      color:#64748b;
      line-height:1.8;
      font-size:14px;
    }
    .report-actions{
      display:flex;
      gap:10px;
    }
    .report-actions button{
      border:none;
      border-radius:12px;
      padding:12px 16px;
      font-weight:900;
      cursor:pointer;
      color:#fff;
      background:#0b3a67;
    }
    .report-actions .close-btn{
      background:#64748b;
    }
    .summary-grid{
      display:grid;
      grid-template-columns:repeat(5,minmax(0,1fr));
      gap:12px;
      margin:18px 0;
    }
    .summary-card{
      border:1px solid #e2e8f0;
      background:#f8fafc;
      border-radius:16px;
      padding:14px;
      min-height:82px;
    }
    .summary-card span{
      display:block;
      color:#64748b;
      font-size:13px;
      margin-bottom:10px;
    }
    .summary-card b{
      font-size:24px;
      color:#0b3a67;
    }
    .table-wrap{
      overflow:auto;
      border:1px solid #e2e8f0;
      border-radius:16px;
    }
    table{
      width:100%;
      border-collapse:collapse;
      font-size:13px;
      min-width:900px;
    }
    th{
      background:#0b3a67;
      color:#fff;
      padding:12px 10px;
      text-align:right;
      white-space:nowrap;
    }
    td{
      border-bottom:1px solid #e2e8f0;
      padding:10px;
      vertical-align:top;
    }
    tr:nth-child(even) td{
      background:#f8fafc;
    }
    .row-number{
      width:44px;
      text-align:center;
      color:#64748b;
      font-weight:900;
    }
    .empty-report{
      text-align:center;
      padding:28px;
      color:#64748b;
      font-weight:900;
    }
    .footer{
      margin-top:16px;
      padding-top:12px;
      border-top:1px solid #e2e8f0;
      color:#64748b;
      font-size:12px;
      display:flex;
      justify-content:space-between;
      gap:12px;
    }
    @media(max-width:800px){
      body{padding:12px}
      .report-header{flex-direction:column}
      .summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .report-actions{width:100%}
      .report-actions button{flex:1}
    }
    @media print{
      body{background:#fff;padding:0}
      .report-page{box-shadow:none;border-radius:0;max-width:none}
      .report-actions{display:none}
      .table-wrap{overflow:visible}
      table{min-width:0;font-size:11px}
      th,td{padding:7px}
      .summary-grid{grid-template-columns:repeat(5,1fr)}
      @page{size:A4 landscape;margin:10mm}
    }
  </style>
</head>
<body>
  <div class="report-page">
    <div class="report-header">
      <div class="brand">
        <h1>${htmlEscapeForReport(title)}</h1>
        <p>
          لوحة إدارة تطبيق حمولتي<br>
          تاريخ التقرير: ${htmlEscapeForReport(now)}<br>
          التقرير مبني على الفلاتر الحالية داخل لوحة الإدارة.
        </p>
      </div>
      <div class="report-actions">
        <button onclick="window.print()">طباعة / حفظ PDF</button>
        <button class="close-btn" onclick="window.close()">إغلاق</button>
      </div>
    </div>

    <div class="summary-grid">
      ${summaryCards}
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            ${tableHead}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <span>تطبيق حمولتي - تقرير إداري</span>
      <span>عدد السجلات: ${rows.length}</span>
    </div>
  </div>
</body>
</html>`);
  reportWindow.document.close();

  setTimeout(() => {
    reportWindow.focus();
  }, 300);
}


function exportStage3Csv(type) {
  let headers = [];
  let rows = [];
  let filename = "";

  if (type === "users") {
    headers = ["الاسم", "الدور", "الهاتف", "الإيميل", "الحالة", "الاشتراك", "نهاية الاشتراك", "الأيام المتبقية", "تاريخ التسجيل", "UID"];
    rows = filteredUsersForExport().map((u) => ({
      "الاسم": u.name || "",
      "الدور": getRoleText(u.role),
      "الهاتف": u.phone || "",
      "الإيميل": u.email || "",
      "الحالة": getUserStatusText(u),
      "الاشتراك": subscriptionBadgeText(u),
      "نهاية الاشتراك": formatDateTimeDisplay(u.subscriptionEndDate),
      "الأيام المتبقية": subscriptionRemainingDays(u),
      "تاريخ التسجيل": formatDateTime(u.createdAt),
      "UID": u.uid || u.docId || "",
    }));
    filename = `admin-users-${todayFileDate()}.csv`;
  }

  if (type === "drivers") {
    headers = ["الاسم", "الهاتف", "الإيميل", "الحالة", "متاح الآن", "نوع الشاحنة", "من", "إلى"];
    rows = filteredDriversForExport().map((u) => {
      const availability = findActiveAvailabilityForDriver(u);
      return {
        "الاسم": u.name || "",
        "الهاتف": u.phone || "",
        "الإيميل": u.email || "",
        "الحالة": getUserStatusText(u),
        "متاح الآن": availability ? "نعم" : "لا",
        "نوع الشاحنة": availability?.truckType || "",
        "من": availabilityFrom(availability || {}),
        "إلى": availabilityTo(availability || {}),
      };
    });
    filename = `admin-drivers-${todayFileDate()}.csv`;
  }

  if (type === "owners") {
    headers = ["الاسم", "الهاتف", "الإيميل", "الحالة", "طلبات نشطة", "حمولات منشورة"];
    rows = filteredOwnersForExport().map((u) => ({
      "الاسم": u.name || "",
      "الهاتف": u.phone || "",
      "الإيميل": u.email || "",
      "الحالة": getUserStatusText(u),
      "طلبات نشطة": getUserOrders(u).filter((o) => isActiveOrder(o.status)).length,
      "حمولات منشورة": getOwnerLoads(u).length,
    }));
    filename = `admin-owners-${todayFileDate()}.csv`;
  }

  if (type === "orders") {
    headers = ["رقم الطلب", "الحالة", "صاحب البضاعة", "هاتف صاحب البضاعة", "السائق", "هاتف السائق", "من", "إلى", "السعر", "تاريخ الإنشاء"];
    rows = filteredOrdersForExport().map((o) => ({
      "رقم الطلب": orderNumberText(o),
      "الحالة": o.status || "",
      "صاحب البضاعة": o.ownerName || "",
      "هاتف صاحب البضاعة": o.ownerPhone || "",
      "السائق": o.driverName || "",
      "هاتف السائق": o.driverPhone || "",
      "من": `${o.fromGovernorate || ""} / ${o.fromCity || ""}`,
      "إلى": `${o.toGovernorate || ""} / ${o.toCity || ""}`,
      "السعر": o.price || "",
      "تاريخ الإنشاء": formatDateTime(o.createdAt),
    }));
    filename = `admin-orders-${todayFileDate()}.csv`;
  }

  if (type === "loads") {
    headers = ["رقم الحمولة", "الحالة", "النوع", "صاحب البضاعة", "الهاتف", "من", "إلى", "نوع الشاحنة", "الوزن", "السعر", "تاريخ النشر"];
    rows = filteredLoadsForExport().map((l) => ({
      "رقم الحمولة": loadNumberText(l),
      "الحالة": loadStatusText(l.status),
      "النوع": l.loadType || "",
      "صاحب البضاعة": l.ownerName || "",
      "الهاتف": l.ownerPhone || "",
      "من": `${l.fromGovernorate || ""} / ${l.fromCity || ""}`,
      "إلى": `${l.toGovernorate || ""} / ${l.toCity || ""}`,
      "نوع الشاحنة": l.requiredTruckType || "",
      "الوزن": l.weight || "",
      "السعر": l.price || "",
      "تاريخ النشر": formatDateTime(l.createdAt),
    }));
    filename = `admin-loads-${todayFileDate()}.csv`;
  }

  if (!headers.length) return;

  downloadTextFile(filename, buildCsv(headers, rows));
  toast(`تم تصدير ${rows.length} عنصر`);
}


function renderUsers() {
  const container = $("usersList");
  if (!container) return;
  ensureStage3Toolbar("users", "usersList", "أدوات المستخدمين");
  const text = usersSearchText.toLowerCase();
  const users = allUsersCache.filter((u) => {
    const status = getUserStatus(u);
    const searchBlob = `${u.name || ""} ${u.phone || ""} ${u.email || ""} ${u.uid || ""} ${u.docId || ""}`.toLowerCase();
    return (usersSearchText === "" || searchBlob.includes(text)) &&
      (usersRoleFilter === "all" || u.role === usersRoleFilter) &&
      (usersStatusFilter === "all" || status === usersStatusFilter);
  });
  updateStage3Count("users", users.length, allUsersCache.length);
  container.innerHTML = users.length ? "" : `<div class="empty-box">لا يوجد مستخدمين مطابقين</div>`;
  users.forEach((user) => container.appendChild(buildUserCard(user)));
}


/* ===== Admin Stage 7: subscriptions ===== */
const subscriptionStatusOptions = [
  ["free", "مجاني"],
  ["trial", "تجريبي"],
  ["active", "مشترك"],
  ["expired", "منتهي"],
  ["suspended", "موقوف"],
];

function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value.seconds) return new Date(value.seconds * 1000);
  return null;
}

function formatDateOnly(value) {
  const date = toJsDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("ar-SY");
}

function formatDateTimeDisplay(value) {
  const date = toJsDate(value);
  if (!date) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = date.getHours() >= 12 ? "م" : "ص";
  const hour12 = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;

  return `${year}/${month}/${day} - ${hour12}:${minutes} ${period}`;
}



function formatInputDate(value) {
  const date = toJsDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatInputTime(value) {
  const date = toJsDate(value);
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function dateTimeFromInputs(dateValue, timeValue) {
  if (!dateValue) return null;
  const cleanTime = timeValue || "00:00";
  const date = new Date(`${dateValue}T${cleanTime}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateFromInput(value) {
  return dateTimeFromInputs(value, "00:00");
}

function addMonthsToDate(value, months) {
  const base = toJsDate(value) || new Date();
  const result = new Date(base);
  const day = result.getDate();

  result.setMonth(result.getMonth() + Number(months || 0));

  // حماية من مشكلة نهاية الشهر، مثل 31 + شهر
  if (result.getDate() < day) {
    result.setDate(0);
  }

  return result;
}

function addDaysToDate(value, days) {
  const base = toJsDate(value) || new Date();
  const result = new Date(base);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

function subscriptionStatusLabel(status) {
  const found = subscriptionStatusOptions.find(([value]) => value === status);
  return found ? found[1] : "غير محدد";
}

function subscriptionStatusClass(user) {
  const status = user.subscriptionStatus || "free";
  const end = toJsDate(user.subscriptionEndDate);

  if (status === "suspended") return "suspended";
  if (status === "free") return "free";
  if (end && end < new Date() && status !== "free") return "expired";
  if (status === "trial") return "trial";
  if (status === "active") return "active";
  if (status === "expired") return "expired";
  return "unknown";
}

function isUserSubscriptionActive(user) {
  const status = user.subscriptionStatus || "free";
  const end = toJsDate(user.subscriptionEndDate);

  if (status === "suspended" || status === "expired") return false;
  if (status === "free") return true;
  if (!end) return status === "active" || status === "trial";
  return end >= new Date();
}

function subscriptionRemainingDays(user) {
  const status = user.subscriptionStatus || "free";
  if (status === "free") return "مفتوح";

  const end = toJsDate(user.subscriptionEndDate);
  if (!end) return "-";

  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `منتهي منذ ${Math.abs(diff)} يوم`;
  if (diff === 0) return "ينتهي اليوم";
  return `${diff} يوم`;
}

function subscriptionBadgeText(user) {
  const status = subscriptionStatusClass(user);
  if (status === "expired") return "منتهي";
  return subscriptionStatusLabel(user.subscriptionStatus || "free");
}

function subscriptionSummaryText(user) {
  const status = subscriptionBadgeText(user);
  const remaining = subscriptionRemainingDays(user);
  const end = formatDateTimeDisplay(user.subscriptionEndDate);
  return `${status} • ${remaining}${end !== "-" ? ` • حتى ${end}` : ""}`;
}

function subscriptionOptionsHtml(current) {
  return subscriptionStatusOptions.map(([value, label]) =>
    `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`
  ).join("");
}

function currentSubscriptionBaseDate(user) {
  const end = toJsDate(user.subscriptionEndDate);
  if (end && end > new Date()) return end;
  return new Date();
}

async function writeSubscriptionHistory(docId, user, payload, actionType) {
  try {
    await addDoc(collection(db, "subscriptions"), {
      userId: docId,
      userName: user.name || payload.userName || "",
      userPhone: user.phone || payload.userPhone || "",
      role: user.role || payload.role || "",
      ...payload,
      actionType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      adminName: currentAdminName(),
    });
  } catch (error) {
    console.error("Failed to write subscription history:", error);
  }
}

async function updateUserSubscription(docId, user, payload, action = "subscription_update") {
  const endDate = payload.subscriptionEndDate || null;
  const status = payload.subscriptionStatus || "free";
  const active = status === "free" || ((status === "trial" || status === "active") && (!endDate || endDate >= new Date()));

  const updatePayload = {
    subscriptionStatus: status,
    subscriptionPlanName: payload.subscriptionPlanName || "",
    subscriptionStartDate: payload.subscriptionStartDate || null,
    subscriptionEndDate: endDate,
    subscriptionAmount: Number(payload.subscriptionAmount || 0),
    subscriptionCurrency: payload.subscriptionCurrency || "TRY",
    subscriptionPaymentMethod: payload.subscriptionPaymentMethod || "",
    subscriptionNote: payload.subscriptionNote || "",
    isSubscriptionActive: active,
    subscriptionUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", docId), updatePayload, { merge: true });
  await writeSubscriptionHistory(docId, user, updatePayload, action);
  await addAdminLog(action, {
    docId,
    targetUserId: docId,
    targetUserName: user.name || "",
    targetUserPhone: user.phone || "",
    targetUserRole: user.role || "",
    name: user.name || "",
    phone: user.phone || "",
    role: user.role || "",
    oldStatus: user.subscriptionStatus || "",
    oldStartDate: formatDateTimeDisplay(user.subscriptionStartDate),
    oldEndDate: formatDateTimeDisplay(user.subscriptionEndDate),
    status,
    newStatus: status,
    startDate: formatDateTimeDisplay(updatePayload.subscriptionStartDate),
    endDate: formatDateTimeDisplay(endDate),
    plan: updatePayload.subscriptionPlanName,
    amount: updatePayload.subscriptionAmount,
    currency: updatePayload.subscriptionCurrency,
    paymentMethod: updatePayload.subscriptionPaymentMethod,
  });
}

async function saveSubscriptionFromModal(docId, user) {
  const status = $("subscriptionStatusInput")?.value || "free";
  const startDate = dateTimeFromInputs(
    $("subscriptionStartInput")?.value || "",
    $("subscriptionStartTimeInput")?.value || ""
  );
  const endDate = dateTimeFromInputs(
    $("subscriptionEndInput")?.value || "",
    $("subscriptionEndTimeInput")?.value || ""
  );
  const planName = $("subscriptionPlanInput")?.value?.trim() || "";
  const amount = Number($("subscriptionAmountInput")?.value || 0);
  const currency = $("subscriptionCurrencyInput")?.value?.trim() || "TRY";
  const paymentMethod = $("subscriptionPaymentMethodInput")?.value?.trim() || "";
  const note = $("subscriptionNoteInput")?.value?.trim() || "";

  if ((status === "trial" || status === "active") && !endDate) {
    alert("لازم تحدد تاريخ ووقت نهاية الاشتراك");
    return;
  }

  if (startDate && endDate && endDate <= startDate) {
    alert("تاريخ ووقت النهاية لازم يكون بعد البداية");
    return;
  }

  if (!confirm("حفظ بيانات الاشتراك اليدوي لهذا المستخدم؟")) return;

  await updateUserSubscription(docId, user, {
    subscriptionStatus: status,
    subscriptionPlanName: planName,
    subscriptionStartDate: startDate,
    subscriptionEndDate: endDate,
    subscriptionAmount: amount,
    subscriptionCurrency: currency,
    subscriptionPaymentMethod: paymentMethod,
    subscriptionNote: note,
  }, "subscription_manual_update");

  closeModal();
  toast("تم حفظ الاشتراك اليدوي");
}

function subscriptionPayloadDefaults(user, status, planName, extra = {}) {
  return {
    subscriptionStatus: status,
    subscriptionPlanName: planName || user.subscriptionPlanName || (status === "trial" ? "تجريبي" : "اشتراك"),
    subscriptionAmount: Number(user.subscriptionAmount || 0),
    subscriptionCurrency: user.subscriptionCurrency || "TRY",
    subscriptionPaymentMethod: user.subscriptionPaymentMethod || "manual",
    subscriptionNote: user.subscriptionNote || "",
    ...extra,
  };
}

async function renewSubscription(docId, user, months, status = "active", planName = "") {
  const startDate = new Date();
  const endDate = addMonthsToDate(startDate, months);

  if (!confirm(`تجديد الاشتراك ${months} شهر من اليوم؟\n\nملاحظة: التجديد يستبدل التاريخ القديم ولا يضيف فوقه.`)) return;

  await updateUserSubscription(docId, user, subscriptionPayloadDefaults(user, status, planName, {
    subscriptionStartDate: startDate,
    subscriptionEndDate: endDate,
  }), "subscription_renew");

  closeModal();
  toast("تم تجديد الاشتراك من اليوم");
}

async function extendSubscription(docId, user, months, status = "active", planName = "") {
  const base = currentSubscriptionBaseDate(user);
  const endDate = addMonthsToDate(base, months);
  const startDate = toJsDate(user.subscriptionStartDate) || new Date();

  if (!confirm(`تمديد الاشتراك ${months} شهر؟\n\nملاحظة: التمديد يضيف فوق تاريخ النهاية الحالي.`)) return;

  await updateUserSubscription(docId, user, subscriptionPayloadDefaults(user, status, planName, {
    subscriptionStartDate: startDate,
    subscriptionEndDate: endDate,
  }), "subscription_extend");

  closeModal();
  toast("تم تمديد الاشتراك");
}

// إبقاء الدالة القديمة للتوافق مع أي زر قديم، لكنها لم تعد مستخدمة في الواجهة الجديدة.
async function quickExtendSubscription(docId, user, days, status = "active", planName = "") {
  const months = Math.max(1, Math.round(Number(days || 30) / 30));
  return extendSubscription(docId, user, months, status, planName);
}


async function makeSubscriptionOpen(docId) {
  const user = allUsersCache.find((u) => u.docId === docId) || {};

  if (!confirm("تفعيل اشتراك مفتوح لهذا المستخدم؟\n\nهذا الاشتراك لا يملك تاريخ انتهاء، وسيبقى فعالاً حتى توقفه أنت من الإدارة.")) {
    return;
  }

  const payload = {
    subscriptionStatus: "active",
    subscriptionPlanName: "اشتراك مفتوح",
    subscriptionStartDate: new Date(),
    subscriptionEndDate: null,
    subscriptionAmount: 0,
    subscriptionCurrency: "TRY",
    subscriptionPaymentMethod: "open",
    subscriptionNote: "اشتراك مفتوح بدون تاريخ انتهاء",
    isSubscriptionActive: true,
    subscriptionUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", docId), payload, { merge: true });

  await writeSubscriptionHistory(docId, user, payload, "subscription_open");

  await addAdminLog("subscription_open", {
    docId,
    targetUserId: docId,
    targetUserName: user.name || "",
    targetUserPhone: user.phone || "",
    targetUserRole: user.role || "",
    name: user.name || "",
    phone: user.phone || "",
    role: user.role || "",
    status: "active",
    newStatus: "active",
    plan: "اشتراك مفتوح",
    endDate: "مفتوح",
  });

  closeModal?.();
  toast("تم تفعيل اشتراك مفتوح");
  renderSubscriptions?.();
}

window.makeSubscriptionOpen = makeSubscriptionOpen;


async function stopSubscription(docId, user) {
  if (!confirm("إيقاف اشتراك هذا المستخدم؟")) return;

  await updateUserSubscription(docId, user, {
    subscriptionStatus: "suspended",
    subscriptionPlanName: user.subscriptionPlanName || "",
    subscriptionStartDate: toJsDate(user.subscriptionStartDate),
    subscriptionEndDate: toJsDate(user.subscriptionEndDate),
    subscriptionAmount: Number(user.subscriptionAmount || 0),
    subscriptionCurrency: user.subscriptionCurrency || "TRY",
    subscriptionPaymentMethod: user.subscriptionPaymentMethod || "",
    subscriptionNote: user.subscriptionNote || "",
  }, "subscription_stop");

  closeModal();
  toast("تم إيقاف الاشتراك");
}




/* ===== Stage 8 fix: missing normalized search helper ===== */
function searchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/* ===== Admin Stage 8: subscriptions center ===== */

/* ===== Admin Notifications Center Page ===== */
function daysUntilDate(value) {
  const date = toJsDate(value) || parseFirestoreDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function notificationLevelText(level) {
  const map = {
    danger: "عاجل",
    warning: "مهم",
    info: "معلومة",
    success: "جيد",
    neutral: "عادي",
  };

  return map[level] || "تنبيه";
}

function notificationTypeText(type) {
  const map = {
    user: "مستخدمين",
    subscription: "اشتراكات",
    order: "طلبات",
    load: "حمولات",
    availability: "توفر",
    tracking: "تتبع",
    admin: "إدارة",
  };

  return map[type] || "عام";
}

function notificationSortValue(item) {
  const levels = { danger: 5, warning: 4, info: 3, neutral: 2, success: 1 };
  return levels[item.level] || 0;
}

function buildAdminNotifications() {
  const items = [];
  const now = Date.now();

  allUsersCache.forEach((user) => {
    if (getUserStatus(user) === "pending") {
      items.push({
        id: `pending-user-${user.docId}`,
        type: "user",
        level: "warning",
        icon: "🛂",
        title: "مستخدم جديد بانتظار التوثيق",
        description: `${user.name || "مستخدم"} - ${getRoleText(user.role)} - ${user.phone || "-"}`,
        date: user.createdAt,
        section: "users",
        targetKind: "user",
        targetId: user.docId,
        actionText: "إدارة المستخدم",
      });
    }

    if (getUserStatus(user) === "blocked") {
      items.push({
        id: `blocked-user-${user.docId}`,
        type: "user",
        level: "neutral",
        icon: "⛔",
        title: "حساب محظور",
        description: `${user.name || "مستخدم"} - ${user.phone || "-"}`,
        date: user.updatedAt || user.createdAt,
        section: "users",
        targetKind: "user",
        targetId: user.docId,
        actionText: "فتح المستخدم",
      });
    }

    const subscriptionClass = subscriptionStatusClass(user);
    const remainingDays = daysUntilDate(user.subscriptionEndDate);

    if (subscriptionClass === "expired" || user.subscriptionStatus === "expired") {
      items.push({
        id: `expired-subscription-${user.docId}`,
        type: "subscription",
        level: "danger",
        icon: "💳",
        title: "اشتراك منتهي",
        description: `${user.name || "مستخدم"} - ${user.phone || "-"} - انتهى: ${formatDateTimeDisplay(user.subscriptionEndDate)}`,
        date: user.subscriptionEndDate || user.subscriptionUpdatedAt,
        section: "subscriptions",
        targetKind: "user",
        targetId: user.docId,
        actionText: "تجديد الاشتراك",
      });
    } else if ((subscriptionClass === "active" || subscriptionClass === "trial") && remainingDays !== null && remainingDays >= 0 && remainingDays <= 7) {
      items.push({
        id: `ending-subscription-${user.docId}`,
        type: "subscription",
        level: remainingDays <= 2 ? "danger" : "warning",
        icon: "⏰",
        title: "اشتراك سينتهي قريباً",
        description: `${user.name || "مستخدم"} - المتبقي ${remainingDays} يوم - النهاية: ${formatDateTimeDisplay(user.subscriptionEndDate)}`,
        date: user.subscriptionEndDate,
        section: "subscriptions",
        targetKind: "user",
        targetId: user.docId,
        actionText: "فتح الاشتراك",
      });
    }

    if (subscriptionClass === "suspended") {
      items.push({
        id: `suspended-subscription-${user.docId}`,
        type: "subscription",
        level: "warning",
        icon: "⏸️",
        title: "اشتراك موقوف",
        description: `${user.name || "مستخدم"} - ${user.phone || "-"}`,
        date: user.subscriptionUpdatedAt || user.updatedAt,
        section: "subscriptions",
        targetKind: "user",
        targetId: user.docId,
        actionText: "إدارة الاشتراك",
      });
    }
  });

  allOrdersCache.forEach((order) => {
    if (order.status === "بانتظار موافقة السائق" || order.status === "بانتظار موافقة صاحب البضاعة") {
      items.push({
        id: `waiting-order-${order.docId}`,
        type: "order",
        level: "warning",
        icon: "📋",
        title: order.status,
        description: `${orderNumberText(order)} - صاحب البضاعة: ${order.ownerName || "-"} - السائق: ${order.driverName || "-"}`,
        date: order.createdAt || order.updatedAt,
        section: "orders",
        targetKind: "order",
        targetId: order.docId,
        actionText: "فتح الطلب",
      });
    }

    if (isActiveOrder(order.status)) {
      const tracking = getTrackingForOrder(order);
      if (!tracking || !hasTrackingLocation(tracking)) {
        items.push({
          id: `tracking-missing-${order.docId}`,
          type: "tracking",
          level: "danger",
          icon: "📍",
          title: "طلب نشط بدون موقع تتبع",
          description: `${orderNumberText(order)} - الحالة: ${order.status || "-"} - السائق: ${order.driverName || "-"}`,
          date: order.updatedAt || order.createdAt,
          section: "tracking",
          targetKind: "order",
          targetId: order.docId,
          actionText: "فتح الطلب",
        });
      }
    }
  });

  allLoadsCache.forEach((load) => {
    if ((load.status || "available") === "available") {
      items.push({
        id: `available-load-${load.docId}`,
        type: "load",
        level: "info",
        icon: "📦",
        title: "حمولة متاحة بدون حجز",
        description: `${loadNumberText(load)} - ${load.ownerName || "-"} - ${load.loadType || "-"}`,
        date: load.createdAt || load.updatedAt,
        section: "loads",
        targetKind: "load",
        targetId: load.docId,
        actionText: "فتح الحمولة",
      });
    }
  });

  allAvailabilityCache.forEach((availability) => {
    if (isAvailabilityActive(availability)) {
      items.push({
        id: `active-availability-${availability.docId}`,
        type: "availability",
        level: "success",
        icon: "🟢",
        title: "سائق متاح الآن",
        description: `${availability.driverName || "سائق"} - من ${availabilityFrom(availability)} إلى ${availabilityTo(availability)}`,
        date: availability.createdAt || availability.updatedAt,
        section: "availability",
        targetKind: "section",
        targetId: "availability",
        actionText: "فتح التوفر",
      });
    }
  });

  return items.sort((a, b) => {
    const levelDiff = notificationSortValue(b) - notificationSortValue(a);
    if (levelDiff !== 0) return levelDiff;

    const ad = parseFirestoreDate(a.date) || toJsDate(a.date) || new Date(0);
    const bd = parseFirestoreDate(b.date) || toJsDate(b.date) || new Date(0);
    return bd.getTime() - ad.getTime();
  });
}

function filteredAdminNotifications() {
  const keyword = searchText(adminNotificationsSearchText);
  return buildAdminNotifications().filter((item) => {
    const matchesType = adminNotificationsTypeFilter === "all" || item.type === adminNotificationsTypeFilter;
    const matchesLevel = adminNotificationsLevelFilter === "all" || item.level === adminNotificationsLevelFilter;
    const haystack = searchText(`${item.title} ${item.description} ${notificationTypeText(item.type)} ${notificationLevelText(item.level)}`);
    return matchesType && matchesLevel && (!keyword || haystack.includes(keyword));
  });
}

function ensureAdminNotificationsSection() {
  if (!$("notificationsSection")) {
    const main = document.querySelector(".main-content");
    if (!main) return;

    const section = document.createElement("section");
    section.id = "notificationsSection";
    section.className = "section hidden";
    section.innerHTML = `
      <div class="panel dashboard-hero notifications-hero">
        <div>
          <span class="dashboard-kicker">التنبيهات</span>
          <h2>مركز تنبيهات الإدارة</h2>
          <p>كل الأمور التي تحتاج متابعة: توثيق، اشتراكات، طلبات، تتبع، حمولات وتوفر السائقين.</p>
        </div>
        <div class="dashboard-hero-actions windows-notifications-actions">
          <button class="windows-notifications-btn" id="enableWindowsNotificationsBtn">تفعيل إشعارات ويندوز</button>
          <button class="primary-btn" id="refreshAdminNotificationsBtn">تحديث التنبيهات</button>
          <small id="windowsNotificationsStatus">تعمل إذا صفحة الإدارة مفتوحة أو بالخلفية</small>
        </div>
      </div>

      <div id="adminNotificationsStats" class="mini-stats-grid"></div>

      <div class="panel filters-panel notifications-filter-panel">
        <div class="filters-grid">
          <div>
            <label>بحث</label>
            <input id="adminNotificationsSearchInput" type="text" placeholder="ابحث باسم، هاتف، طلب، حمولة..." />
          </div>
          <div>
            <label>نوع التنبيه</label>
            <select id="adminNotificationsTypeFilter">
              <option value="all">كل الأنواع</option>
              <option value="user">مستخدمين</option>
              <option value="subscription">اشتراكات</option>
              <option value="order">طلبات</option>
              <option value="load">حمولات</option>
              <option value="availability">توفر</option>
              <option value="tracking">تتبع</option>
            </select>
          </div>
          <div>
            <label>الأهمية</label>
            <select id="adminNotificationsLevelFilter">
              <option value="all">كل المستويات</option>
              <option value="danger">عاجل</option>
              <option value="warning">مهم</option>
              <option value="info">معلومة</option>
              <option value="success">جيد</option>
              <option value="neutral">عادي</option>
            </select>
          </div>
          <div class="filter-actions-box">
            <button class="light-btn" id="adminNotificationsClearBtn">مسح الفلاتر</button>
          </div>
        </div>
      </div>

      <div class="notifications-count-row">
        <span id="adminNotificationsCountText">بانتظار البيانات</span>
      </div>

      <div id="adminNotificationsList" class="admin-notifications-list"></div>
    `;

    main.appendChild(section);
  }

  const menu = document.querySelector(".side-menu");
  if (menu && !document.querySelector('[data-section="notifications"]')) {
    const btn = document.createElement("button");
    btn.className = "menu-btn notifications-menu-btn";
    btn.dataset.section = "notifications";
    btn.type = "button";
    btn.innerHTML = `🔔 التنبيهات <span id="adminNotificationsBadge" class="menu-badge hidden">0</span>`;
    btn.onclick = () => window.showSection("notifications");

    const usersBtn = document.querySelector('[data-section="users"]');
    if (usersBtn && usersBtn.parentNode) {
      usersBtn.parentNode.insertBefore(btn, usersBtn);
    } else {
      menu.prepend(btn);
    }
  }

  ensureGlobalNotificationBell();
  bindAdminNotificationsEvents();
  updateAdminNotificationsBadge();
}



function saveNotifiedAdminNotificationIds() {
  const ids = Array.from(notifiedAdminNotificationIds).slice(-300);
  notifiedAdminNotificationIds = new Set(ids);
  localStorage.setItem("notifiedAdminNotificationIds", JSON.stringify(ids));
}

function importantAdminNotifications() {
  return buildAdminNotifications().filter((item) => item.level === "danger" || item.level === "warning");
}

function windowsNotificationsSupported() {
  return "Notification" in window;
}

function updateWindowsNotificationsButton() {
  const btn = $("enableWindowsNotificationsBtn");
  const status = $("windowsNotificationsStatus");
  if (!btn) return;

  if (!windowsNotificationsSupported()) {
    btn.disabled = true;
    btn.textContent = "إشعارات ويندوز غير مدعومة";
    if (status) status.textContent = "المتصفح الحالي لا يدعم إشعارات سطح المكتب";
    return;
  }

  if (Notification.permission === "granted" && windowsNotificationsEnabled) {
    btn.textContent = "إشعارات ويندوز مفعّلة";
    btn.classList.add("enabled");
    if (status) status.textContent = "سيصلك إشعار ويندوز للتنبيهات المهمة والعاجلة الجديدة";
    return;
  }

  btn.classList.remove("enabled");

  if (Notification.permission === "denied") {
    btn.textContent = "الإذن مرفوض من المتصفح";
    if (status) status.textContent = "افتح إعدادات الموقع من المتصفح واسمح بالإشعارات";
    return;
  }

  btn.textContent = "تفعيل إشعارات ويندوز";
  if (status) status.textContent = "تعمل إذا صفحة الإدارة مفتوحة أو بالخلفية";
}

async function requestWindowsNotificationsPermission() {
  if (!windowsNotificationsSupported()) {
    alert("المتصفح الحالي لا يدعم إشعارات ويندوز");
    updateWindowsNotificationsButton();
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      windowsNotificationsEnabled = false;
      localStorage.setItem("adminWindowsNotificationsEnabled", "false");
      updateWindowsNotificationsButton();
      alert("لم يتم السماح بالإشعارات من المتصفح");
      return;
    }

    windowsNotificationsEnabled = true;
    localStorage.setItem("adminWindowsNotificationsEnabled", "true");

    // حتى لا تأتيك كل التنبيهات القديمة مرة واحدة بعد التفعيل
    importantAdminNotifications().forEach((item) => notifiedAdminNotificationIds.add(item.id));
    saveNotifiedAdminNotificationIds();

    new Notification("تم تفعيل إشعارات الإدارة", {
      body: "سيصلك إشعار ويندوز عند ظهور تنبيه مهم أو عاجل جديد.",
      tag: "admin-notifications-enabled",
      silent: false,
    });

    updateWindowsNotificationsButton();
    toast("تم تفعيل إشعارات ويندوز");
  } catch (error) {
    console.error("Windows notification permission error:", error);
    alert("تعذر تفعيل إشعارات ويندوز");
  }
}

function showWindowsAdminNotification(item) {
  if (!windowsNotificationsSupported()) return;
  if (!windowsNotificationsEnabled || Notification.permission !== "granted") return;

  try {
    const notification = new Notification(item.title || "تنبيه إدارة", {
      body: item.description || "",
      tag: item.id,
      renotify: false,
      silent: false,
    });

    notification.onclick = () => {
      window.focus();
      openAdminNotificationTarget(item.targetKind, item.targetId, item.section);
      notification.close();
    };
  } catch (error) {
    console.error("Failed to show Windows notification:", error);
  }
}

function processWindowsAdminNotifications() {
  if (!windowsNotificationsSupported()) return;
  if (!windowsNotificationsEnabled || Notification.permission !== "granted") return;

  const newItems = importantAdminNotifications().filter((item) => !notifiedAdminNotificationIds.has(item.id));

  if (!newItems.length) return;

  newItems.slice(0, 5).forEach((item) => {
    showWindowsAdminNotification(item);
    notifiedAdminNotificationIds.add(item.id);
  });

  // إذا طلع أكثر من 5 دفعة واحدة، لا نعيد نفس القديم لاحقاً
  newItems.slice(5).forEach((item) => notifiedAdminNotificationIds.add(item.id));

  saveNotifiedAdminNotificationIds();
}


function ensureGlobalNotificationBell() {
  if ($("adminGlobalNotificationsBell")) return;

  const bell = document.createElement("button");
  bell.id = "adminGlobalNotificationsBell";
  bell.type = "button";
  bell.className = "global-notification-bell";
  bell.title = "تنبيهات الإدارة";
  bell.innerHTML = `
    <span class="bell-icon">🔔</span>
    <span id="adminGlobalNotificationsBadge" class="global-bell-badge hidden">0</span>
  `;

  bell.addEventListener("click", () => {
    window.showSection("notifications");
  });

  document.body.appendChild(bell);
  updateAdminNotificationsBadge();
}


function bindAdminNotificationsEvents() {
  const searchInput = $("adminNotificationsSearchInput");
  const typeSelect = $("adminNotificationsTypeFilter");
  const levelSelect = $("adminNotificationsLevelFilter");
  const clearBtn = $("adminNotificationsClearBtn");
  const refreshBtn = $("refreshAdminNotificationsBtn");
  const windowsBtn = $("enableWindowsNotificationsBtn");

  if (windowsBtn && windowsBtn.dataset.bound !== "true") {
    windowsBtn.dataset.bound = "true";
    windowsBtn.addEventListener("click", requestWindowsNotificationsPermission);
  }

  updateWindowsNotificationsButton();

  if (searchInput && searchInput.dataset.bound !== "true") {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", (e) => {
      adminNotificationsSearchText = e.target.value.trim();
      renderAdminNotifications();
    });
  }

  if (typeSelect && typeSelect.dataset.bound !== "true") {
    typeSelect.dataset.bound = "true";
    typeSelect.addEventListener("change", (e) => {
      adminNotificationsTypeFilter = e.target.value;
      renderAdminNotifications();
    });
  }

  if (levelSelect && levelSelect.dataset.bound !== "true") {
    levelSelect.dataset.bound = "true";
    levelSelect.addEventListener("change", (e) => {
      adminNotificationsLevelFilter = e.target.value;
      renderAdminNotifications();
    });
  }

  if (clearBtn && clearBtn.dataset.bound !== "true") {
    clearBtn.dataset.bound = "true";
    clearBtn.addEventListener("click", () => {
      adminNotificationsSearchText = "";
      adminNotificationsTypeFilter = "all";
      adminNotificationsLevelFilter = "all";
      if (searchInput) searchInput.value = "";
      if (typeSelect) typeSelect.value = "all";
      if (levelSelect) levelSelect.value = "all";
      renderAdminNotifications();
    });
  }

  if (refreshBtn && refreshBtn.dataset.bound !== "true") {
    refreshBtn.dataset.bound = "true";
    refreshBtn.addEventListener("click", () => {
      renderAdminNotifications();
      toast("تم تحديث التنبيهات");
    });
  }
}

function updateAdminNotificationsBadge() {
  const allCount = buildAdminNotifications().length;
  const importantCount = buildAdminNotifications().filter((item) => item.level === "danger" || item.level === "warning").length;
  const text = allCount > 99 ? "+99" : String(allCount);

  const menuBadge = $("adminNotificationsBadge");
  if (menuBadge) {
    menuBadge.textContent = text;
    menuBadge.classList.toggle("hidden", allCount === 0);
  }

  const globalBadge = $("adminGlobalNotificationsBadge");
  if (globalBadge) {
    globalBadge.textContent = text;
    globalBadge.classList.toggle("hidden", allCount === 0);
  }

  const bell = $("adminGlobalNotificationsBell");
  if (bell) {
    bell.classList.toggle("has-alerts", allCount > 0);
    bell.classList.toggle("has-important-alerts", importantCount > 0);
    bell.title = allCount > 0
      ? `عندك ${allCount} تنبيه، منها ${importantCount} مهم أو عاجل`
      : "لا توجد تنبيهات";
  }

  updateWindowsNotificationsButton();
  updateMobileAdminHeader(document.querySelector('.menu-btn.active')?.dataset.section || 'home');
  processWindowsAdminNotifications();
}

function renderAdminNotificationsStats(items = buildAdminNotifications()) {
  const box = $("adminNotificationsStats");
  if (!box) return;

  box.innerHTML = `
    ${buildMiniStat("كل التنبيهات", items.length)}
    ${buildMiniStat("عاجلة", items.filter((i) => i.level === "danger").length)}
    ${buildMiniStat("مهمة", items.filter((i) => i.level === "warning").length)}
    ${buildMiniStat("اشتراكات", items.filter((i) => i.type === "subscription").length)}
    ${buildMiniStat("توثيق", items.filter((i) => i.type === "user").length)}
  `;
}

function buildAdminNotificationCard(item) {
  return `
    <div class="admin-notification-card ${escapeHtml(item.level)}">
      <div class="notification-icon">${escapeHtml(item.icon)}</div>
      <div class="notification-main">
        <div class="notification-title-row">
          <h3>${escapeHtml(item.title)}</h3>
          <span class="notification-level ${escapeHtml(item.level)}">${escapeHtml(notificationLevelText(item.level))}</span>
        </div>
        <p>${escapeHtml(item.description)}</p>
        <div class="notification-meta">
          <span>${escapeHtml(notificationTypeText(item.type))}</span>
          <span>${escapeHtml(formatDateTimeDisplay(item.date))}</span>
        </div>
      </div>
      <div class="notification-actions">
        <button class="ghost-btn" data-open-notification="true" data-kind="${escapeHtml(item.targetKind || "section")}" data-id="${escapeHtml(item.targetId || "")}" data-section="${escapeHtml(item.section || "home")}">${escapeHtml(item.actionText || "فتح")}</button>
      </div>
    </div>
  `;
}

function bindAdminNotificationOpenButtons() {
  document.querySelectorAll('[data-open-notification="true"]').forEach((btn) => {
    if (btn.dataset.bound === "true") return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", () => {
      openAdminNotificationTarget(btn.dataset.kind, btn.dataset.id, btn.dataset.section);
    });
  });
}

function renderAdminNotifications() {
  ensureAdminNotificationsSection();

  const allItems = buildAdminNotifications();
  const items = filteredAdminNotifications();

  renderAdminNotificationsStats(allItems);
  updateAdminNotificationsBadge();
  updateWindowsNotificationsButton();

  const countText = $("adminNotificationsCountText");
  if (countText) {
    countText.textContent = `عرض ${items.length} من أصل ${allItems.length} تنبيه`;
  }

  const list = $("adminNotificationsList");
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `
      <div class="empty-box notifications-empty">
        ✅ لا توجد تنبيهات مطابقة حالياً
      </div>
    `;
    return;
  }

  list.innerHTML = items.map(buildAdminNotificationCard).join("");
  bindAdminNotificationOpenButtons();
}

function openAdminNotificationTarget(kind, id, section) {
  if (kind === "user") {
    const user = allUsersCache.find((u) => u.docId === id || u.uid === id);
    if (user) {
      showManageUserModal(user.docId, user);
      return;
    }
  }

  if (kind === "order") {
    if (typeof showOrderDetailsModal === "function") {
      showOrderDetailsModal(id);
      return;
    }
  }

  if (kind === "load") {
    if (typeof showLoadDetailsModal === "function") {
      showLoadDetailsModal(id);
      return;
    }
  }

  window.showSection(section || "home");
}

window.openAdminNotificationTarget = openAdminNotificationTarget;


function ensureSubscriptionsSection() {
  if (!$("subscriptionsSection")) {
    const main = document.querySelector(".main-content");
    if (!main) return;

    const section = document.createElement("section");
    section.id = "subscriptionsSection";
    section.className = "section hidden";
    section.innerHTML = `
      <div class="panel dashboard-hero subscriptions-hero">
        <div>
          <span class="dashboard-kicker">الاشتراكات</span>
          <h2>مركز إدارة الاشتراكات</h2>
          <p>تابع الاشتراكات الفعالة والمنتهية والموقوفة، وجدّد الاشتراك مباشرة من نفس الصفحة.</p>
        </div>
        <div class="dashboard-hero-actions">
          <button class="primary-btn" id="subscriptionsExportPdfBtn">تقرير PDF</button>
          <button class="ghost-btn" id="subscriptionsExportCsvBtn">تصدير CSV</button>
        </div>
      </div>

      <div id="subscriptionsStats" class="mini-stats-grid"></div>

      <div class="panel filters-panel subscriptions-filter-panel">
        <div class="filters-grid">
          <div>
            <label>بحث</label>
            <input id="subscriptionsSearchInput" type="text" placeholder="اسم، هاتف، حالة، خطة..." />
          </div>
          <div>
            <label>حالة الاشتراك</label>
            <select id="subscriptionsStatusFilter">
              <option value="all">كل الحالات</option>
              <option value="active">مشترك فعال</option>
              <option value="trial">تجريبي</option>
              <option value="free">مجاني</option>
              <option value="expired">منتهي</option>
              <option value="suspended">موقوف</option>
            </select>
          </div>
          <div>
            <label>نوع المستخدم</label>
            <select id="subscriptionsRoleFilter">
              <option value="all">الكل</option>
              <option value="driver">السائقين</option>
              <option value="owner">أصحاب البضاعة</option>
            </select>
          </div>
          <div class="filter-actions-box">
            <button class="light-btn" id="subscriptionsClearFiltersBtn">مسح الفلاتر</button>
          </div>
        </div>
      </div>

      <div class="subscriptions-count-row">
        <span id="subscriptionsCountText">بانتظار البيانات</span>
      </div>

      <div id="subscriptionsList" class="cards-list subscriptions-list"></div>
    `;

    main.appendChild(section);
  }

  const menu = document.querySelector(".side-menu");
  if (menu && !document.querySelector('[data-section="subscriptions"]')) {
    const btn = document.createElement("button");
    btn.className = "menu-btn";
    btn.dataset.section = "subscriptions";
    btn.type = "button";
    btn.textContent = "💳 الاشتراكات";
    btn.onclick = () => window.showSection("subscriptions");

    const ownersBtn = document.querySelector('[data-section="owners"]');
    if (ownersBtn && ownersBtn.parentNode) {
      ownersBtn.parentNode.insertBefore(btn, ownersBtn.nextSibling);
    } else {
      menu.appendChild(btn);
    }
  }

  bindSubscriptionsSectionEvents();
}

function bindSubscriptionsSectionEvents() {
  const searchInput = $("subscriptionsSearchInput");
  const statusSelect = $("subscriptionsStatusFilter");
  const roleSelect = $("subscriptionsRoleFilter");
  const clearBtn = $("subscriptionsClearFiltersBtn");
  const csvBtn = $("subscriptionsExportCsvBtn");
  const pdfBtn = $("subscriptionsExportPdfBtn");

  if (searchInput && searchInput.dataset.bound !== "true") {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", (e) => {
      subscriptionsSearchText = e.target.value.trim();
      renderSubscriptions();
    });
  }

  if (statusSelect && statusSelect.dataset.bound !== "true") {
    statusSelect.dataset.bound = "true";
    statusSelect.addEventListener("change", (e) => {
      subscriptionsStatusFilter = e.target.value;
      renderSubscriptions();
    });
  }

  if (roleSelect && roleSelect.dataset.bound !== "true") {
    roleSelect.dataset.bound = "true";
    roleSelect.addEventListener("change", (e) => {
      subscriptionsRoleFilter = e.target.value;
      renderSubscriptions();
    });
  }

  if (clearBtn && clearBtn.dataset.bound !== "true") {
    clearBtn.dataset.bound = "true";
    clearBtn.addEventListener("click", () => {
      subscriptionsSearchText = "";
      subscriptionsStatusFilter = "all";
      subscriptionsRoleFilter = "all";
      if (searchInput) searchInput.value = "";
      if (statusSelect) statusSelect.value = "all";
      if (roleSelect) roleSelect.value = "all";
      renderSubscriptions();
    });
  }

  if (csvBtn && csvBtn.dataset.bound !== "true") {
    csvBtn.dataset.bound = "true";
    csvBtn.addEventListener("click", exportSubscriptionsCsv);
  }

  if (pdfBtn && pdfBtn.dataset.bound !== "true") {
    pdfBtn.dataset.bound = "true";
    pdfBtn.addEventListener("click", openSubscriptionsPrintableReport);
  }
}

function filteredSubscriptionsUsers() {
  const keyword = searchText(subscriptionsSearchText || "");
  const status = subscriptionsStatusFilter || "all";
  const role = subscriptionsRoleFilter || "all";

  return allUsersCache.filter((user) => {
    const roleOk = role === "all" || user.role === role;
    const statusClass = subscriptionStatusClass(user);
    const statusOk = status === "all" || statusClass === status;

    const blob = searchText([
      user.name,
      user.phone,
      user.email,
      getRoleText(user.role),
      subscriptionBadgeText(user),
      subscriptionSummaryText(user),
      user.subscriptionPlanName,
      user.subscriptionPaymentMethod,
      user.subscriptionNote,
      formatDateTimeDisplay(user.subscriptionEndDate),
    ].join(" "));

    return roleOk && statusOk && (!keyword || blob.includes(keyword));
  }).sort((a, b) => {
    const classOrder = { expired: 1, suspended: 2, trial: 3, active: 4, free: 5, unknown: 6 };
    const order = (classOrder[subscriptionStatusClass(a)] || 9) - (classOrder[subscriptionStatusClass(b)] || 9);
    if (order !== 0) return order;
    return String(a.name || "").localeCompare(String(b.name || ""), "ar");
  });
}

function renderSubscriptionsStats() {
  const box = $("subscriptionsStats");
  if (!box) return;

  const users = allUsersCache;
  box.innerHTML = `
    ${buildMiniStat("كل الحسابات", users.length)}
    ${buildMiniStat("فعالة", users.filter((u) => subscriptionStatusClass(u) === "active").length)}
    ${buildMiniStat("تجريبية", users.filter((u) => subscriptionStatusClass(u) === "trial").length)}
    ${buildMiniStat("مجانية", users.filter((u) => subscriptionStatusClass(u) === "free").length)}
    ${buildMiniStat("منتهية", users.filter((u) => subscriptionStatusClass(u) === "expired").length)}
    ${buildMiniStat("موقوفة", users.filter((u) => subscriptionStatusClass(u) === "suspended").length)}
  `;
}

function renderSubscriptions() {
  ensureSubscriptionsSection();
  renderSubscriptionsStats();

  const list = $("subscriptionsList");
  if (!list) return;

  const users = filteredSubscriptionsUsers();

  if ($("subscriptionsCountText")) {
    $("subscriptionsCountText").textContent = users.length === allUsersCache.length
      ? `المعروض: ${users.length}`
      : `المعروض: ${users.length} من أصل ${allUsersCache.length}`;
  }

  if (!users.length) {
    list.innerHTML = `<div class="empty-box">لا توجد اشتراكات حسب الفلتر الحالي</div>`;
    return;
  }

  list.innerHTML = "";
  users.forEach((user) => list.appendChild(buildSubscriptionCard(user)));
}

function buildSubscriptionCard(user) {
  const card = document.createElement("div");
  const statusClass = subscriptionStatusClass(user);
  card.className = `data-card subscription-center-card ${statusClass}`;

  card.innerHTML = `
    <div class="card-top">
      <div class="avatar">💳</div>
      <div class="card-title">
        <h3>${escapeHtml(user.name || "بدون اسم")}</h3>
        <p>${escapeHtml(getRoleText(user.role))} • ${escapeHtml(user.phone || "-")}</p>
      </div>
      <span class="subscription-status-badge ${statusClass}">${escapeHtml(subscriptionBadgeText(user))}</span>
    </div>

    <div class="subscription-center-grid">
      ${infoRow("الخطة", user.subscriptionPlanName || "-")}
      ${infoRow("البداية", formatDateTimeDisplay(user.subscriptionStartDate))}
      ${infoRow("النهاية", formatDateTimeDisplay(user.subscriptionEndDate))}
      ${infoRow("المتبقي", subscriptionRemainingDays(user))}
      ${infoRow("المبلغ", `${user.subscriptionAmount || 0} ${user.subscriptionCurrency || "TRY"}`)}
      ${infoRow("الدفع", user.subscriptionPaymentMethod || "-")}
    </div>

    ${user.subscriptionNote ? `<div class="subscription-note-box">${escapeHtml(user.subscriptionNote)}</div>` : ""}

    <div class="subscription-card-actions-wrap">
      <div class="actions subscription-center-actions">
        <button class="manage-btn" data-action="manage">إدارة / يدوي</button>
        <button class="light-btn" data-action="logs">السجل</button>
        <button class="trial-btn" data-action="free6">6 أشهر مجانية</button>
        <button class="danger-btn" data-action="stop">إيقاف</button>
      </div>

      <div class="subscription-mini-group">
        <b>تجديد من اليوم</b>
        <div class="actions subscription-center-actions">
          <button class="renew-btn" data-action="renew1">شهر</button>
          <button class="renew-btn" data-action="renew3">3 أشهر</button>
          <button class="renew-btn" data-action="renew6">6 أشهر</button>
          <button class="renew-btn" data-action="renew12">12 شهر</button>
        </div>
      </div>

      <div class="subscription-mini-group">
        <b>تمديد فوق الحالي</b>
        <div class="actions subscription-center-actions">
          <button class="extend-btn" data-action="extend1">شهر</button>
          <button class="extend-btn" data-action="extend3">3 أشهر</button>
          <button class="extend-btn" data-action="extend6">6 أشهر</button>
          <button class="extend-btn" data-action="extend12">12 شهر</button>
        </div>
      </div>
    </div>
  `;

  card.querySelector('[data-action="manage"]').onclick = () => showManageUserModal(user.docId, user);
  card.querySelector('[data-action="logs"]').onclick = () => showUserAdminLogsModal(user);
  card.querySelector('[data-action="free6"]').onclick = () => renewSubscription(user.docId, user, 6, "trial", "6 أشهر مجانية");
  card.querySelector('[data-action="renew1"]').onclick = () => renewSubscription(user.docId, user, 1, "active", "اشتراك شهر");
  card.querySelector('[data-action="renew3"]').onclick = () => renewSubscription(user.docId, user, 3, "active", "اشتراك 3 أشهر");
  card.querySelector('[data-action="renew6"]').onclick = () => renewSubscription(user.docId, user, 6, "active", "اشتراك 6 أشهر");
  card.querySelector('[data-action="renew12"]').onclick = () => renewSubscription(user.docId, user, 12, "active", "اشتراك 12 شهر");
  card.querySelector('[data-action="extend1"]').onclick = () => extendSubscription(user.docId, user, 1, "active", "اشتراك شهر");
  card.querySelector('[data-action="extend3"]').onclick = () => extendSubscription(user.docId, user, 3, "active", "اشتراك 3 أشهر");
  card.querySelector('[data-action="extend6"]').onclick = () => extendSubscription(user.docId, user, 6, "active", "اشتراك 6 أشهر");
  card.querySelector('[data-action="extend12"]').onclick = () => extendSubscription(user.docId, user, 12, "active", "اشتراك 12 شهر");
  card.querySelector('[data-action="stop"]').onclick = () => stopSubscription(user.docId, user);

  return card;
}

function exportSubscriptionsCsv() {
  const headers = ["الاسم", "الدور", "الهاتف", "الحالة", "الخطة", "البداية", "النهاية", "الأيام المتبقية", "المبلغ", "العملة", "طريقة الدفع", "ملاحظة"];
  const rows = filteredSubscriptionsUsers().map((u) => ({
    "الاسم": u.name || "",
    "الدور": getRoleText(u.role),
    "الهاتف": u.phone || "",
    "الحالة": subscriptionBadgeText(u),
    "الخطة": u.subscriptionPlanName || "",
    "البداية": formatDateTimeDisplay(u.subscriptionStartDate),
    "النهاية": formatDateTimeDisplay(u.subscriptionEndDate),
    "الأيام المتبقية": subscriptionRemainingDays(u),
    "المبلغ": u.subscriptionAmount || 0,
    "العملة": u.subscriptionCurrency || "TRY",
    "طريقة الدفع": u.subscriptionPaymentMethod || "",
    "ملاحظة": u.subscriptionNote || "",
  }));

  downloadTextFile(`admin-subscriptions-${todayFileDate()}.csv`, buildCsv(headers, rows));
  toast(`تم تصدير ${rows.length} اشتراك`);
}

function openSubscriptionsPrintableReport() {
  const users = filteredSubscriptionsUsers();
  const now = new Date().toLocaleString("ar-SY");

  const summary = [
    ["عدد الحسابات", users.length],
    ["فعالة", users.filter((u) => subscriptionStatusClass(u) === "active").length],
    ["تجريبية", users.filter((u) => subscriptionStatusClass(u) === "trial").length],
    ["مجانية", users.filter((u) => subscriptionStatusClass(u) === "free").length],
    ["منتهية", users.filter((u) => subscriptionStatusClass(u) === "expired").length],
    ["موقوفة", users.filter((u) => subscriptionStatusClass(u) === "suspended").length],
  ];

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة ثم جرّب مرة ثانية.");
    return;
  }

  const summaryHtml = summary.map(([label, value]) => `
    <div class="summary-card">
      <span>${htmlEscapeForReport(label)}</span>
      <b>${htmlEscapeForReport(value)}</b>
    </div>
  `).join("");

  const rows = users.length ? users.map((u, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${htmlEscapeForReport(u.name || "-")}</td>
      <td>${htmlEscapeForReport(getRoleText(u.role))}</td>
      <td>${htmlEscapeForReport(u.phone || "-")}</td>
      <td>${htmlEscapeForReport(subscriptionBadgeText(u))}</td>
      <td>${htmlEscapeForReport(u.subscriptionPlanName || "-")}</td>
      <td>${htmlEscapeForReport(formatDateTimeDisplay(u.subscriptionStartDate))}</td>
      <td>${htmlEscapeForReport(formatDateTimeDisplay(u.subscriptionEndDate))}</td>
      <td>${htmlEscapeForReport(subscriptionRemainingDays(u))}</td>
      <td>${htmlEscapeForReport(`${u.subscriptionAmount || 0} ${u.subscriptionCurrency || "TRY"}`)}</td>
    </tr>
  `).join("") : `<tr><td colspan="10" class="empty-report">لا توجد اشتراكات حسب الفلتر الحالي</td></tr>`;

  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير الاشتراكات</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:28px;font-family:Arial,Tahoma,sans-serif;background:#f1f5f9;color:#0f172a;direction:rtl}
    .report-page{max-width:1200px;margin:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 18px 45px rgba(15,23,42,.12)}
    .report-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:3px solid #7c3aed;margin-bottom:18px}
    h1{margin:0 0 8px;color:#4c1d95;font-size:28px}
    p{margin:0;color:#64748b;line-height:1.8;font-size:14px}
    .report-actions{display:flex;gap:10px}
    .report-actions button{border:none;border-radius:12px;padding:12px 16px;font-weight:900;cursor:pointer;color:#fff;background:#7c3aed}
    .report-actions .close-btn{background:#64748b}
    .summary-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin:18px 0}
    .summary-card{border:1px solid #e2e8f0;background:#f8fafc;border-radius:16px;padding:14px;min-height:82px}
    .summary-card span{display:block;color:#64748b;font-size:13px;margin-bottom:10px}
    .summary-card b{font-size:24px;color:#4c1d95}
    .table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:16px}
    table{width:100%;border-collapse:collapse;font-size:13px;min-width:1050px}
    th{background:#4c1d95;color:#fff;padding:12px 10px;text-align:right;white-space:nowrap}
    td{border-bottom:1px solid #e2e8f0;padding:10px;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc}
    .empty-report{text-align:center;padding:28px;color:#64748b;font-weight:900}
    .footer{margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;display:flex;justify-content:space-between;gap:12px}
    @media(max-width:800px){body{padding:12px}.report-header{flex-direction:column}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.report-actions{width:100%}.report-actions button{flex:1}}
    @media print{body{background:#fff;padding:0}.report-page{box-shadow:none;border-radius:0;max-width:none}.report-actions{display:none}.table-wrap{overflow:visible}table{min-width:0;font-size:10px}th,td{padding:6px}.summary-grid{grid-template-columns:repeat(6,1fr)}@page{size:A4 landscape;margin:10mm}}
  </style>
</head>
<body>
  <div class="report-page">
    <div class="report-header">
      <div>
        <h1>تقرير الاشتراكات</h1>
        <p>
          لوحة إدارة تطبيق حمولتي<br>
          تاريخ التقرير: ${htmlEscapeForReport(now)}<br>
          التقرير مبني على فلاتر صفحة الاشتراكات الحالية.
        </p>
      </div>
      <div class="report-actions">
        <button onclick="window.print()">طباعة / حفظ PDF</button>
        <button class="close-btn" onclick="window.close()">إغلاق</button>
      </div>
    </div>

    <div class="summary-grid">${summaryHtml}</div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الاسم</th>
            <th>الدور</th>
            <th>الهاتف</th>
            <th>الحالة</th>
            <th>الخطة</th>
            <th>البداية</th>
            <th>النهاية</th>
            <th>المتبقي</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="footer">
      <span>تطبيق حمولتي - تقرير الاشتراكات</span>
      <span>عدد السجلات: ${users.length}</span>
    </div>
  </div>
</body>
</html>`);
  reportWindow.document.close();

  setTimeout(() => reportWindow.focus(), 300);
}


function buildUserCard(user) {
  const card = document.createElement("div");
  card.className = "user-card";
  const status = getUserStatus(user);
  const ordersCount = getUserOrders(user).length;
  const loadsCount = getOwnerLoads(user).length;
  card.innerHTML = `
    <div class="card-top">
      <div class="avatar">${getRoleIcon(user.role)}</div>
      <div class="card-title">
        <h3>${escapeHtml(user.name || "بدون اسم")}</h3>
        <p>${escapeHtml(getRoleText(user.role))}</p>
      </div>
      <span class="badge ${status}">${escapeHtml(getUserStatusText(user))}</span>
    </div>
    ${infoRow("الهاتف", user.phone)}
    ${infoRow("الإيميل", user.email)}
    ${infoRow("UID", user.uid || user.docId)}
    ${infoRow("الطلبات", ordersCount)}
    ${user.role === "owner" ? infoRow("الحمولات", loadsCount) : ""}
    ${infoRow("تاريخ التسجيل", formatDateTime(user.createdAt))}
    <div class="subscription-chip ${subscriptionStatusClass(user)}">
      <span>الاشتراك</span>
      <b>${escapeHtml(subscriptionSummaryText(user))}</b>
    </div>
    <div class="actions">
      <button class="manage-btn" data-action="manage">إدارة</button>
      <button class="subscription-btn" data-action="subscription">اشتراك</button>
      <button class="whatsapp-btn" data-action="whatsapp">واتساب</button>
      ${user.isVerified === true ? `<button class="unverify-btn" data-action="unverify">إلغاء التوثيق</button>` : `<button class="verify-btn" data-action="verify">توثيق</button>`}
      ${user.isActive === false ? `<button class="unblock-btn" data-action="unblock">فك الحظر</button>` : `<button class="block-btn" data-action="block">حظر</button>`}
    </div>`;
  card.querySelector('[data-action="manage"]').onclick = () => showManageUserModal(user.docId, user);
  card.querySelector('[data-action="subscription"]')?.addEventListener("click", () => showManageUserModal(user.docId, user));
  card.querySelector('[data-action="whatsapp"]').onclick = () => openWhatsApp(user);
  card.querySelector('[data-action="verify"]')?.addEventListener("click", () => verifyUser(user.docId));
  card.querySelector('[data-action="unverify"]')?.addEventListener("click", () => unverifyUser(user.docId));
  card.querySelector('[data-action="block"]')?.addEventListener("click", () => blockUser(user.docId));
  card.querySelector('[data-action="unblock"]')?.addEventListener("click", () => unblockUser(user.docId));
  return card;
}

function renderDrivers() {
  const container = $("driversList");
  if (!container) return;
  ensureStage3Toolbar("drivers", "driversList", "أدوات السائقين");
  const drivers = allUsersCache.filter((u) => u.role === "driver");
  const available = drivers.filter((u) => findActiveAvailabilityForDriver(u)).length;
  if ($("driversStats")) {
    $("driversStats").innerHTML = `
      ${buildMiniStat("كل السائقين", drivers.length)}
      ${buildMiniStat("متاح الآن", available)}
      ${buildMiniStat("غير متاح", drivers.length - available)}
      ${buildMiniStat("بانتظار التوثيق", drivers.filter((u) => getUserStatus(u) === "pending").length)}
      ${buildMiniStat("محظور", drivers.filter((u) => getUserStatus(u) === "blocked").length)}
    `;
  }
  const text = driversSearchText.toLowerCase();
  const filtered = drivers.filter((u) => {
    const availability = findActiveAvailabilityForDriver(u);
    const isAvailable = Boolean(availability);
    const blob = `${u.name || ""} ${u.phone || ""} ${u.email || ""} ${availability?.truckType || ""} ${availabilityFrom(availability || {})} ${availabilityTo(availability || {})}`.toLowerCase();
    return (driversSearchText === "" || blob.includes(text)) &&
      (driversAvailabilityFilter === "all" || (driversAvailabilityFilter === "available" && isAvailable) || (driversAvailabilityFilter === "unavailable" && !isAvailable));
  });
  updateStage3Count("drivers", filtered.length, drivers.length);
  container.innerHTML = filtered.length ? "" : `<div class="empty-box">لا يوجد سائقين حسب الفلتر الحالي</div>`;
  filtered.forEach((driver) => container.appendChild(buildDriverCard(driver)));
}

function buildDriverCard(driver) {
  const availability = findActiveAvailabilityForDriver(driver);
  const active = Boolean(availability);
  const card = buildUserCard(driver);
  const extra = document.createElement("div");
  extra.className = "mini-box";
  extra.innerHTML = `
    <span class="badge ${active ? "available" : "neutral"}">${active ? "متاح الآن" : "غير متاح"}</span>
    ${infoRow("نوع الشاحنة", availability?.truckType || "-")}
    ${infoRow("من", availabilityFrom(availability || {}))}
    ${infoRow("إلى", availabilityTo(availability || {}))}
    ${infoRow("ينتهي التوفر", formatDateTime(availability?.availableUntil))}
  `;
  card.appendChild(extra);
  return card;
}

function renderOwners() {
  const container = $("ownersList");
  if (!container) return;
  ensureStage3Toolbar("owners", "ownersList", "أدوات أصحاب البضاعة");
  const owners = allUsersCache.filter((u) => u.role === "owner");
  const withActiveOrders = owners.filter((u) => getUserOrders(u).some((o) => isActiveOrder(o.status))).length;
  if ($("ownersStats")) {
    $("ownersStats").innerHTML = `
      ${buildMiniStat("كل أصحاب البضاعة", owners.length)}
      ${buildMiniStat("لديهم طلبات نشطة", withActiveOrders)}
      ${buildMiniStat("لديهم حمولات", owners.filter((u) => getOwnerLoads(u).length > 0).length)}
      ${buildMiniStat("موثقين", owners.filter((u) => getUserStatus(u) === "verified").length)}
      ${buildMiniStat("محظورين", owners.filter((u) => getUserStatus(u) === "blocked").length)}
    `;
  }
  const text = ownersSearchText.toLowerCase();
  const filtered = owners.filter((owner) => {
    const orders = getUserOrders(owner);
    const loads = getOwnerLoads(owner);
    const blob = `${owner.name || ""} ${owner.phone || ""} ${owner.email || ""}`.toLowerCase();
    const matchesSearch = ownersSearchText === "" || blob.includes(text);
    let matchesFilter = true;
    if (ownersFilter === "active_orders") matchesFilter = orders.some((o) => isActiveOrder(o.status));
    if (ownersFilter === "published_loads") matchesFilter = loads.length > 0;
    if (ownersFilter === "no_orders") matchesFilter = orders.length === 0;
    if (ownersFilter === "verified") matchesFilter = getUserStatus(owner) === "verified";
    if (ownersFilter === "pending") matchesFilter = getUserStatus(owner) === "pending";
    if (ownersFilter === "blocked") matchesFilter = getUserStatus(owner) === "blocked";
    return matchesSearch && matchesFilter;
  });
  updateStage3Count("owners", filtered.length, owners.length);
  container.innerHTML = filtered.length ? "" : `<div class="empty-box">لا يوجد أصحاب بضاعة حسب الفلتر</div>`;
  filtered.forEach((owner) => container.appendChild(buildOwnerCard(owner)));
}

function buildOwnerCard(owner) {
  const card = buildUserCard(owner);
  const orders = getUserOrders(owner);
  const loads = getOwnerLoads(owner);
  const box = document.createElement("div");
  box.className = "mini-box";
  box.innerHTML = `
    ${infoRow("طلبات نشطة", orders.filter((o) => isActiveOrder(o.status)).length)}
    ${infoRow("طلبات منتهية", orders.filter((o) => o.status === "تم التسليم").length)}
    ${infoRow("حمولات منشورة", loads.length)}
    ${infoRow("حمولات نشطة", loads.filter((l) => l.status === "available" || l.status === "reserved").length)}
  `;
  card.appendChild(box);
  return card;
}

function getUserOrders(user) {
  const name = String(user.name || "").trim();
  const phone = cleanPhone(user.phone || "");
  return allOrdersCache.filter((o) => {
    const ownerPhone = cleanPhone(o.ownerPhone || "");
    const driverPhone = cleanPhone(o.driverPhone || "");
    return (name && (o.ownerName === name || o.driverName === name)) || (phone && (ownerPhone === phone || driverPhone === phone));
  });
}

function getOwnerLoads(owner) {
  const name = String(owner.name || "").trim();
  const phone = cleanPhone(owner.phone || "");
  return allLoadsCache.filter((l) => {
    const ownerPhone = cleanPhone(l.ownerPhone || "");
    return (name && l.ownerName === name) || (phone && ownerPhone === phone);
  });
}

function renderOrdersStats() {
  if (!$("ordersStats")) return;
  $("ordersStats").innerHTML = `
    ${buildMiniStat("كل الطلبات", allOrdersCache.length)}
    ${buildMiniStat("بانتظار", allOrdersCache.filter((o) => String(o.status || "").includes("بانتظار")).length)}
    ${buildMiniStat("مقبول", allOrdersCache.filter((o) => o.status === "مقبول").length)}
    ${buildMiniStat("في الطريق", allOrdersCache.filter((o) => o.status === "في الطريق").length)}
    ${buildMiniStat("تم التسليم", allOrdersCache.filter((o) => o.status === "تم التسليم").length)}
    ${buildMiniStat("ملغي", allOrdersCache.filter((o) => isCancelledOrder(o.status)).length)}
  `;
}

function renderOrdersStatusChips() {
  const container = $("ordersStatusChips");
  if (!container) return;
  const chips = [["all", "كل الطلبات"], ...orderStatuses.map((s) => [s, s])];
  container.innerHTML = "";
  chips.forEach(([value, label]) => {
    const button = document.createElement("button");
    button.className = ordersStatusFilter === value ? "status-chip active" : "status-chip";
    button.textContent = label;
    button.onclick = () => {
      ordersStatusFilter = value;
      if ($("ordersStatusFilter")) $("ordersStatusFilter").value = value;
      renderOrdersStatusChips();
      renderOrders();
    };
    container.appendChild(button);
  });
}

function renderOrders() {
  const container = $("ordersList");
  if (!container) return;
  ensureStage3Toolbar("orders", "ordersList", "أدوات الطلبات");
  const text = ordersSearchText.toLowerCase();
  const orders = allOrdersCache.filter((o) => {
    const blob = `${orderNumberText(o)} ${o.title || ""} ${o.ownerName || ""} ${o.ownerPhone || ""} ${o.driverName || ""} ${o.driverPhone || ""} ${o.fromCity || ""} ${o.toCity || ""} ${o.fromGovernorate || ""} ${o.toGovernorate || ""} ${o.loadId || ""}`.toLowerCase();
    return (ordersSearchText === "" || blob.includes(text)) &&
      (ordersStatusFilter === "all" || o.status === ordersStatusFilter) &&
      (ordersTypeFilter === "all" || o.requestType === ordersTypeFilter);
  }).sort(byCreatedDesc);
  updateStage3Count("orders", orders.length, allOrdersCache.length);
  container.innerHTML = orders.length ? "" : `<div class="empty-box">لا توجد طلبات حسب الفلتر</div>`;
  orders.forEach((order) => container.appendChild(buildOrderCard(order, true)));
}

function buildOrderCard(order, showActions = true) {
  const card = document.createElement("div");
  card.className = "data-card";
  const statusOptions = orderStatuses.map((s) => `<option value="${escapeHtml(s)}" ${order.status === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("");
  card.innerHTML = `
    <div class="card-top">
      <div class="avatar">📋</div>
      <div class="card-title">
        <h3>${escapeHtml(orderNumberText(order))}</h3>
        <p>${escapeHtml(order.title || "طلب بدون عنوان")}</p>
      </div>
      <span class="badge ${badgeClassForStatus(order.status)}">${escapeHtml(order.status || "غير محدد")}</span>
    </div>
    ${infoRow("صاحب البضاعة", `${order.ownerName || "-"} ${order.ownerPhone ? " - " + order.ownerPhone : ""}`)}
    ${infoRow("السائق", `${order.driverName || "-"} ${order.driverPhone ? " - " + order.driverPhone : ""}`)}
    ${infoRow("نوع سيارة السائق", order.driverTruckType)}
    ${infoRow("المسار", `${order.fromGovernorate || order.fromCity || "-"} ← ${order.toGovernorate || order.toCity || "-"}`)}
    ${infoRow("السعر", order.price)}
    ${infoRow("نوع الطلب", order.requestType === "driver_to_load" ? "طلب على حمولة منشورة" : "طلب بحث عن سائق")}
    ${infoRow("رقم الحمولة", order.loadId || "-")}
    ${infoRow("تاريخ الإنشاء", formatDateTime(order.createdAt))}
    ${(() => {
      const tracking = getTrackingForOrder(order);
      return tracking ? infoRow("التتبع", hasTrackingLocation(tracking) ? (isTrackingLive(tracking) ? "مباشر الآن" : "آخر موقع محفوظ") : "بانتظار الموقع") : "";
    })()}
    ${showActions ? `
      <div class="actions single">
        <button class="details-btn" data-action="details-order">فتح التفاصيل</button>
        <select data-action="status-select">${statusOptions}</select>
        <button class="update-btn" data-action="update-status">حفظ الحالة</button>
        <button class="delete-btn" data-action="delete-order">حذف الطلب</button>
      </div>` : ""}`;
  if (showActions) {
    card.querySelector('[data-action="details-order"]').onclick = () => showOrderDetailsModal(order.docId);
    card.querySelector('[data-action="update-status"]').onclick = () => updateOrderStatus(order, card.querySelector('[data-action="status-select"]').value);
    card.querySelector('[data-action="delete-order"]').onclick = () => deleteOrder(order.docId);
  }
  return card;
}

function renderLoadsStats() {
  if (!$("loadsStats")) return;
  $("loadsStats").innerHTML = `
    ${buildMiniStat("كل الحمولات", allLoadsCache.length)}
    ${buildMiniStat("متاحة", allLoadsCache.filter((l) => l.status === "available").length)}
    ${buildMiniStat("محجوزة", allLoadsCache.filter((l) => l.status === "reserved").length)}
    ${buildMiniStat("تم التسليم", allLoadsCache.filter((l) => l.status === "delivered").length)}
    ${buildMiniStat("ملغاة", allLoadsCache.filter((l) => l.status === "cancelled").length)}
  `;
}

function renderLoadsStatusChips() {
  const container = $("loadsStatusChips");
  if (!container) return;
  const chips = [["all", "كل الحمولات"], ["available", "متاحة"], ["reserved", "محجوزة"], ["delivered", "تم التسليم"], ["cancelled", "ملغاة"]];
  container.innerHTML = "";
  chips.forEach(([value, label]) => {
    const btn = document.createElement("button");
    btn.className = loadsStatusFilter === value ? "status-chip active" : "status-chip";
    btn.textContent = label;
    btn.onclick = () => { loadsStatusFilter = value; if ($("loadsStatusFilter")) $("loadsStatusFilter").value = value; renderLoadsStatusChips(); renderLoads(); };
    container.appendChild(btn);
  });
}

function renderLoads() {
  const container = $("loadsList");
  if (!container) return;
  ensureStage3Toolbar("loads", "loadsList", "أدوات الحمولات");
  const text = loadsSearchText.toLowerCase();
  const loads = allLoadsCache.filter((l) => {
    const blob = `${loadNumberText(l)} ${l.loadType || ""} ${l.ownerName || ""} ${l.ownerPhone || ""} ${l.selectedDriverName || ""} ${l.selectedDriverPhone || ""} ${l.fromCity || ""} ${l.toCity || ""} ${l.fromGovernorate || ""} ${l.toGovernorate || ""} ${l.requiredTruckType || ""}`.toLowerCase();
    return (loadsSearchText === "" || blob.includes(text)) && (loadsStatusFilter === "all" || l.status === loadsStatusFilter);
  }).sort(byCreatedDesc);
  updateStage3Count("loads", loads.length, allLoadsCache.length);
  container.innerHTML = loads.length ? "" : `<div class="empty-box">لا توجد حمولات حسب الفلتر</div>`;
  loads.forEach((load) => container.appendChild(buildLoadCard(load, true)));
}

function buildLoadCard(load, showActions = true) {
  const card = document.createElement("div");
  card.className = "data-card";
  const statusOptions = loadStatuses.map((s) => `<option value="${s}" ${load.status === s ? "selected" : ""}>${loadStatusText(s)}</option>`).join("");
  card.innerHTML = `
    <div class="card-top">
      <div class="avatar">📦</div>
      <div class="card-title">
        <h3>${escapeHtml(loadNumberText(load))}</h3>
        <p>${escapeHtml(load.loadType || "حمولة بدون نوع")}</p>
      </div>
      <span class="badge ${badgeClassForStatus(load.status)}">${escapeHtml(loadStatusText(load.status))}</span>
    </div>
    ${infoRow("صاحب البضاعة", `${load.ownerName || "-"} ${load.ownerPhone ? " - " + load.ownerPhone : ""}`)}
    ${infoRow("المسار", `${load.fromGovernorate || load.fromCity || "-"} ← ${load.toGovernorate || load.toCity || "-"}`)}
    ${infoRow("المناطق", `${load.fromCity || "-"} ← ${load.toCity || "-"}`)}
    ${infoRow("نوع الشاحنة", load.requiredTruckType)}
    ${infoRow("الوزن", load.weight)}
    ${infoRow("السعر", load.price)}
    ${infoRow("السائق المختار", `${load.selectedDriverName || "-"} ${load.selectedDriverPhone ? " - " + load.selectedDriverPhone : ""}`)}
    ${infoRow("تاريخ النشر", formatDateTime(load.createdAt))}
    ${showActions ? `
      <div class="actions single">
        <button class="details-btn" data-action="details-load">فتح التفاصيل</button>
        <select data-action="load-status-select">${statusOptions}</select>
        <button class="update-btn" data-action="update-load">حفظ حالة الحمولة</button>
        <button class="delete-btn" data-action="delete-load">حذف الحمولة</button>
      </div>` : ""}`;
  if (showActions) {
    card.querySelector('[data-action="details-load"]').onclick = () => showLoadDetailsModal(load.docId);
    card.querySelector('[data-action="update-load"]').onclick = () => updateLoadStatus(load.docId, card.querySelector('[data-action="load-status-select"]').value);
    card.querySelector('[data-action="delete-load"]').onclick = () => deleteLoad(load.docId);
  }
  return card;
}


function renderTrackingStats() {
  if (!$("trackingStats")) return;

  const trackableOrders = allOrdersCache.filter((o) => {
    return ["مقبول", "تم التحميل", "في الطريق"].includes(o.status);
  });

  const knownLocations = trackableOrders.filter((order) => {
    return hasTrackingLocation(getTrackingForOrder(order));
  });

  const liveLocations = trackableOrders.filter((order) => {
    const tracking = getTrackingForOrder(order);
    return hasTrackingLocation(tracking) && isTrackingLive(tracking);
  });

  $("trackingStats").innerHTML = `
    ${buildMiniStat("طلبات قابلة للتتبع", trackableOrders.length)}
    ${buildMiniStat("مباشر الآن", liveLocations.length)}
    ${buildMiniStat("لديها آخر موقع", knownLocations.length)}
    ${buildMiniStat("بدون موقع", trackableOrders.length - knownLocations.length)}
  `;
}

function renderTracking() {
  const container = $("trackingList");
  if (!container) return;

  const text = trackingSearchText.toLowerCase();

  let orders = allOrdersCache.filter((order) => {
    return ["مقبول", "تم التحميل", "في الطريق"].includes(order.status);
  });

  orders = orders.filter((order) => {
    const tracking = getTrackingForOrder(order);
    const hasLocation = hasTrackingLocation(tracking);
    const isLive = isTrackingLive(tracking);

    const blob = `${orderNumberText(order)} ${order.title || ""} ${order.ownerName || ""} ${order.ownerPhone || ""} ${order.driverName || ""} ${order.driverPhone || ""} ${order.fromCity || ""} ${order.toCity || ""} ${order.fromGovernorate || ""} ${order.toGovernorate || ""}`.toLowerCase();

    const matchSearch = trackingSearchText === "" || blob.includes(text);

    const matchFilter =
      trackingStatusFilter === "all" ||
      (trackingStatusFilter === "active" && isLive && hasLocation) ||
      (trackingStatusFilter === "known" && hasLocation) ||
      (trackingStatusFilter === "no_location" && !hasLocation);

    return matchSearch && matchFilter;
  }).sort(byCreatedDesc);

  container.innerHTML = orders.length ? "" : `<div class="empty-box">لا توجد طلبات تتبع حسب الفلتر الحالي</div>`;

  orders.forEach((order) => {
    container.appendChild(buildTrackingCard(order));
  });
}

function buildTrackingCard(order) {
  const tracking = getTrackingForOrder(order);
  const lat = readNumber(tracking?.driverLat);
  const lng = readNumber(tracking?.driverLng);
  const hasLocation = lat !== null && lng !== null;
  const isLive = tracking?.isTracking === true;

  const card = document.createElement("div");
  card.className = "data-card tracking-card";

  card.innerHTML = `
    <div class="card-top">
      <div class="avatar">${isLive ? "📍" : "🛰️"}</div>
      <div class="card-title">
        <h3>${escapeHtml(orderNumberText(order))}</h3>
        <p>${escapeHtml(order.title || "طلب قابل للتتبع")}</p>
      </div>
      <span class="badge ${isLive && hasLocation ? "available" : hasLocation ? "active-order" : "pending"}">
        ${escapeHtml(isLive && hasLocation ? "مباشر الآن" : hasLocation ? "آخر موقع معروف" : "بانتظار الموقع")}
      </span>
    </div>

    ${infoRow("حالة الطلب", order.status)}
    ${infoRow("صاحب البضاعة", `${order.ownerName || "-"} ${order.ownerPhone ? " - " + order.ownerPhone : ""}`)}
    ${infoRow("السائق", `${order.driverName || "-"} ${order.driverPhone ? " - " + order.driverPhone : ""}`)}
    ${infoRow("المسار", `${order.fromGovernorate || order.fromCity || "-"} ← ${order.toGovernorate || order.toCity || "-"}`)}
    ${infoRow("آخر تحديث", formatDateTime(tracking?.updatedAt))}
    ${infoRow("الإحداثيات", hasLocation ? `${lat}, ${lng}` : "-")}

    <div class="tracking-map-box">
      ${
        hasLocation
          ? `<iframe loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.04}%2C${lat - 0.04}%2C${lng + 0.04}%2C${lat + 0.04}&layer=mapnik&marker=${lat}%2C${lng}"></iframe>`
          : `<div class="empty-map">لم يرسل السائق موقعاً بعد</div>`
      }
    </div>

    <div class="actions single">
      ${
        hasLocation
          ? `<button class="manage-btn" data-action="open-map">فتح الموقع على الخريطة</button>`
          : `<button class="manage-btn" disabled>لا يوجد موقع حالياً</button>`
      }
      <button class="update-btn" data-action="open-order">عرض الطلب</button>
    </div>
  `;

  if (hasLocation) {
    card.querySelector('[data-action="open-map"]').onclick = () => {
      window.open(googleMapsUrl(lat, lng), "_blank");
    };
  }

  card.querySelector('[data-action="open-order"]').onclick = () => {
    ordersSearchText = orderNumberText(order);
    if ($("ordersSearchInput")) $("ordersSearchInput").value = ordersSearchText;
    ordersStatusFilter = "all";
    if ($("ordersStatusFilter")) $("ordersStatusFilter").value = "all";
    showSection("orders");
    renderOrders();
  };

  return card;
}

function renderAvailabilityStats() {
  if (!$("availabilityStats")) return;
  const active = allAvailabilityCache.filter(isAvailabilityActive).length;
  $("availabilityStats").innerHTML = `
    ${buildMiniStat("كل السجلات", allAvailabilityCache.length)}
    ${buildMiniStat("متاح الآن", active)}
    ${buildMiniStat("موقوف / منتهي", allAvailabilityCache.length - active)}
  `;
}

function renderAvailability() {
  const container = $("availabilityList");
  if (!container) return;
  const text = availabilitySearchText.toLowerCase();
  const items = allAvailabilityCache.filter((a) => {
    const active = isAvailabilityActive(a);
    const blob = `${a.driverName || ""} ${a.name || ""} ${a.phone || ""} ${a.driverPhone || ""} ${a.truckType || ""} ${availabilityFrom(a)} ${availabilityTo(a)} ${a.notes || ""}`.toLowerCase();
    return (availabilitySearchText === "" || blob.includes(text)) &&
      (availabilityStatusFilter === "all" || (availabilityStatusFilter === "active" && active) || (availabilityStatusFilter === "inactive" && !active));
  }).sort(byCreatedDesc);
  container.innerHTML = items.length ? "" : `<div class="empty-box">لا توجد سجلات توفر حسب الفلتر</div>`;
  items.forEach((a) => container.appendChild(buildAvailabilityCard(a)));
}

function buildAvailabilityCard(a) {
  const active = isAvailabilityActive(a);
  const card = document.createElement("div");
  card.className = "data-card";
  card.innerHTML = `
    <div class="card-top">
      <div class="avatar">🟢</div>
      <div class="card-title">
        <h3>${escapeHtml(a.driverName || a.name || "سائق")}</h3>
        <p>${escapeHtml(a.phone || a.driverPhone || "-")}</p>
      </div>
      <span class="badge ${active ? "available" : "neutral"}">${active ? "متاح" : "غير متاح"}</span>
    </div>
    ${infoRow("نوع الشاحنة", a.truckType)}
    ${infoRow("من", availabilityFrom(a))}
    ${infoRow("إلى", availabilityTo(a))}
    ${infoRow("تاريخ الانطلاق", a.date)}
    ${infoRow("ينتهي التوفر", formatDateTime(a.availableUntil))}
    ${infoRow("ملاحظة", a.notes)}
    <div class="actions">
      <button class="warning-btn" data-action="stop">إيقاف التوفر</button>
      <button class="delete-btn" data-action="delete">حذف السجل</button>
    </div>`;
  card.querySelector('[data-action="stop"]').onclick = () => stopAvailability(a.docId);
  card.querySelector('[data-action="delete"]').onclick = () => deleteAvailability(a.docId);
  return card;
}

async function sha256Text(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isValidPin(password) {
  return /^\d{4}$/.test(password);
}


function showOrderDetailsModal(orderDocId) {
  const order = allOrdersCache.find((item) => item.docId === orderDocId || item.id === orderDocId);
  if (!order) {
    alert("لم يتم العثور على الطلب");
    return;
  }

  closeModal();

  const load = getLoadForOrder(order);
  const tracking = getTrackingForOrder(order);
  const owner = findUserByNameOrPhone(order.ownerName, order.ownerPhone, "owner");
  const driver = findUserByNameOrPhone(order.driverName, order.driverPhone, "driver");

  const hasLocation = hasTrackingLocation(tracking);
  const lat = hasLocation ? readNumber(tracking.driverLat) : null;
  const lng = hasLocation ? readNumber(tracking.driverLng) : null;

  const ownerWhatsApp = whatsappUrl(order.ownerName, order.ownerPhone);
  const driverWhatsApp = whatsappUrl(order.driverName, order.driverPhone);

  const modal = document.createElement("div");
  modal.id = "adminModal";
  modal.className = "admin-modal-overlay";
  modal.innerHTML = `
    <div class="admin-modal wide-modal details-modal">
      <div class="admin-modal-header details-modal-header">
        <div>
          <h2>تفاصيل الطلب ${escapeHtml(orderNumberText(order))}</h2>
          <p>${escapeHtml(order.title || "طلب بدون عنوان")}</p>
        </div>
        <button class="modal-close-btn" data-action="close">×</button>
      </div>

      <div class="admin-modal-body">
        <div class="details-summary-row">
          <div class="summary-pill"><span>الحالة</span><b>${escapeHtml(order.status || "غير محدد")}</b></div>
          <div class="summary-pill"><span>نوع الطلب</span><b>${escapeHtml(order.requestType === "driver_to_load" ? "طلب على حمولة" : "بحث عن سائق")}</b></div>
          <div class="summary-pill"><span>السعر</span><b>${escapeHtml(order.price || "-")}</b></div>
          <div class="summary-pill"><span>التتبع</span><b>${escapeHtml(hasLocation ? (isTrackingLive(tracking) ? "مباشر الآن" : "آخر موقع محفوظ") : "لا يوجد موقع")}</b></div>
        </div>

        <div class="details-grid">
          <div class="details-card">
            <h3>صاحب البضاعة</h3>
            ${detailRow("الاسم", order.ownerName)}
            ${detailRow("الهاتف", order.ownerPhone)}
            ${detailRow("حالة الحساب", owner ? getUserStatusText(owner) : "غير مربوط بحساب")}
            ${ownerWhatsApp ? detailLink("واتساب", "فتح محادثة", ownerWhatsApp) : detailRow("واتساب", "لا يوجد رقم")}
          </div>

          <div class="details-card">
            <h3>السائق</h3>
            ${detailRow("الاسم", order.driverName)}
            ${detailRow("الهاتف", order.driverPhone)}
            ${detailRow("نوع الشاحنة", order.driverTruckType)}
            ${detailRow("حالة الحساب", driver ? getUserStatusText(driver) : "غير مربوط بحساب")}
            ${driverWhatsApp ? detailLink("واتساب", "فتح محادثة", driverWhatsApp) : detailRow("واتساب", "لا يوجد رقم")}
          </div>

          <div class="details-card">
            <h3>المسار والحمولة</h3>
            ${detailRow("من", `${order.fromGovernorate || "-"} / ${order.fromCity || "-"}`)}
            ${detailRow("إلى", `${order.toGovernorate || "-"} / ${order.toCity || "-"}`)}
            ${detailRow("نوع الحمولة", order.loadType || load?.loadType)}
            ${detailRow("وزن الحمولة", order.weight || load?.weight)}
            ${detailRow("رقم الحمولة", load ? loadNumberText(load) : (order.loadId || "-"))}
          </div>

          <div class="details-card">
            <h3>التتبع</h3>
            ${detailRow("الحالة", hasLocation ? (isTrackingLive(tracking) ? "مباشر الآن" : "آخر موقع محفوظ") : "بانتظار الموقع")}
            ${detailRow("آخر تحديث", formatDateTime(tracking?.updatedAt || tracking?.lastUpdatedAt || tracking?.createdAt))}
            ${detailRow("الإحداثيات", hasLocation ? `${lat}, ${lng}` : "-")}
            ${hasLocation ? detailLink("الخريطة", "فتح على Google Maps", googleMapsUrl(lat, lng)) : detailRow("الخريطة", "لا يوجد موقع")}
          </div>
        </div>

        <div class="details-card full-width">
          <h3>خط سير الطلب</h3>
          <div class="timeline-list">
            ${buildTimelineItem("🟡", "إنشاء الطلب", formatDateTime(order.createdAt))}
            ${buildTimelineItem("✅", "قبول الطلب", formatDateTime(order.acceptedAt), !order.acceptedAt)}
            ${buildTimelineItem("📦", "تم التحميل", formatDateTime(order.loadedAt), !order.loadedAt)}
            ${buildTimelineItem("🚚", "في الطريق", order.status === "في الطريق" ? "نشط حالياً" : "-", order.status !== "في الطريق")}
            ${buildTimelineItem("🏁", "تم التسليم", formatDateTime(order.deliveredAt), !order.deliveredAt)}
          </div>
        </div>

        <div class="modal-actions-row">
          ${owner ? `<button class="manage-btn" data-action="manage-owner">إدارة صاحب البضاعة</button>` : ""}
          ${driver ? `<button class="manage-btn" data-action="manage-driver">إدارة السائق</button>` : ""}
          ${load ? `<button class="details-btn" data-action="open-load">تفاصيل الحمولة</button>` : ""}
          ${hasLocation ? `<button class="update-btn" data-action="open-map">فتح الخريطة</button>` : ""}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('[data-action="close"]').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  modal.querySelector('[data-action="manage-owner"]')?.addEventListener("click", () => showManageUserModal(owner.docId, owner));
  modal.querySelector('[data-action="manage-driver"]')?.addEventListener("click", () => showManageUserModal(driver.docId, driver));
  modal.querySelector('[data-action="open-load"]')?.addEventListener("click", () => showLoadDetailsModal(load.docId));
  modal.querySelector('[data-action="open-map"]')?.addEventListener("click", () => window.open(googleMapsUrl(lat, lng), "_blank"));
}

function showLoadDetailsModal(loadDocId) {
  const load = allLoadsCache.find((item) => item.docId === loadDocId || item.id === loadDocId);
  if (!load) {
    alert("لم يتم العثور على الحمولة");
    return;
  }

  closeModal();

  const owner = findUserByNameOrPhone(load.ownerName, load.ownerPhone, "owner");
  const orders = getOrdersForLoad(load);
  const acceptedOrder = orders.find((order) => ["مقبول", "تم التحميل", "في الطريق", "تم التسليم"].includes(order.status));
  const selectedDriver = findUserByNameOrPhone(load.selectedDriverName || acceptedOrder?.driverName, load.selectedDriverPhone || acceptedOrder?.driverPhone, "driver");
  const ownerWhatsApp = whatsappUrl(load.ownerName, load.ownerPhone);
  const driverWhatsApp = whatsappUrl(load.selectedDriverName || acceptedOrder?.driverName, load.selectedDriverPhone || acceptedOrder?.driverPhone);

  const modal = document.createElement("div");
  modal.id = "adminModal";
  modal.className = "admin-modal-overlay";
  modal.innerHTML = `
    <div class="admin-modal wide-modal details-modal">
      <div class="admin-modal-header details-modal-header">
        <div>
          <h2>تفاصيل الحمولة ${escapeHtml(loadNumberText(load))}</h2>
          <p>${escapeHtml(load.loadType || "حمولة بدون نوع")}</p>
        </div>
        <button class="modal-close-btn" data-action="close">×</button>
      </div>

      <div class="admin-modal-body">
        <div class="details-summary-row">
          <div class="summary-pill"><span>الحالة</span><b>${escapeHtml(loadStatusText(load.status))}</b></div>
          <div class="summary-pill"><span>نوع الشاحنة</span><b>${escapeHtml(load.requiredTruckType || "-")}</b></div>
          <div class="summary-pill"><span>الوزن</span><b>${escapeHtml(load.weight || "-")}</b></div>
          <div class="summary-pill"><span>السعر</span><b>${escapeHtml(load.price || "-")}</b></div>
        </div>

        <div class="details-grid">
          <div class="details-card">
            <h3>صاحب البضاعة</h3>
            ${detailRow("الاسم", load.ownerName)}
            ${detailRow("الهاتف", load.ownerPhone)}
            ${detailRow("حالة الحساب", owner ? getUserStatusText(owner) : "غير مربوط بحساب")}
            ${ownerWhatsApp ? detailLink("واتساب", "فتح محادثة", ownerWhatsApp) : detailRow("واتساب", "لا يوجد رقم")}
          </div>

          <div class="details-card">
            <h3>السائق المختار</h3>
            ${detailRow("الاسم", load.selectedDriverName || acceptedOrder?.driverName)}
            ${detailRow("الهاتف", load.selectedDriverPhone || acceptedOrder?.driverPhone)}
            ${detailRow("حالة الحساب", selectedDriver ? getUserStatusText(selectedDriver) : "لا يوجد / غير مربوط")}
            ${driverWhatsApp ? detailLink("واتساب", "فتح محادثة", driverWhatsApp) : detailRow("واتساب", "لا يوجد رقم")}
          </div>

          <div class="details-card">
            <h3>المسار</h3>
            ${detailRow("من", `${load.fromGovernorate || "-"} / ${load.fromCity || "-"}`)}
            ${detailRow("إلى", `${load.toGovernorate || "-"} / ${load.toCity || "-"}`)}
            ${detailRow("تاريخ التحميل", formatDateTime(load.pickupDate || load.date || load.createdAt))}
            ${detailRow("تاريخ النشر", formatDateTime(load.createdAt))}
          </div>

          <div class="details-card">
            <h3>تفاصيل البضاعة</h3>
            ${detailRow("نوع الحمولة", load.loadType)}
            ${detailRow("ملاحظات", load.note || load.description)}
            ${detailRow("رقم الحمولة", loadNumberText(load))}
            ${detailRow("عدد الطلبات عليها", orders.length)}
          </div>
        </div>

        <div class="details-card full-width">
          <h3>الطلبات المرتبطة بهذه الحمولة</h3>
          ${orders.length ? `
            <div class="related-list">
              ${orders.map((order) => `
                <button class="related-item" data-order-id="${escapeHtml(order.docId)}">
                  <span>
                    <b>${escapeHtml(orderNumberText(order))}</b>
                    <small>${escapeHtml(order.driverName || "سائق غير محدد")} • ${escapeHtml(formatDateTime(order.createdAt))}</small>
                  </span>
                  <em class="badge ${badgeClassForStatus(order.status)}">${escapeHtml(order.status || "-")}</em>
                </button>
              `).join("")}
            </div>
          ` : `<div class="empty-box">لا توجد طلبات مرتبطة بهذه الحمولة بعد</div>`}
        </div>

        <div class="modal-actions-row">
          ${owner ? `<button class="manage-btn" data-action="manage-owner">إدارة صاحب البضاعة</button>` : ""}
          ${selectedDriver ? `<button class="manage-btn" data-action="manage-driver">إدارة السائق</button>` : ""}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('[data-action="close"]').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  modal.querySelector('[data-action="manage-owner"]')?.addEventListener("click", () => showManageUserModal(owner.docId, owner));
  modal.querySelector('[data-action="manage-driver"]')?.addEventListener("click", () => showManageUserModal(selectedDriver.docId, selectedDriver));
  modal.querySelectorAll("[data-order-id]").forEach((btn) => {
    btn.addEventListener("click", () => showOrderDetailsModal(btn.dataset.orderId));
  });
}



function adminLogMatchesUser(log, user) {
  const d = log.details || {};
  const userId = String(user.docId || user.uid || "");
  const phone = cleanPhone(user.phone || "");

  const logIds = [
    log.targetUserId,
    log.userId,
    d.targetUserId,
    d.userId,
    d.docId,
  ].map((value) => String(value || "")).filter(Boolean);

  const logPhones = [
    log.targetUserPhone,
    log.userPhone,
    d.targetUserPhone,
    d.userPhone,
    d.phone,
  ].map((value) => cleanPhone(String(value || ""))).filter(Boolean);

  return (userId && logIds.includes(userId)) || (phone && logPhones.includes(phone));
}

async function fetchAdminLogsForUser(user, maxLogs = 200) {
  try {
    const snapshot = await getDocs(
      query(collection(db, "admin_logs"), orderBy("createdAt", "desc"), limit(maxLogs))
    );

    return snapshot.docs
      .map((d) => ({ docId: d.id, ...d.data() }))
      .filter((log) => adminLogMatchesUser(log, user))
      .sort(byCreatedDesc);
  } catch (error) {
    console.error("Failed to fetch user admin logs:", error);

    return allAdminLogsCache
      .filter((log) => adminLogMatchesUser(log, user))
      .sort(byCreatedDesc);
  }
}

function buildUserAdminLogItem(log) {
  return `
    <div class="user-admin-log-item ${actionColorClass(log.action)}">
      <div class="log-icon">${actionIcon(log.action)}</div>
      <div class="log-content">
        <div class="log-title-row">
          <b>${escapeHtml(actionLabel(log.action))}</b>
          <span>${escapeHtml(formatDateTimeDisplay(log.createdAt))}</span>
        </div>
        <p>${escapeHtml(logDetailsText(log))}</p>
        <small>بواسطة: ${escapeHtml(log.adminName || "admin")}</small>
      </div>
    </div>
  `;
}

async function showUserAdminLogsModal(user) {
  const oldModal = $("userAdminLogsModal");
  if (oldModal) oldModal.remove();

  const overlay = document.createElement("div");
  overlay.id = "userAdminLogsModal";
  overlay.className = "admin-modal-overlay user-logs-overlay";
  overlay.innerHTML = `
    <div class="admin-modal user-logs-modal">
      <div class="admin-modal-header">
        <div>
          <h2>السجل الإداري</h2>
          <p>${escapeHtml(user.name || "مستخدم")} - ${escapeHtml(user.phone || "-")}</p>
        </div>
        <button class="modal-close-btn" data-action="close-user-logs">×</button>
      </div>
      <div class="admin-modal-body">
        <div id="userAdminLogsList" class="user-admin-logs-list">
          <div class="empty-box">جار تحميل السجل...</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('[data-action="close-user-logs"]').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const list = $("userAdminLogsList");
  const logs = await fetchAdminLogsForUser(user, 250);

  if (!list) return;

  if (!logs.length) {
    list.innerHTML = `<div class="empty-box">لا يوجد سجل إداري لهذا المستخدم بعد</div>`;
    return;
  }

  list.innerHTML = logs.map(buildUserAdminLogItem).join("");
}


function showManageUserModal(docId, user) {

  window.currentManageUserId = (typeof docId !== "undefined" ? docId : "") || (typeof user !== "undefined" ? user?.docId : "") || (typeof id !== "undefined" ? id : "") || (typeof userId !== "undefined" ? userId : "") || "";
  window.currentSubscriptionUserId = window.currentManageUserId;
  closeModal();
  const modal = document.createElement("div");
  modal.id = "adminModal";
  modal.className = "admin-modal-overlay";
  const orders = getUserOrders(user).slice(0, 8);
  const loads = getOwnerLoads(user).slice(0, 8);
  modal.innerHTML = `
    <div class="admin-modal">
      <div class="admin-modal-header">
        <div><h2>إدارة المستخدم</h2><p>${escapeHtml(user.name || "بدون اسم")}</p></div>
        <button class="modal-close-btn" data-action="close">×</button>
      </div>
      <div class="admin-modal-body">
        <div class="modal-grid">
          <div><label>الاسم</label><input id="editUserName" value="${escapeHtml(user.name || "")}" /></div>
          <div><label>رقم الهاتف</label><input id="editUserPhone" value="${escapeHtml(user.phone || "")}" /></div>
          <div><label>الإيميل</label><input id="editUserEmail" value="${escapeHtml(user.email || "")}" /></div>
          <div><label>نوع الحساب</label><select id="editUserRole">
            <option value="driver" ${user.role === "driver" ? "selected" : ""}>سائق</option>
            <option value="owner" ${user.role === "owner" ? "selected" : ""}>صاحب بضاعة</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>أدمن</option>
          </select></div>
          <div><label>التوثيق</label><select id="editUserVerified">
            <option value="true" ${user.isVerified === true ? "selected" : ""}>موثق</option>
            <option value="false" ${user.isVerified !== true ? "selected" : ""}>غير موثق</option>
          </select></div>
          <div><label>الحساب</label><select id="editUserActive">
            <option value="true" ${user.isActive !== false ? "selected" : ""}>فعال</option>
            <option value="false" ${user.isActive === false ? "selected" : ""}>محظور</option>
          </select></div>
        </div>
        <label>ملاحظة إدارية</label>
        <textarea id="editUserAdminNote" placeholder="ملاحظة لا تظهر للمستخدم">${escapeHtml(user.adminNote || "")}</textarea>

        <div class="subscription-panel">
          <div class="subscription-panel-head">
            <div>
              <h3>إدارة الاشتراك</h3>
              <p>${escapeHtml(subscriptionSummaryText(user))}</p>
            </div>
            <div class="subscription-panel-head-actions">
              <button type="button" class="light-btn user-log-btn" data-action="user-admin-logs">السجل الإداري</button>
              <span class="subscription-status-badge ${subscriptionStatusClass(user)}">${escapeHtml(subscriptionBadgeText(user))}</span>
            </div>
          </div>

          <div class="manual-subscription-box">
            <h4>تجديد / تعديل يدوي</h4>
            <p>هنا تقدر تحدد تاريخ البداية والنهاية والساعة يدويًا.</p>

            <div class="modal-grid">
              <div>
                <label>حالة الاشتراك</label>
                <select id="subscriptionStatusInput">${subscriptionOptionsHtml(user.subscriptionStatus || "free")}</select>
              </div>
              <div>
                <label>اسم الخطة</label>
                <input id="subscriptionPlanInput" value="${escapeHtml(user.subscriptionPlanName || "")}" placeholder="مثال: شهري / 6 أشهر / تجريبي" />
              </div>
              <div>
                <label>تاريخ البداية</label>
                <input id="subscriptionStartInput" type="date" value="${escapeHtml(formatInputDate(user.subscriptionStartDate))}" />
              </div>
              <div>
                <label>ساعة البداية</label>
                <input id="subscriptionStartTimeInput" type="time" value="${escapeHtml(formatInputTime(user.subscriptionStartDate))}" />
              </div>
              <div>
                <label>تاريخ النهاية</label>
                <input id="subscriptionEndInput" type="date" value="${escapeHtml(formatInputDate(user.subscriptionEndDate))}" />
              </div>
              <div>
                <label>ساعة النهاية</label>
                <input id="subscriptionEndTimeInput" type="time" value="${escapeHtml(formatInputTime(user.subscriptionEndDate))}" />
              </div>
              <div>
                <label>المبلغ</label>
                <input id="subscriptionAmountInput" type="number" min="0" value="${escapeHtml(user.subscriptionAmount || 0)}" />
              </div>
              <div>
                <label>العملة</label>
                <input id="subscriptionCurrencyInput" value="${escapeHtml(user.subscriptionCurrency || "TRY")}" />
              </div>
              <div>
                <label>طريقة الدفع</label>
                <input id="subscriptionPaymentMethodInput" value="${escapeHtml(user.subscriptionPaymentMethod || "")}" placeholder="كاش / حوالة / يدوي" />
              </div>
              <div>
                <label>الأيام المتبقية</label>
                <input value="${escapeHtml(subscriptionRemainingDays(user))}" readonly />
              </div>
            </div>

            <label>ملاحظة الاشتراك</label>
            <textarea id="subscriptionNoteInput" placeholder="ملاحظة عن الدفع أو الاشتراك">${escapeHtml(user.subscriptionNote || "")}</textarea>

            <div class="subscription-actions single-action">
              <button type="button" class="success-btn" data-action="subscription-save">حفظ يدوي</button>
            </div>
          </div>

          <div class="subscription-action-group renew">
            <h4>تجديد من اليوم</h4>
            <p>يبدأ من اليوم ويستبدل تاريخ الاشتراك القديم.</p>
            <div class="subscription-actions">
              <button type="button" class="trial-btn" data-action="subscription-free6">6 أشهر مجانية</button>
              <button type="button" class="renew-btn" data-action="subscription-renew-1">تجديد شهر</button>
              <button type="button" class="renew-btn" data-action="subscription-renew-3">تجديد 3 أشهر</button>
              <button type="button" class="renew-btn" data-action="subscription-renew-6">تجديد 6 أشهر</button>
              <button type="button" class="renew-btn" data-action="subscription-renew-12">تجديد 12 شهر</button>
            </div>
          </div>

          <div class="subscription-action-group extend">
            <h4>تمديد فوق الحالي</h4>
            <p>يضيف مدة فوق تاريخ نهاية الاشتراك الحالي.</p>
            <div class="subscription-actions">
              <button type="button" class="extend-btn" data-action="subscription-extend-1">تمديد شهر</button>
              <button type="button" class="extend-btn" data-action="subscription-extend-3">تمديد 3 أشهر</button>
              <button type="button" class="extend-btn" data-action="subscription-extend-6">تمديد 6 أشهر</button>
              <button type="button" class="extend-btn" data-action="subscription-extend-12">تمديد 12 شهر</button>
              <button type="button" class="danger-btn" data-action="subscription-stop">إيقاف الاشتراك</button>
            </div>
          </div>
        </div>

        <div class="modal-actions-row">
          <button class="update-btn" data-action="save">حفظ التعديلات</button>
          <button class="password-btn" data-action="password">تعيين كلمة مرور</button>
          <button class="delete-btn" data-action="delete">حذف المستخدم</button>
        </div>
        <div class="mini-box"><h3>آخر طلبات المستخدم (${getUserOrders(user).length})</h3>${orders.length ? orders.map((o) => `<div class="mini-card"><div><b>${escapeHtml(orderNumberText(o))}</b><p>${escapeHtml(o.title || "-")}</p></div><span class="badge ${badgeClassForStatus(o.status)}">${escapeHtml(o.status || "-")}</span></div>`).join("") : `<div class="empty-box">لا توجد طلبات</div>`}</div>
        ${user.role === "owner" ? `<div class="mini-box"><h3>آخر حمولات صاحب البضاعة (${getOwnerLoads(user).length})</h3>${loads.length ? loads.map((l) => `<div class="mini-card"><div><b>${escapeHtml(loadNumberText(l))}</b><p>${escapeHtml(l.loadType || "-")}</p></div><span class="badge ${badgeClassForStatus(l.status)}">${escapeHtml(loadStatusText(l.status))}</span></div>`).join("") : `<div class="empty-box">لا توجد حمولات</div>`}</div>` : ""}
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('[data-action="close"]').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  modal.querySelector('[data-action="save"]').onclick = () => saveUserFromModal(docId);
  modal.querySelector('[data-action="password"]').onclick = () => resetUserPassword(docId, user);
  modal.querySelector('[data-action="delete"]').onclick = () => deleteUser(docId, user);
  modal.querySelector('[data-action="user-admin-logs"]')?.addEventListener("click", () => showUserAdminLogsModal(user));
  modal.querySelector('[data-action="subscription-save"]')?.addEventListener("click", () => saveSubscriptionFromModal(docId, user));
  modal.querySelector('[data-action="subscription-free6"]')?.addEventListener("click", () => renewSubscription(docId, user, 6, "trial", "6 أشهر مجانية"));
  modal.querySelector('[data-action="subscription-renew-1"]')?.addEventListener("click", () => renewSubscription(docId, user, 1, "active", "اشتراك شهر"));
  modal.querySelector('[data-action="subscription-renew-3"]')?.addEventListener("click", () => renewSubscription(docId, user, 3, "active", "اشتراك 3 أشهر"));
  modal.querySelector('[data-action="subscription-renew-6"]')?.addEventListener("click", () => renewSubscription(docId, user, 6, "active", "اشتراك 6 أشهر"));
  modal.querySelector('[data-action="subscription-renew-12"]')?.addEventListener("click", () => renewSubscription(docId, user, 12, "active", "اشتراك 12 شهر"));
  modal.querySelector('[data-action="subscription-extend-1"]')?.addEventListener("click", () => extendSubscription(docId, user, 1, "active", "اشتراك شهر"));
  modal.querySelector('[data-action="subscription-extend-3"]')?.addEventListener("click", () => extendSubscription(docId, user, 3, "active", "اشتراك 3 أشهر"));
  modal.querySelector('[data-action="subscription-extend-6"]')?.addEventListener("click", () => extendSubscription(docId, user, 6, "active", "اشتراك 6 أشهر"));
  modal.querySelector('[data-action="subscription-extend-12"]')?.addEventListener("click", () => extendSubscription(docId, user, 12, "active", "اشتراك 12 شهر"));
  modal.querySelector('[data-action="subscription-stop"]')?.addEventListener("click", () => stopSubscription(docId, user));
}

function closeModal() {
  document.getElementById("adminModal")?.remove();
}

async function saveUserFromModal(docId) {
  const oldUser = allUsersCache.find((u) => u.docId === docId) || {};
  const name = $("editUserName").value.trim();
  const phone = cleanPhone($("editUserPhone").value);
  const email = $("editUserEmail").value.trim();
  const role = $("editUserRole").value;
  const isVerified = $("editUserVerified").value === "true";
  const isActive = $("editUserActive").value === "true";
  const adminNote = $("editUserAdminNote").value.trim();
  if (!name || !phone) return alert("الاسم ورقم الهاتف مطلوبين");
  if (!confirm("حفظ تعديلات المستخدم؟")) return;
  await updateDoc(doc(db, "users", docId), { name, phone, email, role, isVerified, isActive, adminNote, updatedAt: serverTimestamp() });

  const changes = [];
  if ((oldUser.name || "") !== name) changes.push("الاسم");
  if (cleanPhone(oldUser.phone || "") !== phone) changes.push("الهاتف");
  if ((oldUser.email || "") !== email) changes.push("الإيميل");
  if ((oldUser.role || "") !== role) changes.push("نوع الحساب");
  if ((oldUser.isVerified === true) !== isVerified) changes.push(isVerified ? "توثيق" : "إلغاء توثيق");
  if ((oldUser.isActive !== false) !== isActive) changes.push(isActive ? "فك حظر" : "حظر");

  const grantedTrial = (!oldUser.isVerified && isVerified)
    ? await grantFreeTrialAfterVerification(docId, { ...oldUser, name, phone, role })
    : null;

  await addAdminLog("update_user", {
    docId,
    targetUserId: docId,
    targetUserName: name,
    targetUserPhone: phone,
    targetUserRole: role,
    name,
    phone,
    role,
    changes: changes.join("، ") || "تعديل بيانات",
    freeTrialGranted: !!grantedTrial,
  });

  closeModal();
  toast(grantedTrial ? "تم حفظ المستخدم ومنحه المدة المجانية بعد التوثيق" : "تم حفظ المستخدم");
}

async function resetUserPassword(docId, user) {
  const phone = cleanPhone(user.phone || "");
  if (!phone) return alert("لا يوجد رقم هاتف لهذا المستخدم");
  const password = prompt("اكتب كلمة مرور جديدة من 4 أرقام");
  if (password === null) return;
  if (!isValidPin(password.trim())) return alert("كلمة المرور يجب أن تكون 4 أرقام");
  const confirmPassword = prompt("أعد كتابة كلمة المرور");
  if (confirmPassword === null || confirmPassword.trim() !== password.trim()) return alert("كلمة المرور غير متطابقة");
  const passwordHash = await sha256Text(`${phone}_${password.trim()}`);
  await updateDoc(doc(db, "users", docId), { passwordHash, mustChangePassword: true, updatedAt: serverTimestamp() });
  toast("تم تعيين كلمة المرور");
}


async function getFreeTrialSettings() {
  try {
    const snapshot = await getDoc(doc(db, "app_config", "settings"));
    const data = snapshot.exists() ? snapshot.data() : {};
    const enabled = data.freeTrialEnabled === true;
    const months = Number(data.freeMonths ?? 6);

    return {
      enabled,
      months: Number.isFinite(months) ? Math.max(0, months) : 6,
    };
  } catch (error) {
    console.error("Failed to read free trial settings:", error);
    return { enabled: false, months: 0 };
  }
}

function userAlreadyHadFreeTrial(user = {}) {
  return !!user.freeTrialGrantedAt || user.freeTrialMonths > 0;
}

function userHasActiveOrTrialSubscription(user = {}) {
  const status = String(user.subscriptionStatus || "");
  return (status === "trial" || status === "active") && !subscriptionIsExpired(user);
}

async function grantFreeTrialAfterVerification(docId, user = {}) {
  const trialSettings = await getFreeTrialSettings();
  const freeMonths = trialSettings.enabled ? trialSettings.months : 0;

  if (!trialSettings.enabled || freeMonths <= 0) {
    return null;
  }

  if (userAlreadyHadFreeTrial(user) || userHasActiveOrTrialSubscription(user)) {
    return null;
  }

  const startDate = new Date();
  const endDate = addMonthsToDate(startDate, freeMonths);

  const payload = {
    subscriptionStatus: "trial",
    subscriptionPlanName: `تجريبي ${freeMonths} شهر`,
    subscriptionStartDate: startDate,
    subscriptionEndDate: endDate,
    subscriptionAmount: 0,
    subscriptionCurrency: "TRY",
    subscriptionPaymentMethod: "free_trial",
    subscriptionNote: "مدة مجانية تلقائية بعد التوثيق",
    isSubscriptionActive: true,
    freeTrialMonths: freeMonths,
    freeTrialGrantedAt: serverTimestamp(),
    subscriptionUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", docId), payload, { merge: true });

  await writeSubscriptionHistory(docId, user, payload, "subscription_trial_grant");

  await addAdminLog("subscription_trial_grant", {
    docId,
    targetUserId: docId,
    targetUserName: user.name || "",
    targetUserPhone: user.phone || "",
    targetUserRole: user.role || "",
    name: user.name || "",
    phone: user.phone || "",
    role: user.role || "",
    status: "trial",
    newStatus: "trial",
    startDate: formatDateTimeDisplay(startDate),
    endDate: formatDateTimeDisplay(endDate),
    freeMonths,
    plan: payload.subscriptionPlanName,
  });

  return payload;
}


async function verifyUser(docId) {
  const user = allUsersCache.find((u) => u.docId === docId) || {};
  if (!confirm("توثيق وتفعيل هذا المستخدم؟\n\nسيتم منح المدة المجانية من إعدادات الإدارة إذا لم يأخذها سابقاً.")) return;

  await updateDoc(doc(db, "users", docId), {
    isVerified: true,
    isActive: true,
    updatedAt: serverTimestamp(),
  });

  const grantedTrial = await grantFreeTrialAfterVerification(docId, user);

  await addAdminLog("verify_user", {
    docId,
    targetUserId: docId,
    targetUserName: user.name || "",
    targetUserPhone: user.phone || "",
    targetUserRole: user.role || "",
    name: user.name || "",
    phone: user.phone || "",
    role: user.role || "",
    freeTrialGranted: !!grantedTrial,
    freeMonths: grantedTrial?.freeTrialMonths || 0,
  });

  toast(grantedTrial ? "تم توثيق المستخدم ومنحه المدة المجانية" : "تم توثيق المستخدم");
}

async function unverifyUser(docId) {
  const user = allUsersCache.find((u) => u.docId === docId) || {};
  if (!confirm("إلغاء توثيق هذا المستخدم؟")) return;
  await updateDoc(doc(db, "users", docId), { isVerified: false, updatedAt: serverTimestamp() });
  await addAdminLog("unverify_user", { docId, name: user.name || "", phone: user.phone || "", role: user.role || "" });
  toast("تم إلغاء التوثيق");
}

async function blockUser(docId) {
  const user = allUsersCache.find((u) => u.docId === docId) || {};
  if (!confirm("حظر هذا المستخدم؟")) return;
  await updateDoc(doc(db, "users", docId), { isActive: false, updatedAt: serverTimestamp() });
  await addAdminLog("block_user", { docId, name: user.name || "", phone: user.phone || "", role: user.role || "" });
  toast("تم حظر المستخدم");
}

async function unblockUser(docId) {
  const user = allUsersCache.find((u) => u.docId === docId) || {};
  if (!confirm("فك حظر هذا المستخدم؟")) return;
  await updateDoc(doc(db, "users", docId), { isActive: true, updatedAt: serverTimestamp() });
  await addAdminLog("unblock_user", { docId, name: user.name || "", phone: user.phone || "", role: user.role || "" });
  toast("تم فك الحظر");
}

async function deleteUser(docId, user) {
  const name = user.name || "المستخدم";
  if (!confirm(`حذف بيانات المستخدم من Firestore؟\n${name}`)) return;
  if (prompt("للتأكيد اكتب: حذف") !== "حذف") return;

  await addAdminLog("delete_user", {
    docId,
    targetUserId: docId,
    targetUserName: user.name || "",
    targetUserPhone: user.phone || "",
    targetUserRole: user.role || "",
    name: user.name || "",
    phone: user.phone || "",
    role: user.role || "",
  });

  await deleteDoc(doc(db, "users", docId));
  closeModal();
  toast("تم حذف المستخدم");
}

function openWhatsApp(user) {
  const phone = cleanPhone(user.phone || "");
  if (!phone) return alert("لا يوجد رقم هاتف");
  const message = encodeURIComponent(`مرحباً ${user.name || ""}\nنحن إدارة تطبيق حمولتي.\nنرغب بالتواصل معك بخصوص حسابك.`);
  window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
}

async function updateOrderStatus(order, status) {
  if (!confirm(`تغيير حالة الطلب ${orderNumberText(order)} إلى: ${status} ؟`)) return;
  const oldStatus = order.status || "";
  await updateDoc(doc(db, "orders", order.docId), { status, updatedAt: serverTimestamp() });
  if (order.loadId && order.requestType === "driver_to_load") {
    if (status === "تم التسليم") {
      await setDoc(doc(db, "loads", order.loadId), { status: "delivered", deliveredAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    }
    if (status === "مقبول") {
      await setDoc(doc(db, "loads", order.loadId), { status: "reserved", selectedDriverName: order.driverName || "", selectedDriverPhone: order.driverPhone || "", updatedAt: serverTimestamp() }, { merge: true });
    }
    if (status === "ملغي" || status === "مرفوض") {
      await setDoc(doc(db, "loads", order.loadId), { status: "available", selectedDriverName: "", selectedDriverPhone: "", updatedAt: serverTimestamp() }, { merge: true });
    }
  }
  await addAdminLog("update_order_status", {
    docId: order.docId,
    orderNumber: orderNumberText(order),
    oldStatus,
    newStatus: status,
    ownerName: order.ownerName || "",
    driverName: order.driverName || "",
  });
  toast("تم تحديث حالة الطلب");
}

async function deleteOrder(docId) {
  const order = allOrdersCache.find((o) => o.docId === docId) || {};
  if (!confirm("حذف هذا الطلب نهائياً؟")) return;
  if (prompt("للتأكيد اكتب: حذف") !== "حذف") return;
  await deleteDoc(doc(db, "orders", docId));
  await addAdminLog("delete_order", {
    docId,
    orderNumber: orderNumberText(order),
    ownerName: order.ownerName || "",
    driverName: order.driverName || "",
    status: order.status || "",
  });
  toast("تم حذف الطلب");
}

async function updateLoadStatus(docId, status) {
  const load = allLoadsCache.find((l) => l.docId === docId) || {};
  if (!confirm(`تغيير حالة الحمولة إلى: ${loadStatusText(status)} ؟`)) return;
  const oldStatus = load.status || "";
  await setDoc(doc(db, "loads", docId), { status, updatedAt: serverTimestamp() }, { merge: true });
  await addAdminLog("update_load_status", {
    docId,
    loadNumber: loadNumberText(load),
    oldStatus,
    newStatus: status,
    ownerName: load.ownerName || "",
  });
  toast("تم تحديث حالة الحمولة");
}

async function deleteLoad(docId) {
  const load = allLoadsCache.find((l) => l.docId === docId) || {};
  if (!confirm("حذف هذه الحمولة نهائياً؟")) return;
  if (prompt("للتأكيد اكتب: حذف") !== "حذف") return;
  await deleteDoc(doc(db, "loads", docId));
  await addAdminLog("delete_load", {
    docId,
    loadNumber: loadNumberText(load),
    ownerName: load.ownerName || "",
    status: load.status || "",
  });
  toast("تم حذف الحمولة");
}

async function stopAvailability(docId) {
  if (!confirm("إيقاف توفر هذا السائق؟")) return;
  await setDoc(doc(db, "driver_availability", docId), { isActive: false, updatedAt: serverTimestamp() }, { merge: true });
  toast("تم إيقاف التوفر");
}

async function deleteAvailability(docId) {
  if (!confirm("حذف سجل التوفر؟")) return;
  await deleteDoc(doc(db, "driver_availability", docId));
  toast("تم حذف سجل التوفر");
}

window.saveGlobalMessage = async function () {
  const title = $("globalMessageTitle").value.trim();
  const body = $("globalMessageBody").value.trim();
  const isActive = $("globalMessageActive").checked;
  const showEveryTime = $("globalMessageEveryTime").checked;
  if (!title || !body) return alert("اكتب عنوان ونص الرسالة");
  await setDoc(doc(db, "app_config", "global_message"), { title, body, isActive, showEveryTime, version: Date.now(), updatedAt: serverTimestamp() }, { merge: true });
  toast("تم حفظ الرسالة العامة");
};

window.sendAdminNotification = async function () {
  const target = $("notificationTarget").value;
  const targetPage = $("notificationPage").value;
  const title = $("notificationTitle").value.trim();
  const body = $("notificationBody").value.trim();
  if (!title || !body) return alert("اكتب عنوان ونص الإشعار");
  const users = allUsersCache.filter((u) => {
    if (target === "all") return true;
    if (target === "verified") return u.isVerified === true && u.isActive !== false;
    if (target === "pending") return u.isVerified !== true && u.isActive !== false;
    return u.role === target;
  });
  if (users.length === 0) return alert("لا يوجد مستخدمين ضمن هذه الفئة");
  if (!confirm(`إرسال الإشعار إلى ${users.length} مستخدم؟`)) return;
  let batch = writeBatch(db);
  let count = 0;
  let batchWrites = 0;
  const now = Date.now();
  for (const user of users) {
    const notificationId = `admin_${now}_${user.docId}_${count}`;
    batch.set(doc(db, "notifications", notificationId), {
      id: notificationId,
      userName: user.name || "",
      userPhone: user.phone || "",
      title,
      body,
      createdAt: serverTimestamp(),
      isRead: false,
      type: "admin",
      targetPage,
      orderId: "",
    });
    count++;
    batchWrites++;
    if (batchWrites >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      batchWrites = 0;
    }
  }
  if (batchWrites > 0) await batch.commit();
  $("notificationTitle").value = "";
  $("notificationBody").value = "";
  toast(`تم إرسال الإشعار إلى ${count} مستخدم`);
};

window.saveAppSettings = async function () {
  const payload = {
    registrationEnabled: $("registrationEnabled").checked,
    maintenanceMode: $("maintenanceMode").checked,
    supportPhone: cleanPhone($("supportPhone").value),
    adminWhatsAppPhone: cleanPhone($("supportPhone").value),
    freeTrialEnabled: $("freeTrialEnabled")?.checked === true,
    freeMonths: Number($("freeMonths").value || 0),
    adminInternalNote: $("adminInternalNote").value.trim(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "app_config", "settings"), payload, { merge: true });
  await addAdminLog("save_app_settings", {
    registrationEnabled: payload.registrationEnabled,
    maintenanceMode: payload.maintenanceMode,
    supportPhone: payload.supportPhone,
    adminWhatsAppPhone: payload.adminWhatsAppPhone,
    freeTrialEnabled: payload.freeTrialEnabled,
    freeMonths: payload.freeMonths,
  });
  toast("تم حفظ إعدادات التطبيق");
};

window.saveCounters = async function () {
  const ordersLast = Number($("ordersCounterInput").value || 0);
  const loadsLast = Number($("loadsCounterInput").value || 0);
  if (!confirm("تعديل العدادات؟ تأكد أن الأرقام صحيحة حتى لا يحدث تكرار أو قفزات غير مرغوبة.")) return;
  await setDoc(doc(db, "counters", "orders"), { lastNumber: ordersLast, updatedAt: serverTimestamp() }, { merge: true });
  await setDoc(doc(db, "counters", "loads"), { lastNumber: loadsLast, updatedAt: serverTimestamp() }, { merge: true });
  await addAdminLog("save_counters", { ordersLast, loadsLast });
  toast("تم حفظ العدادات");
};

window.addEventListener("load", () => {
  const loggedIn = localStorage.getItem("adminLoggedIn") === "true";
  if (loggedIn) {
    $("loginBox").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    startAdmin();
  }
});


const defaultTruckTypesConfig = ["براد", "ستارة", "صندوق مغلق", "قلاب", "تريلا", "سطحة", "صهريج", "فان", "بيك أب", "كونتينر", "سحاب"];
const defaultLoadTypesConfig = ["مواد غذائية", "مواد بناء", "أثاث", "أجهزة كهربائية", "أدوية", "ملابس", "محروقات", "بضاعة عامة", "أخرى"];
const defaultGovernoratesConfig = ["حلب", "دمشق", "ريف دمشق", "حمص", "حماة", "إدلب", "اللاذقية", "طرطوس", "درعا", "دير الزور", "الرقة", "الحسكة", "السويداء", "القنيطرة"];
const defaultCitiesConfig = {"حلب": ["مدينة حلب", "الباب", "اعزاز", "عفرين", "منبج", "جرابلس", "مارع", "السفيرة", "دير حافر", "تل رفعت", "الأتارب", "دارة عزة", "منطقة أخرى"], "دمشق": ["المزة", "البرامكة", "الميدان", "ركن الدين", "برزة", "كفرسوسة", "الزاهرة", "القابون", "القصاع", "باب توما", "منطقة أخرى"], "ريف دمشق": ["دوما", "حرستا", "جرمانا", "صحنايا", "قدسيا", "داريا", "الكسوة", "يبرود", "النبك", "قطنا", "معضمية الشام", "منطقة أخرى"], "حمص": ["مدينة حمص", "الرستن", "تلبيسة", "القصير", "تدمر", "تلكلخ", "المخرم", "الحولة", "منطقة أخرى"], "حماة": ["مدينة حماة", "محردة", "السقيلبية", "مصياف", "سلمية", "صوران", "طيبة الإمام", "مورك", "منطقة أخرى"], "إدلب": ["مدينة إدلب", "سرمدا", "الدانا", "معرة مصرين", "أريحا", "سلقين", "جسر الشغور", "معرة النعمان", "خان شيخون", "حارم", "بنش", "منطقة أخرى"], "اللاذقية": ["مدينة اللاذقية", "جبلة", "القرداحة", "الحفة", "كسب", "رأس البسيط", "منطقة أخرى"], "طرطوس": ["مدينة طرطوس", "بانياس", "صافيتا", "الدريكيش", "الشيخ بدر", "القدموس", "منطقة أخرى"], "درعا": ["مدينة درعا", "إزرع", "نوى", "طفس", "داعل", "الصنمين", "بصرى الشام", "جاسم", "منطقة أخرى"], "دير الزور": ["مدينة دير الزور", "الميادين", "البوكمال", "موحسن", "العشارة", "القورية", "منطقة أخرى"], "الرقة": ["مدينة الرقة", "تل أبيض", "الطبقة", "معدان", "المنصورة", "الكرامة", "منطقة أخرى"], "الحسكة": ["مدينة الحسكة", "القامشلي", "عامودا", "رأس العين", "الدرباسية", "المالكية", "اليعربية", "منطقة أخرى"], "السويداء": ["مدينة السويداء", "شهبا", "صلخد", "القريا", "عرى", "ملح", "منطقة أخرى"], "القنيطرة": ["مدينة القنيطرة", "خان أرنبة", "جباتا الخشب", "الرفيد", "حضر", "منطقة أخرى"]};

function safeConfigDocId(value) {
  const clean = String(value || "")
    .trim()
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replaceAll(".", "_")
    .replaceAll("#", "_")
    .replaceAll("[", "_")
    .replaceAll("]", "_")
    .replaceAll("*", "_")
    .replaceAll(" ", "_");
  return clean || String(Date.now());
}

function normalizeConfigName(value) {
  return String(value || "")
    .trim()
    .replaceAll("أ", "ا")
    .replaceAll("إ", "ا")
    .replaceAll("آ", "ا")
    .replaceAll("ة", "ه")
    .replaceAll("ى", "ي")
    .toLowerCase();
}

function mapConfigDoc(d) {
  const data = d.data();
  return {
    docId: d.id,
    nameAr: data.nameAr || data.name || "",
    name: data.name || data.nameAr || "",
    governorateName: data.governorateName || data.governorate || data.provinceName || "",
    active: data.active !== false,
    sortOrder: Number(data.sortOrder || 999),
    updatedAt: data.updatedAt || null,
  };
}

function sortConfigItems(a, b) {
  if ((a.sortOrder || 999) !== (b.sortOrder || 999)) {
    return (a.sortOrder || 999) - (b.sortOrder || 999);
  }
  return String(a.nameAr || "").localeCompare(String(b.nameAr || ""), "ar");
}

function listenAppConfigLists() {
  if (configUnsubscribes.length) return;

  configUnsubscribes.push(onSnapshot(query(collection(db, "truck_types")), (snapshot) => {
    truckTypesConfig = snapshot.docs.map(mapConfigDoc).sort(sortConfigItems);
    renderAppConfigLists();
  }));

  configUnsubscribes.push(onSnapshot(query(collection(db, "load_types")), (snapshot) => {
    loadTypesConfig = snapshot.docs.map(mapConfigDoc).sort(sortConfigItems);
    renderAppConfigLists();
  }));

  configUnsubscribes.push(onSnapshot(query(collection(db, "governorates")), (snapshot) => {
    governoratesConfig = snapshot.docs.map(mapConfigDoc).sort(sortConfigItems);
    renderAppConfigLists();
  }));

  configUnsubscribes.push(onSnapshot(query(collection(db, "cities")), (snapshot) => {
    citiesConfig = snapshot.docs.map(mapConfigDoc).sort(sortConfigItems);
    renderAppConfigLists();
  }));
}

function renderAppConfigLists() {
  renderConfigList("truckTypesConfigList", truckTypesConfig, "truck_types");
  renderConfigList("loadTypesConfigList", loadTypesConfig, "load_types");
  renderConfigList("governoratesConfigList", governoratesConfig, "governorates");
  renderCitiesConfigList();
  fillGovernorateSelect();
}

function renderConfigList(containerId, items, collectionName) {
  const box = $(containerId);
  if (!box) return;

  if (!items.length) {
    box.innerHTML = `<div class="empty-box">لا توجد عناصر بعد</div>`;
    return;
  }

  box.innerHTML = items.map((item) => `
    <div class="data-card">
      <div class="card-top">
        <div class="avatar">${item.active ? "✅" : "⛔"}</div>
        <div class="card-title">
          <h3>${escapeHtml(item.nameAr)}</h3>
          <p>ترتيب: ${item.sortOrder || "-"} • ${item.active ? "مفعّل" : "معطّل"}</p>
        </div>
        <span class="badge ${item.active ? "verified" : "blocked"}">${item.active ? "ظاهر" : "مخفي"}</span>
      </div>
      <div class="actions">
        <button class="update-btn" onclick="renameConfigItem('${collectionName}','${item.docId}','${escapeHtml(item.nameAr)}')">تعديل</button>
        <button class="${item.active ? "warning-btn" : "success-btn"}" onclick="toggleConfigItem('${collectionName}','${item.docId}',${!item.active})">${item.active ? "تعطيل" : "تفعيل"}</button>
        <button class="danger-btn" onclick="deleteConfigItem('${collectionName}','${item.docId}')">حذف</button>
      </div>
    </div>
  `).join("");
}

function renderCitiesConfigList() {
  const box = $("citiesConfigList");
  if (!box) return;

  if (!citiesConfig.length) {
    box.innerHTML = `<div class="empty-box">لا توجد مدن بعد</div>`;
    return;
  }

  box.innerHTML = citiesConfig.map((item) => `
    <div class="data-card">
      <div class="card-top">
        <div class="avatar">${item.active ? "🏙️" : "⛔"}</div>
        <div class="card-title">
          <h3>${escapeHtml(item.nameAr)}</h3>
          <p>المحافظة: ${escapeHtml(item.governorateName || "-")} • ترتيب: ${item.sortOrder || "-"}</p>
        </div>
        <span class="badge ${item.active ? "verified" : "blocked"}">${item.active ? "ظاهر" : "مخفي"}</span>
      </div>
      <div class="actions">
        <button class="update-btn" onclick="renameConfigItem('cities','${item.docId}','${escapeHtml(item.nameAr)}')">تعديل</button>
        <button class="${item.active ? "warning-btn" : "success-btn"}" onclick="toggleConfigItem('cities','${item.docId}',${!item.active})">${item.active ? "تعطيل" : "تفعيل"}</button>
        <button class="danger-btn" onclick="deleteConfigItem('cities','${item.docId}')">حذف</button>
      </div>
    </div>
  `).join("");
}

function fillGovernorateSelect() {
  const select = $("cityGovernorateSelect");
  if (!select) return;

  const current = select.value;
  const activeGovernorates = governoratesConfig.filter((item) => item.active);

  select.innerHTML = `<option value="">اختر المحافظة</option>` + activeGovernorates.map((item) => {
    const name = escapeHtml(item.nameAr);
    return `<option value="${name}">${name}</option>`;
  }).join("");

  if (current) select.value = current;
}

async function addSimpleConfigItem(collectionName, inputId) {
  const input = $(inputId);
  const name = input?.value?.trim() || "";

  if (!name) {
    toast("اكتب الاسم أولاً", "error");
    return;
  }

  let existingList = [];

  try {
    const snapshot = await getDocs(query(collection(db, collectionName)));
    existingList = snapshot.docs.map((d) => {
      const data = d.data() || {};
      return {
        docId: d.id,
        nameAr: data.nameAr || data.name || "",
        sortOrder: Number(data.sortOrder || 0),
      };
    });
  } catch (error) {
    console.error("Failed to read config collection before add:", error);
    toast("تعذر قراءة الترتيب الحالي، جرّب تحديث الصفحة", "error");
    return;
  }

  const duplicate = existingList.some((item) => normalizeConfigName(item.nameAr) === normalizeConfigName(name));
  if (duplicate) {
    toast("هذا الاسم موجود مسبقاً", "error");
    return;
  }

  const maxSortOrder = existingList.reduce((max, item) => {
    const order = Number(item.sortOrder || 0);
    return Number.isFinite(order) && order > max ? order : max;
  }, 0);

  await setDoc(doc(db, collectionName, safeConfigDocId(name)), {
    nameAr: name,
    name,
    active: true,
    sortOrder: maxSortOrder + 1,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  input.value = "";
  toast("تمت الإضافة");
}

window.addTruckTypeConfig = () => addSimpleConfigItem("truck_types", "newTruckTypeInput");
window.addLoadTypeConfig = () => addSimpleConfigItem("load_types", "newLoadTypeInput");
window.addGovernorateConfig = () => addSimpleConfigItem("governorates", "newGovernorateInput");

window.addCityConfig = async function () {
  const name = $("newCityInput")?.value?.trim() || "";
  const governorateName = $("cityGovernorateSelect")?.value?.trim() || "";

  if (!governorateName) {
    toast("اختر المحافظة أولاً", "error");
    return;
  }

  if (!name) {
    toast("اكتب اسم المدينة", "error");
    return;
  }

  const duplicate = citiesConfig.some((item) =>
    normalizeConfigName(item.nameAr) === normalizeConfigName(name) &&
    normalizeConfigName(item.governorateName) === normalizeConfigName(governorateName)
  );

  if (duplicate) {
    toast("هذه المدينة موجودة ضمن نفس المحافظة", "error");
    return;
  }

  const sameGovCities = citiesConfig.filter((item) => normalizeConfigName(item.governorateName) === normalizeConfigName(governorateName));

  await setDoc(doc(db, "cities", `${safeConfigDocId(governorateName)}_${safeConfigDocId(name)}`), {
    nameAr: name,
    name,
    governorateName,
    active: true,
    sortOrder: sameGovCities.length + 1,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  $("newCityInput").value = "";
  toast("تمت إضافة المدينة");
};

window.renameConfigItem = async function (collectionName, id, oldName) {
  const newName = prompt("اكتب الاسم الجديد", oldName || "");
  if (!newName || !newName.trim()) return;

  await updateDoc(doc(db, collectionName, id), {
    nameAr: newName.trim(),
    name: newName.trim(),
    updatedAt: serverTimestamp(),
  });

  toast("تم تعديل الاسم");
};

window.toggleConfigItem = async function (collectionName, id, active) {
  await updateDoc(doc(db, collectionName, id), {
    active,
    updatedAt: serverTimestamp(),
  });

  toast(active ? "تم التفعيل" : "تم التعطيل");
};

window.deleteConfigItem = async function (collectionName, id) {
  if (!confirm("الحذف النهائي قد يؤثر على الطلبات القديمة. الأفضل تعطيل العنصر. هل تريد الحذف؟")) {
    return;
  }

  await deleteDoc(doc(db, collectionName, id));
  toast("تم الحذف");
};

window.seedDefaultAppConfig = async function () {
  if (!confirm("سيتم إضافة القوائم الأساسية إذا كانت غير موجودة. متابعة؟")) return;

  const batch = writeBatch(db);

  defaultTruckTypesConfig.forEach((name, index) => {
    batch.set(doc(db, "truck_types", safeConfigDocId(name)), {
      nameAr: name,
      name,
      active: true,
      sortOrder: index + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  defaultLoadTypesConfig.forEach((name, index) => {
    batch.set(doc(db, "load_types", safeConfigDocId(name)), {
      nameAr: name,
      name,
      active: true,
      sortOrder: index + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  defaultGovernoratesConfig.forEach((name, index) => {
    batch.set(doc(db, "governorates", safeConfigDocId(name)), {
      nameAr: name,
      name,
      active: true,
      sortOrder: index + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  Object.entries(defaultCitiesConfig).forEach(([governorateName, cities]) => {
    cities.forEach((cityName, index) => {
      batch.set(doc(db, "cities", `${safeConfigDocId(governorateName)}_${safeConfigDocId(cityName)}`), {
        nameAr: cityName,
        name: cityName,
        governorateName,
        active: true,
        sortOrder: index + 1,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  });

  await batch.commit();
  toast("تمت إضافة القوائم الأساسية");
};



function ensureOpenSubscriptionButtons() {
  const modal = document.querySelector(".admin-modal, .modal-content, .details-modal-content, .manage-modal-content");
  if (!modal) return;

  const hasUserIdSource =
    modal.querySelector("[data-user-id]") ||
    document.querySelector("[data-current-user-id]");

  // نضيف الزر داخل أي مودال إدارة مستخدم/اشتراك إذا كان فيه أزرار اشتراك
  const actions = Array.from(modal.querySelectorAll(".modal-actions, .subscription-actions, .subscription-modal-actions, .manual-subscription-actions, .subscription-center-actions"))
    .find((box) => !box.querySelector(".open-subscription-btn"));

  if (!actions) return;

  const titleText = modal.textContent || "";
  if (!/اشتراك|subscription|تجديد|تمديد|موقوف|منتهي|تجريبي|مشترك/.test(titleText)) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "open-subscription-btn success-btn";
  btn.textContent = "اشتراك مفتوح";
  btn.title = "تفعيل اشتراك بدون تاريخ انتهاء";

  btn.addEventListener("click", () => {
    const id =
      modal.dataset.userId ||
      modal.querySelector("[data-user-id]")?.dataset.userId ||
      window.currentManageUserId ||
      window.currentSubscriptionUserId ||
      "";
    if (!id) {
      alert("لم أتمكن من تحديد المستخدم. افتح الاشتراك من بطاقة المستخدم ثم جرّب مجدداً.");
      return;
    }
    makeSubscriptionOpen(id);
  });

  actions.prepend(btn);
}

setInterval(ensureOpenSubscriptionButtons, 900);



function ensureOpenSubscriptionCardButtons() {
  document.querySelectorAll("#subscriptionsSection .subscription-card, #subscriptionsSection .subscription-center-card, #subscriptionsSection .user-card").forEach((card) => {
    if (card.querySelector(".open-subscription-card-btn")) return;

    const text = card.textContent || "";
    if (!/اشتراك|subscription|مشترك|منتهي|تجريبي|موقوف/.test(text)) return;

    const actions = card.querySelector(".subscription-actions, .card-actions, .actions");
    if (!actions) return;

    const userId =
      card.dataset.userId ||
      card.dataset.id ||
      card.querySelector("[data-user-id]")?.dataset.userId ||
      "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "open-subscription-card-btn success-btn";
    btn.textContent = "مفتوح";
    btn.title = "تفعيل اشتراك مفتوح";

    btn.addEventListener("click", () => {
      const finalUserId =
        userId ||
        card.dataset.userId ||
        card.querySelector("[data-user-id]")?.dataset.userId ||
        "";
      if (!finalUserId) {
        alert("لم أتمكن من تحديد المستخدم من هذه البطاقة. افتح إدارة الاشتراك ثم استخدم زر اشتراك مفتوح.");
        return;
      }
      makeSubscriptionOpen(finalUserId);
    });

    actions.appendChild(btn);
  });
}

setInterval(ensureOpenSubscriptionCardButtons, 1200);

