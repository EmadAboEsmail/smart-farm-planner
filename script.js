// --- State Management ---
let state = {
  scale: 1, panning: false, rotation: 0, tilt: 0,
  pointX: 0, pointY: 0, startX: 0, startY: 0,
  isEditMode: false, is3D: false, isWatering: false,
  draggingVertex: -1,
  vertices: [],
  deletedTrees: new Set(), deletedRows: new Set(), deletedCols: new Set(),
  movedTrees: new Map(),
  selectedTreeData: null, movingTreeKey: null, editingEdgeIndex: -1,
  cachedTreeData: new Map(),
  svgPolygon: null,
  cropType: 'نخيل',
  treeStatus: new Map(), // Map لتخزين حالة الأشجار: key -> status
};

// 1. أضف هذا المتغير داخل كائن state الموجود في بداية السكريبت
// داخل let state = { ... }

// 2. استبدل دالة saveState بهذه النسخة المحدثة لتدعم الحالة

// 3. استبدل دالة loadState بهذه النسخة

// دالة مساعدة جديدة لتحميل البيانات (سنستخدمها للملفات أيضاً)


// History Stack for Undo
let historyStack = [];
const MAX_HISTORY = 20;

let modalCallback = null;
let animationFrameId = null;

const board = document.getElementById('drawingBoard');
const mapContainer = document.getElementById('mapContainer');
const treeCard = document.getElementById('treeCard');
const edgeInput = document.getElementById('edgeInput');
const modal = document.getElementById('customModal');

// --- Initialization & Persistence ---
function initMap(isNew = false) {
  if (isNew) {
    const L = parseFloat(document.getElementById('landLength').value) || 100;
    const W = parseFloat(document.getElementById('landWidth').value) || 60;
    state.vertices = [{ x: -L / 2, y: -W / 2 }, { x: L / 2, y: -W / 2 }, { x: L / 2, y: W / 2 }, { x: -L / 2, y: W / 2 }];
    state.deletedTrees.clear(); state.deletedRows.clear(); state.deletedCols.clear(); state.movedTrees.clear();
    state.cropType = document.getElementById('cropType').value;
    saveState(); // Save initial state
  } else {
    loadState(); // Try loading from LocalStorage
  }

  state.scale = 1; state.pointX = 0; state.pointY = 0; state.rotation = 0; state.tilt = 0;
  state.isEditMode = false; document.getElementById('editBtn').classList.remove('active-mode');
  state.is3D = false; document.getElementById('btn3D').classList.remove('btn-3d-active');

  updateTransform();
  renderAll();
  if (isNew) toggleSidebar();
  document.getElementById('statsPanel').classList.add('active');
}

// --- Save/Load System ---
function saveState() {
  const data = {
    vertices: state.vertices,
    deletedTrees: Array.from(state.deletedTrees),
    deletedRows: Array.from(state.deletedRows),
    deletedCols: Array.from(state.deletedCols),
    movedTrees: Array.from(state.movedTrees.entries()),
    // السطر الجديد: تحويل الـ Map إلى Array للحفظ
    treeStatus: Array.from(state.treeStatus.entries()),
    cropType: state.cropType,
    inputs: {
      rowSpacing: document.getElementById('rowSpacing').value,
      treeSpacing: document.getElementById('treeSpacing').value
    }
  };
  // نحفظ أيضاً كملف مؤقت
  localStorage.setItem('farmData_v3', JSON.stringify(data));
}

function loadState() {
  const saved = localStorage.getItem('farmData_v3');
  if (saved) { loadDataJSON(saved); }
  else { initMap(true); }
}
function loadDataJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    state.vertices = data.vertices;
    state.deletedTrees = new Set(data.deletedTrees);
    state.deletedRows = new Set(data.deletedRows);
    state.deletedCols = new Set(data.deletedCols);
    state.movedTrees = new Map(data.movedTrees);
    // استرجاع حالات الأشجار
    state.treeStatus = new Map(data.treeStatus || []);

    state.cropType = data.cropType || 'نخيل';
    document.getElementById('cropType').value = state.cropType;
    if (data.inputs) {
      document.getElementById('rowSpacing').value = data.inputs.rowSpacing;
      document.getElementById('treeSpacing').value = data.inputs.treeSpacing;
    }
    showToast("تم تحميل البيانات بنجاح");
    renderAll(); // إعادة رسم فورية
  } catch (e) {
    console.error("Error loading data", e);
    showToast("خطأ في تحميل الملف");
  }
}


