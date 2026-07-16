import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/*
  STAGE 1:
  هذا الملف مسؤول فقط عن إحداثيات المدن.
  أي تعديل لاحق على الإحداثيات يتم هنا فقط.
  لا يوجد هنا تسجيل دخول ولا مستخدمين ولا طلبات.
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

let governorates = [];
let cities = [];

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

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
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
  };
}

function normalizeNumberText(value) {
  return String(value || "")
    .trim()
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٫,]/g, ".")
    .replace(/\s+/g, "");
}

function parseOptionalNumberValue(value) {
  const raw = normalizeNumberText(value);
  if (!raw) return null;

  const numberValue = Number(raw);
  if (!Number.isFinite(numberValue)) return NaN;

  return numberValue;
}

function readNumberInput(id) {
  return parseOptionalNumberValue($(id)?.value);
}

function isValidLatLng(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function hasCoordinates(city) {
  return city &&
    city.lat !== null &&
    city.lat !== undefined &&
    Number.isFinite(Number(city.lat)) &&
    city.lng !== null &&
    city.lng !== undefined &&
    Number.isFinite(Number(city.lng));
}

function activeGovernorates() {
  return governorates
    .filter((item) => item.active)
    .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
}

function activeCitiesForGovernorate(governorateName) {
  return cities
    .filter((item) => item.active)
    .filter((item) => normalizeName(item.governorateName) === normalizeName(governorateName))
    .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
}

function fillGovernorateSelect() {
  const select = $("coordinatesGovernorateSelect");
  if (!select) return;

  const current = select.value;

  select.innerHTML =
    `<option value="">اختر المحافظة</option>` +
    activeGovernorates().map((item) => {
      const name = escapeHtml(item.nameAr);
      return `<option value="${name}">${name}</option>`;
    }).join("");

  if (current) {
    select.value = current;
  }

  fillCitySelect();
}

function fillCitySelect() {
  const governorateName = $("coordinatesGovernorateSelect")?.value?.trim() || "";
  const citySelect = $("coordinatesCitySelect");
  if (!citySelect) return;

  const current = citySelect.value;
  const list = activeCitiesForGovernorate(governorateName);

  citySelect.innerHTML =
    `<option value="">اختر المدينة</option>` +
    list.map((item) => {
      return `<option value="${escapeHtml(item.docId)}">${escapeHtml(item.nameAr)}</option>`;
    }).join("");

  if (current && list.some((item) => item.docId === current)) {
    citySelect.value = current;
  }

  fillSelectedCityCoordinates();
}

function fillSelectedCityCoordinates() {
  const cityId = $("coordinatesCitySelect")?.value || "";
  const city = cities.find((item) => item.docId === cityId);

  const latInput = $("coordinatesLatInput");
  const lngInput = $("coordinatesLngInput");
  const status = $("selectedCoordinatesStatus");

  if (!latInput || !lngInput) return;

  latInput.value = city?.lat ?? "";
  lngInput.value = city?.lng ?? "";

  if (!status) return;

  if (!city) {
    status.className = "coordinates-status";
    status.textContent = "اختر مدينة لعرض حالة الإحداثيات.";
    return;
  }

  if (hasCoordinates(city)) {
    status.className = "coordinates-status has-coordinates";
    status.textContent = `الإحداثيات الحالية: ${city.lat}, ${city.lng}`;
  } else {
    status.className = "coordinates-status missing-coordinates";
    status.textContent = "هذه المدينة لا تحتوي على إحداثيات بعد.";
  }
}

async function saveSelectedCityCoordinates() {
  const cityId = $("coordinatesCitySelect")?.value || "";
  const lat = readNumberInput("coordinatesLatInput");
  const lng = readNumberInput("coordinatesLngInput");

  if (!cityId) {
    toast("اختر المدينة أولاً", "error");
    return;
  }

  if (lat === null || lng === null) {
    toast("اكتب خط العرض وخط الطول", "error");
    return;
  }

  if (Number.isNaN(lat) || Number.isNaN(lng) || !isValidLatLng(lat, lng)) {
    toast("الإحداثيات غير صحيحة. lat بين -90 و 90 و lng بين -180 و 180", "error");
    return;
  }

  await updateDoc(doc(db, "cities", cityId), {
    lat: Number(lat),
    lng: Number(lng),
    latitude: Number(lat),
    longitude: Number(lng),
    updatedAt: serverTimestamp(),
  });

  toast("تم حفظ / تعديل إحداثيات المدينة");
}

async function deleteSelectedCityCoordinates() {
  const cityId = $("coordinatesCitySelect")?.value || "";

  if (!cityId) {
    toast("اختر المدينة أولاً", "error");
    return;
  }

  if (!confirm("هل تريد حذف إحداثيات هذه المدينة؟ لن يتم حذف المدينة نفسها.")) {
    return;
  }

  await updateDoc(doc(db, "cities", cityId), {
    lat: null,
    lng: null,
    latitude: null,
    longitude: null,
    updatedAt: serverTimestamp(),
  });

  if ($("coordinatesLatInput")) $("coordinatesLatInput").value = "";
  if ($("coordinatesLngInput")) $("coordinatesLngInput").value = "";

  toast("تم حذف إحداثيات المدينة");
}

function bindCoordinatesEvents() {
  $("coordinatesGovernorateSelect")?.addEventListener("change", fillCitySelect);
  $("coordinatesCitySelect")?.addEventListener("change", fillSelectedCityCoordinates);
  $("saveCoordinatesBtn")?.addEventListener("click", saveSelectedCityCoordinates);
  $("deleteCoordinatesBtn")?.addEventListener("click", deleteSelectedCityCoordinates);
}

function listenCoordinatesData() {
  onSnapshot(query(collection(db, "governorates")), (snapshot) => {
    governorates = snapshot.docs.map(mapConfigDoc);
    fillGovernorateSelect();
  });

  onSnapshot(query(collection(db, "cities")), (snapshot) => {
    cities = snapshot.docs.map(mapConfigDoc);
    fillCitySelect();
  });
}

function initCoordinatesModule() {
  if (!$("coordinatesGovernorateSelect")) return;

  bindCoordinatesEvents();
  listenCoordinatesData();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCoordinatesModule);
} else {
  initCoordinatesModule();
}
