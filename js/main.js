import { state, pushHistory, historyStack } from "./state.js";
import { renderAll } from "./render.js";
import { saveState, loadState, loadDataJSON, exportMap } from "./storage.js";
import * as UI from "./ui.js";
import * as Events from "./events.js";
import { $ } from "./utils.js";

// دوال التهيئة
export function initMap(isNew = false) {
  if (isNew) {
    const L = parseFloat($("landLength").value) || 100;
    const W = parseFloat($("landWidth").value) || 60;
    state.vertices = [
      { x: -L / 2, y: -W / 2 },
      { x: L / 2, y: -W / 2 },
      { x: L / 2, y: W / 2 },
      { x: -L / 2, y: W / 2 },
    ];
    state.deletedTrees.clear();
    state.deletedRows.clear();
    state.deletedCols.clear();
    state.movedTrees.clear();
    state.treeStatus.clear();
    state.cropType = "tree";
    saveState();
  } else {
    loadState();
  }

  state.scale = 1;
  state.pointX = 0;
  state.pointY = 0;
  state.rotation = 0;
  state.tilt = 0;
  state.isEditMode = false;
  $("editBtn").classList.remove("active-mode");
  state.is3D = false;
  $("btn3D").classList.remove("btn-3d-active");

  Events.updateTransform();
  renderAll();
  if (isNew) UI.toggleSidebar();
  $("statsPanel").classList.add("active");
}

// --- ربط الدوال بـ Window ليراها الـ HTML ---
window.initMap = initMap;
window.toggleSidebar = UI.toggleSidebar;
window.toggleStats = UI.toggleStats;
window.toggleNightMode = UI.toggleNightMode;
window.toggleWatering = UI.toggleWatering;
window.exportMap = exportMap;
window.closeCard = UI.closeCard;
window.closeModal = UI.closeModal;
window.zoomMap =
  Events.zoomMap ||
  ((amt) => {
    state.scale += amt;
    Events.updateTransform();
  });
window.resetView = () => {
  state.scale = 1;
  state.pointX = 0;
  state.pointY = 0;
  state.rotation = 0;
  state.tilt = 0;
  state.is3D = false;
  Events.updateTransform();
  renderAll();
};

window.toggle3DView = () => {
  state.is3D = !state.is3D;
  const btn = $("btn3D");
  if (state.is3D) {
    state.tilt = 60;
    state.rotation = 0;
    btn.classList.add("btn-3d-active");
    UI.showToast("تم تفعيل وضع 3D");
  } else {
    state.tilt = 0;
    btn.classList.remove("btn-3d-active");
  }
  Events.updateTransform();
};

window.updzteIrrigation = (key, value) => {
  if (key === "offset") value = parxeFloat(value) || 0;
  state.irrigation[key] = value;
  renderAll();
};
window.toggleEditMode = () => {
  if (state.is3D) return UI.showToast("أغلق 3D أولاً");
  state.isEditMode = !state.isEditMode;
  if (!state.isEditMode) state.draggingVertex = -1;
  $("editBtn").classList.toggle("active-mode");
  renderAll();
  UI.showToast(
    state.isEditMode ? "وضع التعديل: اسحب الزوايا" : "تم حفظ الأبعاد",
  );
};
// أضف هذه الدالة مع بقية دوال الـ window
// دالة لفتح/إغلاق إعدادات التكلفة
window.toggleCostInputs = () => {
  const inputsDiv = document.getElementById('costInputs');
  inputsDiv.classList.toggle('open');
};
// في js/main.js