// --- Undo System ---
function pushHistory() {
  const snapshot = {
    vertices: JSON.parse(JSON.stringify(state.vertices)),
    deletedTrees: new Set(state.deletedTrees),
    deletedRows: new Set(state.deletedRows),
    deletedCols: new Set(state.deletedCols),
    movedTrees: new Map(state.movedTrees)
  };
  historyStack.push(snapshot);
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  updateUndoBadge();
  saveState(); // Auto-save on every action
}

function undoAction() {
  if (historyStack.length === 0) return showToast("لا يوجد خطوات للتراجع");
  const prev = historyStack.pop();
  state.vertices = prev.vertices;
  state.deletedTrees = prev.deletedTrees;
  state.deletedRows = prev.deletedRows;
  state.deletedCols = prev.deletedCols;
  state.movedTrees = prev.movedTrees;
  updateUndoBadge();
  renderAll();
  saveState();
  showToast("تم التراجع");
}

function updateUndoBadge() {
  const badge = document.getElementById('undoBadge');
  badge.innerText = historyStack.length;
  badge.style.display = historyStack.length > 0 ? 'flex' : 'none';
}

// --- Rendering ---
function renderAll() {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(() => {
    const rS = parseFloat(document.getElementById('rowSpacing').value) || 8;
    const tS = parseFloat(document.getElementById('treeSpacing').value) || 6;
    state.cropType = document.getElementById('cropType').value;

    board.innerHTML = '';

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let v of state.vertices) {
      minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
    }

    const width = maxX - minX; const height = maxY - minY;
    const pad = Math.max(width, height) * 0.3;
    const viewBox = `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", viewBox);
    svg.style.overflow = "visible";
    svg.id = "farmSvg"; // For export
    if (state.isWatering) svg.classList.add('watering-active');

    // Definitions (Gradients based on crop)
    const defs = document.createElementNS(svgNS, "defs");
    const grad = document.createElementNS(svgNS, "radialGradient");
    grad.setAttribute("id", "treeGrad");
    grad.setAttribute("cx", "30%"); grad.setAttribute("cy", "30%"); grad.setAttribute("r", "70%");

    // Dynamic Colors
    let color1 = "#81c784", color2 = "#2e7d32"; // Default (Palm)
    if (state.cropType === 'مانجو') { color1 = "#ffcc80"; color2 = "#ef6c00"; }
    else if (state.cropType === 'حمضيات') { color1 = "#fff59d"; color2 = "#fbc02d"; }
    else if (state.cropType === 'زيتون') { color1 = "#c5e1a5"; color2 = "#558b2f"; }
    else if (state.cropType === 'عنب') { color1 = "#e1bee7"; color2 = "#8e24aa"; }

    grad.innerHTML = `<stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/>`;
    defs.appendChild(grad);
    svg.appendChild(defs);

    // Land
    const polygon = document.createElementNS(svgNS, "polygon");
    polygon.setAttribute("points", state.vertices.map(v => `${v.x},${v.y}`).join(" "));
    polygon.setAttribute("fill", "#e8f5e9");
    polygon.setAttribute("stroke", "#4caf50");
    polygon.setAttribute("stroke-width", "2");
    polygon.setAttribute("vector-effect", "non-scaling-stroke");
    state.svgPolygon = polygon;
    svg.appendChild(polygon);

    // Layers
    const pipesGroup = document.createElementNS(svgNS, "g");
    const treesGroup = document.createElementNS(svgNS, "g");

    let treeCount = 0;
    const treeRadius = Math.min(tS, rS) * 0.35;
    let rowIdx = 0;
    state.cachedTreeData.clear();

    for (let y = minY + rS / 2; y < maxY; y += rS) {
      rowIdx++;
      if (state.deletedRows.has(rowIdx)) continue;

      let colIdx = 0;
      let rowPoints = [];

      for (let x = minX + tS / 2; x < maxX; x += tS) {
        if (x < minX || x > maxX || y < minY || y > maxY) continue;

        if (isPointInPolygon({ x, y }, state.vertices)) {
          colIdx++;
          const treeKey = `${rowIdx}-${colIdx}`;

          if (state.deletedCols.has(colIdx)) continue;
          if (state.deletedTrees.has(treeKey)) continue;

          treeCount++;
          let finalX = x; let finalY = y;
          if (state.movedTrees.has(treeKey)) {
            const pos = state.movedTrees.get(treeKey);
            finalX = pos.x; finalY = pos.y;
          }
          rowPoints.push({ x: finalX, y: finalY });

          const circle = document.createElementNS(svgNS, "circle");
          circle.setAttribute("cx", finalX); circle.setAttribute("cy", finalY);
          circle.setAttribute("r", treeRadius);
          circle.setAttribute("fill", "url(#treeGrad)");
          circle.setAttribute("class", "tree-node");
          circle.setAttribute("data-key", treeKey);
          if (state.movingTreeKey === treeKey) circle.classList.add('tree-moving');
          state.cachedTreeData.set(treeKey, { type: state.cropType, r: rowIdx, c: colIdx, num: treeCount, key: treeKey });
          treesGroup.appendChild(circle);
        }
      }

      // Draw Irrigation Pipe for this row
      if (rowPoints.length > 1) {
        const path = document.createElementNS(svgNS, "polyline");
        const pointsStr = rowPoints.map(p => `${p.x},${p.y}`).join(" ");
        path.setAttribute("points", pointsStr);
        path.setAttribute("class", "irrigation-line");
        pipesGroup.appendChild(path);
      }
    }

    svg.appendChild(pipesGroup); // Pipes first (behind trees)
    svg.appendChild(treesGroup);

    if (state.isEditMode) renderHandles(svg, svgNS);

    svg.addEventListener('mousedown', handleSvgInteraction);
    svg.addEventListener('touchstart', handleSvgInteraction, { passive: false });

    board.appendChild(svg);
    updateStats(treeCount);
  });
}

function renderHandles(svg, svgNS) {
  const handlesFragment = document.createDocumentFragment();
  let cx = 0, cy = 0;
  state.vertices.forEach(v => { cx += v.x; cy += v.y });
  cx /= state.vertices.length; cy /= state.vertices.length;

  state.vertices.forEach((v, i) => {
    const nextV = state.vertices[(i + 1) % state.vertices.length];
    const dist = Math.hypot(nextV.x - v.x, nextV.y - v.y);
    const midX = (v.x + nextV.x) / 2;
    const midY = (v.y + nextV.y) / 2;
    const dx = nextV.x - v.x; const dy = nextV.y - v.y;
    let nx = -dy; let ny = dx;
    const len = Math.hypot(nx, ny); nx /= len; ny /= len;
    if (nx * (cx - midX) + ny * (cy - midY) > 0) { nx = -nx; ny = -ny; }
    const textX = midX + (nx * 25); const textY = midY + (ny * 25);

    const group = document.createElementNS(svgNS, "g");
    group.style.cursor = "pointer";
    group.onclick = (e) => { e.stopPropagation(); showEdgeInput(dist, i, e.clientX, e.clientY); };

    const bg = document.createElementNS(svgNS, "rect");
    bg.setAttribute("x", textX - 25); bg.setAttribute("y", textY - 12);
    bg.setAttribute("width", "50"); bg.setAttribute("height", "24");
    bg.setAttribute("class", "edge-label-bg");
    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", textX); text.setAttribute("y", textY);
    text.setAttribute("text-anchor", "middle"); text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("class", "edge-label");
    text.textContent = dist.toFixed(1) + 'm';
    group.appendChild(bg); group.appendChild(text);
    handlesFragment.appendChild(group);

    const handle = document.createElementNS(svgNS, "circle");
    handle.setAttribute("cx", v.x); handle.setAttribute("cy", v.y);
    handle.setAttribute("r", 6);
    handle.setAttribute("class", "vertex-handle");
    handle.setAttribute("data-vertex", i);
    handlesFragment.appendChild(handle);
  });
  svg.appendChild(handlesFragment);
}

// --- Interaction ---
function handleSvgInteraction(e) {
  const evt = e.touches ? e.touches[0] : e;
  const target = e.target;
  if (target.classList.contains('tree-node')) {
    const key = target.getAttribute('data-key');
    if (key && state.cachedTreeData.has(key)) {
      if (state.movingTreeKey === key) return;
      e.preventDefault(); e.stopPropagation();
      showTreeCard(evt, state.cachedTreeData.get(key));
      return;
    }
  }
  if (state.isEditMode && target.classList.contains('vertex-handle')) {
    const idx = parseInt(target.getAttribute('data-vertex'));
    if (!isNaN(idx)) {
      pushHistory(); // Save state before drag
      e.preventDefault(); e.stopPropagation();
      state.draggingVertex = idx;
      board.style.transition = 'none';
      return;
    }
  }
}

mapContainer.onmousedown = startPan;
mapContainer.ontouchstart = (e) => startPan(e.touches[0]);

function startPan(e) {
  if (e.target.closest('.scroll-controls') || e.target.closest('.sidebar') || e.target.closest('.tree-card') || e.target.closest('#edgeInput')) return;
  closeCard(); edgeInput.style.display = 'none';
  if (!state.movingTreeKey && state.draggingVertex === -1) {
    state.panning = true;
    state.startX = e.clientX - state.pointX;
    state.startY = e.clientY - state.pointY;
    board.style.transition = 'none';
    mapContainer.style.cursor = 'grabbing';
  }
}

mapContainer.onmousemove = movePan;
mapContainer.ontouchmove = (e) => {
  if (state.panning || state.draggingVertex !== -1 || state.movingTreeKey) e.preventDefault();
  movePan(e.touches[0]);
};

function movePan(e) {
  const svg = document.querySelector('svg');
  if (state.draggingVertex !== -1 && state.isEditMode && svg) {
    let pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    state.vertices[state.draggingVertex] = { x: svgP.x, y: svgP.y };
    if (state.svgPolygon) {
      state.svgPolygon.setAttribute("points", state.vertices.map(v => `${v.x},${v.y}`).join(" "));
      const handle = svg.querySelector(`[data-vertex="${state.draggingVertex}"]`);
      if (handle) { handle.setAttribute("cx", svgP.x); handle.setAttribute("cy", svgP.y); }
    }
  } else if (state.movingTreeKey && svg) {
    let pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    state.movedTrees.set(state.movingTreeKey, { x: svgP.x, y: svgP.y });
    requestAnimationFrame(renderAll);
  } else if (state.panning) {
    state.pointX = e.clientX - state.startX;
    state.pointY = e.clientY - state.startY;
    requestAnimationFrame(updateTransform);
  }
}

mapContainer.onmouseup = mapContainer.ontouchend = () => {
  if (state.draggingVertex !== -1) { renderAll(); saveState(); }
  state.panning = false; state.draggingVertex = -1;
  board.style.transition = 'transform 0.1s linear';
  mapContainer.style.cursor = 'grab';
  if (state.movingTreeKey) { state.movingTreeKey = null; renderAll(); saveState(); showToast("تم تثبيت الشجرة"); }
};

// --- Features ---
function updateCropColor() { renderAll(); saveState(); }
function toggle3DView() {
  state.is3D = !state.is3D;
  const btn = document.getElementById('btn3D');
  if (state.is3D) { state.tilt = 60; state.rotation = 0; btn.classList.add('btn-3d-active'); showToast("تم تفعيل وضع 3D"); }
  else { state.tilt = 0; btn.classList.remove('btn-3d-active'); }
  updateTransform();
}
function updateTransform() { board.style.transform = `translate(${state.pointX}px, ${state.pointY}px) rotateX(${state.tilt}deg) rotateZ(${state.rotation}deg) scale(${state.scale})`; }
function zoomMap(amt) { state.scale = Math.max(0.2, Math.min(5, state.scale + amt)); updateTransform(); }
function resetView() { state.scale = 1; state.pointX = 0; state.pointY = 0; state.rotation = 0; state.tilt = 0; state.is3D = false; document.getElementById('btn3D').classList.remove('btn-3d-active'); updateTransform(); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
function toggleStats() { document.getElementById('statsPanel').classList.toggle('active'); }
function toggleNightMode() { document.body.classList.toggle('night-mode'); }
function toggleWatering() { state.isWatering = !state.isWatering; renderAll(); showToast(state.isWatering ? "نظام الري يعمل 💧" : "تم إيقاف الري"); }

function exportMap() {
  const svgData = new XMLSerializer().serializeToString(document.getElementById("farmSvg"));
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "farm_layout.svg";
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  showToast("تم تحميل المخطط");
}

function showTreeCard(e, data) {
  state.selectedTreeData = data;
  document.getElementById('cardCropType').innerText = data.type;
  document.getElementById('cardDetails').innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:5px"><span>رقم الشجرة:</span><b>${data.num}</b></div><div style="display:flex;justify-content:space-between"><span>الموقع:</span><span>صف ${data.r} - عمود ${data.c}</span></div>`;
  let left = e.clientX; let top = e.clientY;
  if (left < 110) left = 110; if (left > window.innerWidth - 110) left = window.innerWidth - 110;
  treeCard.style.left = left + 'px'; treeCard.style.top = top + 'px'; treeCard.style.display = 'flex';
}
function closeCard() { treeCard.style.display = 'none'; state.selectedTreeData = null; }

function showEdgeInput(dist, idx, cx, cy) {
  state.editingEdgeIndex = idx;
  edgeInput.value = dist.toFixed(1);
  edgeInput.style.left = (cx - 50) + 'px'; edgeInput.style.top = (cy - 40) + 'px';
  edgeInput.style.display = 'block'; edgeInput.focus();
}
edgeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyEdgeChange(); });

