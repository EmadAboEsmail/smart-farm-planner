import { state, pushHistory } from "./state.js";
import { renderAll } from "./render.js";
import { saveState } from "./storage.js";
import { $ } from "./utils.js";
import { closeCard, showBuildingCard } from "./ui.js";
// متغير لتخزين مصفوفة التحويل (لتحسين الأداء)
let cachedCTM = null;

export function setupEventListeners() {
  const mapContainer = $("mapContainer");
  const board = $("drawingBoard");

  // ========================================================
  // 1. الموجه الرئيسي للأحداث (Main Event Dispatchers)
  // هذه الدوال تستقبل الحدث وتوجهه للدالة المتخصصة المناسبة
  // ========================================================

  function handleStart(e) {
    if (shouldIgnoreEvent(e)) return; // تجاهل النقر على الأزرار

    closeCard();
    $("edgeInput").style.display = "none";
    initMatrix(); // تجهيز الحسابات

    // محاولة بدء سحب عناصر مختلفة بالترتيب
    if (tryStartVertexDrag()) return;
    if (tryStartBuildingDrag(e)) return;
    if (isTreeDragging()) return; // الشجر يبدأ من render.js لكن نتحقق هنا

    // إذا لم يكن أياً مما سبق، ابدأ سحب الخريطة
    startMapPan(e);
  }

  function handleMove(e) {
    // إذا لم يكن هناك أي نشاط سحب، لا تفعل شيئا
    if (!isAnyDragging()) return;

    e.preventDefault(); // منع السكرول في الموبايل
    const { x, y } = getEventCoords(e);
    const svgP = getSVGCoordinates(x, y); // تحويل الإحداثيات

    // توجيه الحركة للدالة المتخصصة
    if (state.draggingVertex !== -1) moveVertex(svgP);
    else if (state.movingBuildingIndex !== -1) moveBuilding(svgP);
    else if (state.movingTreeKey) moveTree(svgP);
    else if (state.panning) moveMap(x, y);
  }

  function handleEnd() {
    if (state.draggingVertex !== -1) endVertexDrag();
    if (state.movingBuildingIndex !== -1) endBuildingDrag();
    if (state.movingTreeKey) endTreeDrag();
    if (state.panning) endMapPan();

    cachedCTM = null; // تنظيف الذاكرة المؤقتة
  }

  // ========================================================
  // 2. دوال المنطق المتخصصة (Specialized Logic Functions)
  // ========================================================

  // --- دوال مساعدة (Helpers) ---
  function shouldIgnoreEvent(e) {
    const target = e.target;
    return (
      target &&
      (target.closest(".scroll-controls") ||
        target.closest(".sidebar") ||
        target.closest(".tree-card") ||
        target.closest(".floating-dock") ||
        target.closest("#edgeInput"))
    );
  }

  function initMatrix() {
    const svg = document.querySelector("#farmSvg");
    if (svg) cachedCTM = svg.getScreenCTM().inverse();
  }

  function getEventCoords(e) {
    // توحيد إحداثيات الماوس واللمس
    return {
      x: e.touches ? e.touches[0].clientX : e.clientX,
      y: e.touches ? e.touches[0].clientY : e.clientY,
    };
  }

  function getSVGCoordinates(clientX, clientY) {
    const svg = document.querySelector("#farmSvg");
    if (!svg) return { x: 0, y: 0 };

    let pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = cachedCTM || svg.getScreenCTM().inverse();
    return pt.matrixTransform(ctm);
  }

  function isAnyDragging() {
    return (
      state.panning ||
      state.draggingVertex !== -1 ||
      state.movingTreeKey ||
      state.movingBuildingIndex !== -1
    );
  }

  // --- منطق الزوايا (Vertex) ---
  function tryStartVertexDrag() {
    if (state.draggingVertex !== -1) {
      pushHistory();
      return true;
    }
    return false;
  }

  function moveVertex(svgP) {
    if (!state.isEditMode || !svgP) return;
    state.vertices[state.draggingVertex] = { x: svgP.x, y: svgP.y };

    // تحديث الـ DOM مباشرة للأداء
    if (state.svgPolygon) {
      state.svgPolygon.setAttribute(
        "points",
        state.vertices.map((v) => `${v.x},${v.y}`).join(" "),
      );
    }
    const handle = document.querySelector(
      `[data-vertex="${state.draggingVertex}"]`,
    );
    if (handle) {
      handle.setAttribute("cx", svgP.x);
      handle.setAttribute("cy", svgP.y);
    }
  }

  function endVertexDrag() {
    renderAll(); // إعادة حساب الشجر بعد تغيير الأرض
    saveState();
    state.draggingVertex = -1;
  }

  // --- منطق المباني (Buildings) ---
  function tryStartBuildingDrag(e) {
    const target = e.target;
    if (target && target.classList.contains("building-rect")) {
      const idx = parseInt(target.getAttribute("data-index"));
      if (!isNaN(idx)) {
        state.movingBuildingIndex = idx;
        showBuildingCard(idx);
        // حساب Offset لمنع القفز
        const { x, y } = getEventCoords(e);
        const svgP = getSVGCoordinates(x, y);

        state.dragOffsetX = svgP.x - state.buildings[idx].x;
        state.dragOffsetY = svgP.y - state.buildings[idx].y;
        return true;
      }
    }
    return false;
  }

  function moveBuilding(svgP) {
    if (!svgP) return;
    const b = state.buildings[state.movingBuildingIndex];
    b.x = svgP.x - (state.dragOffsetX || 0);
    b.y = svgP.y - (state.dragOffsetY || 0);

    // تحديث الـ DOM
    const rect = document.querySelector(
      `[data-index="${state.movingBuildingIndex}"]`,
    );
    if (rect) {
      rect.setAttribute("x", b.x);
      rect.setAttribute("y", b.y);
    }
  }

  function endBuildingDrag() {
    state.movingBuildingIndex = -1;
    renderAll(); // لإعادة رسم الشجر المخفي تحت المبنى
    saveState();
  }

  // --- منطق الأشجار (Trees) ---
  function isTreeDragging() {
    return !!state.movingTreeKey; // تم تعيينها في render.js
  }

  function moveTree(svgP) {
    if (!svgP) return;
    state.movedTrees.set(state.movingTreeKey, { x: svgP.x, y: svgP.y });

    const treeCircle = document.querySelector(
      `[data-key="${state.movingTreeKey}"]`,
    );
    if (treeCircle) {
      treeCircle.setAttribute("cx", svgP.x);
      treeCircle.setAttribute("cy", svgP.y);
      treeCircle.classList.add("tree-moving");
    }
  }

  function endTreeDrag() {
    const treeCircle = document.querySelector(
      `[data-key="${state.movingTreeKey}"]`,
    );
    if (treeCircle) treeCircle.classList.remove("tree-moving");

    state.movingTreeKey = null;
    saveState();
  }

  // --- منطق الخريطة (Map Pan) ---
  function startMapPan(e) {
    state.panning = true;
    const { x, y } = getEventCoords(e);
    state.startX = x - state.pointX;
    state.startY = y - state.pointY;
    $("drawingBoard").style.transition = "none";
    $("mapContainer").style.cursor = "grabbing";
  }

  function moveMap(clientX, clientY) {
    state.pointX = clientX - state.startX;
    state.pointY = clientY - state.startY;
    updateTransform();
  }

  function endMapPan() {
    state.panning = false;
    $("drawingBoard").style.transition = "transform 0.1s linear";
    $("mapContainer").style.cursor = "grab";
  }

  // ========================================================
  // 3. ربط الأحداث (Wiring)
  // ========================================================

  // Mouse Listeners
  mapContainer.addEventListener("mousedown", handleStart);
  window.addEventListener("mousemove", handleMove);
  window.addEventListener("mouseup", handleEnd);

  // Touch Listeners
  mapContainer.addEventListener(
    "touchstart",
    (e) => handleStart(e.touches[0] || e),
    { passive: false },
  );
  window.addEventListener("touchmove", handleMove, { passive: false });
  window.addEventListener("touchend", handleEnd);

  // Double Click (Delete Building)
  if (board) {
    board.addEventListener("dblclick", (e) => {
      if (e.target.classList.contains("building-rect")) {
        const idx = parseInt(e.target.getAttribute("data-index"));
        if (!isNaN(idx)) {
          state.buildings.splice(idx, 1);
          renderAll();
          saveState();
          showToast("تم حذف المبنى 🗑️");
        }
      }
    });
  }

  // Zoom Helper Export
  window.zoomMap = (amt) => {
    state.scale = Math.max(0.2, Math.min(5, state.scale + amt));
    updateTransform();
  };
}

// دالة مساعدة لتحديث CSS Transform
export function updateTransform() {
  $("drawingBoard").style.transform =
    `translate(${state.pointX}px, ${state.pointY}px) rotateX(${state.tilt}deg) rotateZ(${state.rotation}deg) scale(${state.scale})`;
}

// دالة مساعدة للتوست (يمكن استيرادها ولكن للتسهيل نضعها هنا أو نستخدم الموجودة في ui.js)
function showToast(msg) {
  const t = document.getElementById("toast");
  if (t) {
    t.innerText = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
  }
}