window.addBuilding = () => {
  // التأكد من وجود المصفوفة
  if (!state.buildings) state.buildings = [];

  // إضافة مبنى افتراضي في وسط الأرض (تقريباً)
  // أبعاده 10x10 متر
  state.buildings.push({
    x: 0,
    y: 0,
    w: 10,
    h: 10
  });

  renderAll();
  // إظهار رسالة
  const toast = document.getElementById('toast');
  if (toast) {
    toast.innerText = "تم إضافة مبنى 🏠 (اسحبه لتغيير مكانه، انقر مرتين لحذفه)";
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
};
// دالة تحديث الأسعار (تأكد أنها موجودة)
window.updatePrices = () => {
  // التأكد من وجود كائن الأسعار في الحالة
  if (!state.prices) state.prices = { tree: 50, hose: 10 };

  state.prices.tree = parseFloat(document.getElementById('priceTree').value) || 0;
  state.prices.hose = parseFloat(document.getElementById('priceHose').value) || 0;

  // إعادة الرسم لتحديث الأرقام
  renderAll();
};
// في js/main.js

window.addObstacle = (type) => {
  if (!state.buildings) state.buildings = [];

  let newObj = { x: 0, y: 0, type: type };

  // تخصيص الأبعاد والموقع حسب النوع
  if (type === 'road') {
    newObj.w = 100; // طريق طويل افتراضياً
    newObj.h = 6;   // عرض الطريق
    newObj.x = -50; // وضعه في المنتصف
  } else if (type === 'well') {
    newObj.w = 5;
    newObj.h = 5;
    newObj.x = 0;
  } else {
    // مبنى عادي
    newObj.w = 15;
    newObj.h = 10;
    newObj.x = 0;
  }

  state.buildings.push(newObj);
  renderAll();

  // رسالة توضيحية
  const labels = { road: 'طريق 🛣️', well: 'بئر 💧', house: 'مبنى 🏠' };
  showToast(`تم إضافة ${labels[type]}`);
};

// دالة مساعدة للتوست (للتأكد من وجودها)
function showToast(m) {
  const t = document.getElementById('toast');
  if (t) { t.innerText = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }
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

window.updatePrices = () => {
  state.prices.tree = parseFloat($('priceTree').value) || 0;
  state.prices.hose = parseFloat($('priceHose').value) || 0;
  renderAll(); // إعادة الرسم لتحديث الإحصائيات
};
window.undoAction = () => {
  if (historyStack.length === 0) return UI.showToast("لا يوجد خطوات للتراجع");
  const prev = historyStack.pop();
  state.vertices = prev.vertices;
  state.deletedTrees = prev.deletedTrees;
  state.deletedRows = prev.deletedRows;
  state.deletedCols = prev.deletedCols;
  state.movedTrees = prev.movedTrees;
  state.treeStatus = prev.treeStatus;

  // تحديث الشارة
  const badge = $("undoBadge");
  if (badge) badge.innerText = historyStack.length;

  renderAll();
  saveState();
  UI.showToast("تم التراجع");
};

// أدوات التصدير والاستيراد
window.downloadJSON = () => {
  const data = localStorage.getItem("farmData_v3");
  const blob = new Blob([data], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `farm_backup_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
};

window.triggerImport = () => $("fileInput").click();
window.importJSON = (input) => {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    pushHistory();
    loadDataJSON(e.target.result);
    saveState();
  };
  reader.readAsText(file);
  input.value = "";
};

window.askDelete = (t) => {
  if (!state.selectedTreeData) return;
  UI.openModal("تأكيد الحذف", "هل أنت متأكد؟", () => {
    pushHistory();
    const { r, c, key } = state.selectedTreeData;
    if (t == "tree") state.deletedTrees.add(key);
    if (t == "row") state.deletedRows.add(r);
    if (t == "col") state.deletedCols.add(c);
    UI.closeCard();
    renderAll();
    saveState();
    UI.showToast("تم الحذف");
  });
};

window.askRefresh = () => {
  UI.openModal("مسح الكل", "سيتم حذف المخطط الحالي!", () => {
    initMap(true);
    UI.showToast("تم إنشاء مخطط جديد");
  });
};
window.enableTreeMove = () => {
  pushHistory();
  state.movingTreeKey = state.selectedTreeData.key;
  UI.closeCard();
  renderAll();
  UI.showToast("اسحب الشجرة للمكان الجديد");
};
window.updateCropColor = () => {
  renderAll();
  saveState();
};
window.rotateMap = (deg) => {
  // تحديث زاوية الدوران
  state.rotation += deg;

  // استدعاء دالة التحديث من ملف الأحداث
  Events.updateTransform();

  // إظهار رسالة توضيحية
  UI.showToast(`زاوية الدوران: ${state.rotation}°`);
};
// تهيئة الأحداث عند التحميل
window.onload = () => {
  Events.setupEventListeners();
  initMap(false);

  // Event listener for Edge Input
  $("edgeInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      pushHistory();
      const newDist = parseFloat(e.target.value);
      const idx = state.editingEdgeIndex;
      if (newDist > 0 && idx !== -1) {
        // منطق تعديل الضلع المبسط
        const v1 = state.vertices[idx];
        const v2 = state.vertices[(idx + 1) % state.vertices.length];
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const ratio = newDist / Math.hypot(dx, dy);
        state.vertices[(idx + 1) % state.vertices.length] = {
          x: v1.x + dx * ratio,
          y: v1.y + dy * ratio,
        };
        renderAll();
        saveState();
        UI.showToast(`تم تعديل الطول إلى ${newDist}م`);
      }
      e.target.style.display = "none";
    }
  });
};