function applyEdgeChange() {
  pushHistory();
  const newDist = parseFloat(edgeInput.value);
  const idx = state.editingEdgeIndex;
  if (newDist > 0 && idx !== -1) {
    const v1 = state.vertices[idx]; const v2 = state.vertices[(idx + 1) % state.vertices.length];
    const dx = v2.x - v1.x; const dy = v2.y - v1.y;
    const ratio = newDist / Math.hypot(dx, dy);
    state.vertices[(idx + 1) % state.vertices.length] = { x: v1.x + dx * ratio, y: v1.y + dy * ratio };
    renderAll(); saveState(); showToast(`تم تعديل الطول إلى ${newDist}م`);
  }
  edgeInput.style.display = 'none';
}

function isPointInPolygon(p, vs) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    if (((vs[i].y > p.y) !== (vs[j].y > p.y)) && (p.x < (vs[j].x - vs[i].x) * (p.y - vs[i].y) / (vs[j].y - vs[i].y) + vs[i].x)) inside = !inside;
  }
  return inside;
}
function updateStats(count) {
  let area = 0;
  for (let i = 0; i < state.vertices.length; i++) {
    let j = (i + 1) % state.vertices.length;
    area += state.vertices[i].x * state.vertices[j].y; area -= state.vertices[j].x * state.vertices[i].y;
  }
  area = Math.abs(area / 2);
  document.getElementById('statArea').innerText = Math.round(area).toLocaleString();
  document.getElementById('statTrees').innerText = count;
  document.getElementById('statDensity').innerText = area > 0 ? Math.round(count / (area / 10000)) : 0;
}

