import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/*
  STAGE 3:
  هذا الملف صار مسؤول عن القوائم فقط:
  - أنواع الشاحنات
  - أنواع الحمولات
  - المحافظات
  - المدن

  الإحداثيات بقيت في:
  modules/config/coordinates.js

  تسجيل الدخول وباقي الأقسام بقيت في:
  modules/legacy/app.js
*/

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

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

let configUnsubscribes = [];
let truckTypesConfig = [];
let loadTypesConfig = [];
let governoratesConfig = [];
let citiesConfig = [];
let normalizedSortCollections = new Set();

function $(id) {
  return document.getElementById(id);
}

function toast(message, type = "success") {
  if (window.toast && typeof window.toast === "function") {
    window.toast(message, type);
    return;
  }

  const old = document.querySelector(".toast");
  if (old) old.remove();

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeConfigName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function safeConfigDocId(value) {
  const text = String(value || "")
    .trim()
    .replace(/[\/\\#?[\]]/g, "-")
    .replace(/\s+/g, "_")
    .toLowerCase();

  return text || `item_${Date.now()}`;
}

function mapConfigDoc(d) {
  const data = d.data();

  const latValue = data.lat ?? data.latitude ?? null;
  const lngValue = data.lng ?? data.longitude ?? null;

  return {
    docId: d.id,
    nameAr: data.nameAr || data.name || "",
    name: data.name || data.nameAr || "",
    governorateName: data.governorateName || data.governorate || data.provinceName || "",
    active: data.active !== false,
    sortOrder: Number(data.sortOrder || 999),
    lat: latValue === null || latValue === undefined || latValue === "" ? null : Number(latValue),
    lng: lngValue === null || lngValue === undefined || lngValue === "" ? null : Number(lngValue),
    updatedAt: data.updatedAt || null,
  };
}

function sortConfigItems(items) {
  return [...items].sort((a, b) => {
    const order = (a.sortOrder || 999) - (b.sortOrder || 999);
    if (order !== 0) return order;
    return String(a.nameAr || "").localeCompare(String(b.nameAr || ""), "ar");
  });
}

function listenAppConfigLists() {
  if (configUnsubscribes.length) return;

  const configs = [
    ["truck_types", (items) => { truckTypesConfig = items; }],
    ["load_types", (items) => { loadTypesConfig = items; }],
    ["governorates", (items) => { governoratesConfig = items; }],
    ["cities", (items) => { citiesConfig = items; }],
  ];

  configUnsubscribes = configs.map(([collectionName, setter]) => {
    return onSnapshot(query(collection(db, collectionName)), (snapshot) => {
      const items = snapshot.docs.map(mapConfigDoc);
      setter(sortConfigItems(items));

      if (collectionName === "governorates") {
        normalizeCollectionSortOrders("governorates", governoratesConfig, true);
      }

      renderAppConfigLists();
    });
  });
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

  box.innerHTML = citiesConfig.map((item) => {
    const hasCoordinates =
      item.lat !== null &&
      item.lat !== undefined &&
      Number.isFinite(Number(item.lat)) &&
      item.lng !== null &&
      item.lng !== undefined &&
      Number.isFinite(Number(item.lng));

    return `
      <div class="data-card city-config-card ${hasCoordinates ? "with-coordinates" : "without-coordinates"}">
        <div class="card-top">
          <div class="avatar">${item.active ? "🏙️" : "⛔"}</div>
          <div class="card-title">
            <h3>${escapeHtml(item.nameAr)}</h3>
            <p>المحافظة: ${escapeHtml(item.governorateName || "-")} • ترتيب: ${item.sortOrder || "-"}</p>
            <p class="coordinate-line ${hasCoordinates ? "ok" : "missing"}">
              ${hasCoordinates ? `📍 ${escapeHtml(item.lat)}, ${escapeHtml(item.lng)}` : "📍 لا توجد إحداثيات"}
            </p>
          </div>
          <span class="badge ${item.active ? "verified" : "blocked"}">${item.active ? "ظاهر" : "مخفي"}</span>
        </div>
        <div class="actions city-actions">
          <button class="update-btn" onclick="renameConfigItem('cities','${item.docId}','${escapeHtml(item.nameAr)}')">تعديل الاسم</button>
          <button class="${item.active ? "warning-btn" : "success-btn"}" onclick="toggleConfigItem('cities','${item.docId}',${!item.active})">${item.active ? "تعطيل" : "تفعيل"}</button>
          <button class="danger-btn" onclick="deleteConfigItem('cities','${item.docId}')">حذف المدينة</button>
        </div>
      </div>
    `;
  }).join("");
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

function inputForCollection(collectionName) {
  if (collectionName === "truck_types") return $("newTruckTypeInput");
  if (collectionName === "load_types") return $("newLoadTypeInput");
  if (collectionName === "governorates") return $("newGovernorateInput");
  return null;
}

function hasBadSortOrders(items) {
  if (!items.length) return false;

  const seen = new Set();

  return items.some((item) => {
    const order = Number(item.sortOrder || 0);
    if (!Number.isFinite(order) || order <= 0) return true;
    if (seen.has(order)) return true;
    seen.add(order);
    return false;
  });
}

async function normalizeCollectionSortOrders(collectionName, items, silent = true) {
  if (!items.length || !hasBadSortOrders(items)) return;

  const key = `${collectionName}_sort_normalized`;
  if (normalizedSortCollections.has(key)) return;
  normalizedSortCollections.add(key);

  try {
    const batch = writeBatch(db);

    const normalizedItems = [...items].sort((a, b) => {
      const aOrder = Number(a.sortOrder || 999999);
      const bOrder = Number(b.sortOrder || 999999);

      if (aOrder !== bOrder) return aOrder - bOrder;

      return String(a.nameAr || "").localeCompare(String(b.nameAr || ""), "ar");
    });

    normalizedItems.forEach((item, index) => {
      batch.set(doc(db, collectionName, item.docId), {
        sortOrder: index + 1,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();

    if (!silent) {
      toast("تم إصلاح ترتيب المحافظات");
    }

    console.log(`Fixed sortOrder for ${collectionName}`);
  } catch (error) {
    normalizedSortCollections.delete(key);
    console.error(`Failed to fix sortOrder for ${collectionName}:`, error);
    toast("تعذر إصلاح الترتيب", "error");
  }
}

window.fixGovernoratesSortOrder = async function () {
  await normalizeCollectionSortOrders("governorates", governoratesConfig, false);
};


function cacheForCollection(collectionName) {
  if (collectionName === "truck_types") return truckTypesConfig;
  if (collectionName === "load_types") return loadTypesConfig;
  if (collectionName === "governorates") return governoratesConfig;
  if (collectionName === "cities") return citiesConfig;
  return [];
}

function nextSortOrder(items) {
  return items.reduce((max, item) => {
    const order = Number(item.sortOrder || 0);
    return Number.isFinite(order) && order > max ? order : max;
  }, 0) + 1;
}

window.addConfigItem = async function (collectionName) {
  const input = inputForCollection(collectionName);
  const name = input?.value?.trim() || "";

  if (!name) {
    toast("اكتب الاسم أولاً", "error");
    return;
  }

  const items = cacheForCollection(collectionName);
  const duplicate = items.some((item) => normalizeConfigName(item.nameAr) === normalizeConfigName(name));

  if (duplicate) {
    toast("هذا العنصر موجود مسبقاً", "error");
    return;
  }

  const docId = safeConfigDocId(name);

  await setDoc(doc(db, collectionName, docId), {
    nameAr: name,
    name,
    active: true,
    sortOrder: nextSortOrder(items),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  if (input) input.value = "";
  toast("تمت الإضافة بنجاح");
};

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

  const sameGovCities = citiesConfig.filter((item) =>
    normalizeConfigName(item.governorateName) === normalizeConfigName(governorateName)
  );

  await setDoc(doc(db, "cities", `${safeConfigDocId(governorateName)}_${safeConfigDocId(name)}`), {
    nameAr: name,
    name,
    governorateName,
    governorate: governorateName,
    active: true,
    sortOrder: nextSortOrder(sameGovCities),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  $("newCityInput").value = "";
  toast("تمت إضافة المدينة");
};

window.renameConfigItem = async function (collectionName, docId, oldName) {
  const newName = prompt("اكتب الاسم الجديد", oldName || "");
  if (!newName || !newName.trim()) return;

  const trimmed = newName.trim();

  const data = {
    nameAr: trimmed,
    name: trimmed,
    updatedAt: serverTimestamp(),
  };

  if (collectionName === "cities") {
    data.governorate = citiesConfig.find((item) => item.docId === docId)?.governorateName || "";
  }

  await updateDoc(doc(db, collectionName, docId), data);
  toast("تم التعديل");
};

window.toggleConfigItem = async function (collectionName, docId, active) {
  await updateDoc(doc(db, collectionName, docId), {
    active,
    updatedAt: serverTimestamp(),
  });

  toast(active ? "تم التفعيل" : "تم التعطيل");
};

window.deleteConfigItem = async function (collectionName, docId) {
  const label = collectionName === "cities" ? "المدينة" : "العنصر";

  if (!confirm(`هل تريد حذف ${label}؟ يفضل التعطيل بدلاً من الحذف إذا كان مستخدماً في طلبات قديمة.`)) {
    return;
  }

  await deleteDoc(doc(db, collectionName, docId));
  toast("تم الحذف");
};

window.seedDefaultAppConfig = async function () {
  if (!confirm("سيتم إضافة القوائم الأساسية إذا لم تكن موجودة. هل تريد المتابعة؟")) {
    return;
  }

  const batch = writeBatch(db);

  const truckTypes = ["براد", "ستارة", "قلاب", "صهريج", "سطحة", "كونتينر", "مغلقة"];
  const loadTypes = ["مواد غذائية", "خضار وفواكه", "مواد بناء", "أثاث", "أجهزة كهربائية", "ملابس", "أخرى"];
  const governorates = [
    "دمشق", "ريف دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس",
    "إدلب", "درعا", "السويداء", "القنيطرة", "دير الزور", "الرقة", "الحسكة",
  ];

  truckTypes.forEach((name, index) => {
    batch.set(doc(db, "truck_types", safeConfigDocId(name)), {
      nameAr: name,
      name,
      active: true,
      sortOrder: index + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  loadTypes.forEach((name, index) => {
    batch.set(doc(db, "load_types", safeConfigDocId(name)), {
      nameAr: name,
      name,
      active: true,
      sortOrder: index + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  governorates.forEach((name, index) => {
    batch.set(doc(db, "governorates", safeConfigDocId(name)), {
      nameAr: name,
      name,
      active: true,
      sortOrder: index + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();
  toast("تمت إضافة القوائم الأساسية");
};

function initConfigModule() {
  if (!$("configSection")) return;
  listenAppConfigLists();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initConfigModule);
} else {
  initConfigModule();
}
