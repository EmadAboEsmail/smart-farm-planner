import { state, pushHistory } from "./state.js";
import { renderAll } from "./render.js";
import { $ } from "./utils.js";
import { getStatusLabel } from "./utils.js";
import { saveState } from "./storage.js";

// متغيرات محلية للنافذة المنبثقة
let modalCallback = null;

export function showToast(m) {
  const t = $("toast");
  t.innerText = m;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

export function toggleSidebar() {
  $("sidebar").classList.toggle("active");
}
export function toggleStats() {
  $("statsPanel").classList.toggle("active");
}
export function toggleNightMode() {
  document.body.classList.toggle("night-mode");
}
export function toggleWatering() {
  state.isWatering = !state.isWatering;
  renderAll();
  showToast(state.isWatering ? "نظام الري يعمل 💧" : "تم إيقاف الري");
}

// في ملف js/ui.js

// في ملف js/ui.js

export function showTreeCard(e, data) {
  state.selectedTreeData = data;
  const card = $("treeCard");

  // --- الجزء الجديد: تلوين وتكبير الشجرة ---

  // 1. إزالة التحديد عن أي شجرة سابقة
  const prevSelected = document.querySelectorAll(".tree-node.selected");
  prevSelected.forEach((el) => el.classList.remove("selected"));

  // 2. البحث عن الشجرة الحالية في الـ DOM وإضافة التحديد لها
  // نستخدم data-key للعثور عليها بدقة
  const currentTree = document.querySelector(`circle[data-key="${data.key}"]`);
  if (currentTree) {
    currentTree.classList.add("selected");

    // (حيلة ذكية) نقل العنصر لآخر القائمة ليظهر فوق كل الأشجار المحيطة
    // في SVG العنصر الأخير هو الذي يظهر في الأعلى (Z-Index)
    currentTree.parentElement.appendChild(currentTree);
  }
  // ---------------------------------------

  // بقية كود البطاقة كما هو...
  card.style.display = "";
  $("cardCropType").innerText = `شجرة رقم ${data.num}`;

  const detailsDiv = $("cardDetails");
  detailsDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; padding:0 10px;">
            <span>📍 الصف: <b>${data.r}</b></span>
            <span>📍 العمود: <b>${data.c}</b></span>
        </div>
    `;

  requestAnimationFrame(() => {
    card.classList.add("active");
  });
}

export function closeCard() {
  const card = $("treeCard");
  card.classList.remove("active");

  // إزالة تأثير التكبير واللون عند إغلاق البطاقة
  const prevSelected = document.querySelectorAll(".tree-node.selected");
  prevSelected.forEach((el) => el.classList.remove("selected"));

  state.selectedTreeData = null;
}
function setTreeStatus(status) {
  if (!state.selectedTreeData) return;
  pushHistory();
  state.treeStatus.set(state.selectedTreeData.key, status);
  renderAll();
  saveState();
  closeCard();
  showToast(`تم تغيير الحالة إلى: ${getStatusLabel(status)}`);
}

// نافذة التعديل على الحواف
export function showEdgeInput(dist, idx, cx, cy) {
  state.editingEdgeIndex = idx;
  const inp = $("edgeInput");
  inp.value = dist.toFixed(1);
  inp.style.left = cx - 50 + "px";
  inp.style.top = cy - 40 + "px";
  inp.style.display = "block";
  inp.focus();
}

export function openModal(t, m, c) {
  $("modalTitle").innerText = t;
  $("modalMsg").innerText = m;
  $("customModal").style.display = "flex";
  modalCallback = c;
}
export function closeModal(v) {
  $("customModal").style.display = "none";
  if (v && modalCallback) modalCallback();
  modalCallback = null;
}
// في js/ui.js

// فتح بطاقة المبنى
export function showBuildingCard(idx) {
  // إغلاق أي بطاقة أخرى
  closeCard();

  state.selectedBuildingIndex = idx;
  const building = state.buildings[idx];

  // ملء الخانات بالأبعاد الحالية
  const wInput = $('buildW');
  const hInput = $('buildH');

  if (wInput) wInput.value = building.w;
  if (hInput) hInput.value = building.h;

  const card = $('buildingCard');
  card.style.display = 'flex';
  requestAnimationFrame(() => card.classList.add('active'));
}

// إغلاق بطاقة المبنى
window.closeBuildingCard = () => {
  const card = $('buildingCard');
  card.classList.remove('active');
  setTimeout(() => {
    if (!card.classList.contains('active')) card.style.display = 'none';
  }, 300); // انتظار انتهاء الأنيميشن
  state.selectedBuildingIndex = -1;
};

// تحديث الأبعاد فورياً
window.updateBuildingDim = (key, value) => {
  const idx = state.selectedBuildingIndex;
  if (idx !== -1 && state.buildings[idx]) {
    const val = parseFloat(value);
    if (val > 0) {
      state.buildings[idx][key] = val;

      // استيراد renderAll هنا أو التأكد من أنها متاحة عالمياً
      // بما أننا نستخدم modules، يفضل استدعاؤها عبر window إذا كانت مربوطة في main.js
      // أو استيرادها في أعلى الملف إذا لم يحدث تداخل دائري.
      // الحل الأضمن هو استدعاء دالة الرسم:
      import('./render.js').then(module => module.renderAll());
    }
  }
};

// حذف المبنى من البطاقة
window.deleteSelectedBuilding = () => {
  const idx = state.selectedBuildingIndex;
  if (idx !== -1) {
    state.buildings.splice(idx, 1);
    window.closeBuildingCard();
    import('./render.js').then(module => module.renderAll());

    // إشعار
    const toast = document.getElementById('toast');
    if (toast) {
      toast.innerText = "تم حذف المبنى";
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
  }
}; 