function openModal(t, m, c) { document.getElementById('modalTitle').innerText = t; document.getElementById('modalMsg').innerText = m; modal.style.display = 'flex'; modalCallback = c; }
function closeModal(v) { modal.style.display = 'none'; if (v && modalCallback) modalCallback(); modalCallback = null; }
function askDelete(t) {
  if (!state.selectedTreeData) return;
  openModal('تأكيد الحذف', 'هل أنت متأكد؟', () => {
    pushHistory();
    const { r, c, key } = state.selectedTreeData;
    if (t == 'tree') state.deletedTrees.add(key);
    if (t == 'row') state.deletedRows.add(r);
    if (t == 'col') state.deletedCols.add(c);
    closeCard(); renderAll(); saveState(); showToast("تم الحذف");
  });
}
function askRefresh() { openModal('مسح الكل', 'سيتم حذف المخطط الحالي بالكامل!', () => { initMap(true); showToast("تم إنشاء مخطط جديد"); }); }
function enableTreeMove() { pushHistory(); state.movingTreeKey = state.selectedTreeData.key; closeCard(); renderAll(); showToast("اسحب الشجرة للمكان الجديد"); }
function showToast(m) { const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function toggleEditMode() {
  if (state.is3D) return showToast("أغلق 3D أولاً");
  state.isEditMode = !state.isEditMode;
  if (!state.isEditMode) state.draggingVertex = -1;
  document.getElementById('editBtn').classList.toggle('active-mode');
  renderAll();
  showToast(state.isEditMode ? "وضع التعديل: اسحب الزوايا" : "تم حفظ الأبعاد");
}

window.onload = () => initMap(false);
