import { state } from './state.js';
import { isPointInPolygon, $ } from './utils.js';
import { showTreeCard, showEdgeInput } from './ui.js';

let animationFrameId = null;
const svgNS = "http://www.w3.org/2000/svg";

/**
 * Main Entry Point: Renders the entire scene.
 * This function acts as the "Orchestrator".
 */
export function renderAll() {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(() => {
    const board = $('drawingBoard');
    if (!board) return;

    state.cropType = "شجرة"; // Default crop type
    board.innerHTML = '';

    // 1. Setup SVG Context
    const bounds = getBounds(state.vertices);
    const svg = createSVGContext(bounds);

    // 2. Draw Background (Land)
    drawLand(svg);

    // 3. Grid System (The Core Logic)
    // We delegate the complex work to a manager function
    const stats = drawGridManager(svg, bounds);

    // 4. Draw UI Handles (Edit Mode)
    if (state.isEditMode) renderHandles(svg);

    // 5. Attach Events & Finalize
    setupEvents(svg);
    board.appendChild(svg);

    // 6. Update UI Statistics
    updateStats(stats.treeCount, stats.totalPipeLength);
  });
}

// ==========================================
// 1. Grid Manager (The Orchestrator)
// ==========================================

/**
 * Manages the calculation and rendering of the grid items.
 * It separates "Data Calculation" from "Visual Rendering".
 */
function drawGridManager(svg, { minX, minY, maxX, maxY }) {
  // A. Gather Configuration
  const rS = parseFloat($('rowSpacing').value) || 8;
  const tS = parseFloat($('treeSpacing').value) || 6;
  const treeRadius = Math.min(tS, rS) * 0.35;
  const irrig = state.irrigation || { mode: 'row', offset: 0 };
  const isRowMode = irrig.mode === 'row';

  // B. Calculation Phase (No drawing here, just math)
  const { pipeDataMap, treeDataList, count } = calculateGridPositions(
    minX, minY, maxX, maxY, rS, tS, isRowMode, irrig
  );

  // C. Rendering Phase (Drawing based on calculated data)

  // 1. Render Buildings (Layer 0 - Bottom)
  const buildingsGroup = renderBuildings();

  // 2. Render Pipes (Layer 1 - Middle)
  const { group: pipesGroup, length: totalPipeLength } = renderPipes(pipeDataMap, isRowMode);

  // 3. Render Trees (Layer 2 - Top)
  const treesGroup = renderTrees(treeDataList, treeRadius);

  // D. Assemble Layers
  svg.appendChild(buildingsGroup);
  svg.appendChild(pipesGroup);
  svg.appendChild(treesGroup);

  return { treeCount: count, totalPipeLength };
}

// ==========================================
// 2. Calculation Logic (Pure Math)
// ==========================================

/**
 * Calculates where trees and pipes should go.
 * Returns data structures, not DOM elements.
 */
function calculateGridPositions(minX, minY, maxX, maxY, rS, tS, isRowMode, irrig) {
  const pipeDataMap = new Map();
  const treeDataList = [];
  let treeCount = 0;
  let rowIdx = 0;

  state.cachedTreeData.clear();
  const buildings = state.buildings || [];

  for (let y = minY + rS / 2; y < maxY; y += rS) {
    rowIdx++;
    if (state.deletedRows.has(rowIdx)) continue;
    let colIdx = 0;

    for (let x = minX + tS / 2; x < maxX; x += tS) {
      // Optimization: Skip out of bounds
      if (x < minX || x > maxX || y < minY || y > maxY) continue;

      // 1. Check Obstacles (Buildings)
      if (isLocationBlocked(x, y, buildings)) continue;

      // 2. Check Land Boundaries
      if (isPointInPolygon({ x, y }, state.vertices)) {
        colIdx++;
        const treeKey = `${rowIdx}-${colIdx}`;

        if (state.deletedCols.has(colIdx) || state.deletedTrees.has(treeKey)) continue;

        treeCount++;

        // A. Collect Pipe Data (Based on original grid position)
        const groupKey = isRowMode ? rowIdx : colIdx;
        if (!pipeDataMap.has(groupKey)) pipeDataMap.set(groupKey, []);

        const offsetX = !isRowMode ? irrig.offset : 0;
        const offsetY = isRowMode ? irrig.offset : 0;

        pipeDataMap.get(groupKey).push({
          x: x + offsetX,
          y: y + offsetY
        });

        // B. Collect Tree Data (Account for moved trees)
        let treeX = x, treeY = y;
        if (state.movedTrees.has(treeKey)) {
          const pos = state.movedTrees.get(treeKey);
          treeX = pos.x; treeY = pos.y;
        }

        treeDataList.push({
          x: treeX,
          y: treeY,
          key: treeKey,
          r: rowIdx,
          c: colIdx,
          num: treeCount
        });
      }
    }
  }

  return { pipeDataMap, treeDataList, count: treeCount };
}

/**
 * Checks if a point [x,y] is inside any building rect.
 */
function isLocationBlocked(x, y, buildings) {
  if (!buildings.length) return false;
  return buildings.some(b =>
    x >= b.x && x <= b.x + b.w &&
    y >= b.y && y <= b.y + b.h
  );
}

// ==========================================
// 3. Renderers (DOM/SVG Creation)
// ==========================================

// في js/render.js

function renderBuildings() {
  const group = document.createElementNS(svgNS, "g");
  const buildings = state.buildings || [];

  buildings.forEach((b, index) => {
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", b.x);
    rect.setAttribute("y", b.y);
    rect.setAttribute("width", b.w);
    rect.setAttribute("height", b.h);

    // التحقق هل هذا المبنى هو المحدد حالياً؟
    const isSelected = (state.selectedBuildingIndex === index);

    if (isSelected) {
      // ستايل المبنى المحدد (أزرق ومضيء)
      rect.setAttribute("fill", "#e3f2fd");
      rect.setAttribute("stroke", "#2196f3");
      rect.setAttribute("stroke-width", "3");
      rect.setAttribute("opacity", "0.9");
    } else {
      // الستايل العادي (أحمر)
      rect.setAttribute("fill", "#ffcdd2");
      rect.setAttribute("stroke", "#c62828");
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("opacity", "0.6");
    }

    rect.style.cursor = "move";
    rect.setAttribute("class", "building-rect");
    rect.setAttribute("data-index", index);

    group.appendChild(rect);
  });
  return group;
}
function renderPipes(pipeDataMap, isRowMode) {
  const group = document.createElementNS(svgNS, "g");
  let totalLength = 0;

  pipeDataMap.forEach(points => {
    // Sort points to ensure straight lines
    points.sort((a, b) => isRowMode ? a.x - b.x : a.y - b.y);

    if (points.length > 1) {
      // Calculate length
      for (let i = 0; i < points.length - 1; i++) {
        totalLength += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      }

      const path = document.createElementNS(svgNS, "polyline");
      path.setAttribute("points", points.map(p => `${p.x},${p.y}`).join(" "));

      // Dynamic Styling (Watering vs Normal)
      if (state.isWatering) {
        path.setAttribute("class", "irrigation-line flowing");
        // Remove inline styles to allow CSS animation
        path.style.stroke = "";
        path.style.strokeDasharray = "";
      } else {
        path.setAttribute("class", "irrigation-line");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "black");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        // Force styles for solid black line
        path.style.stroke = "black";
        path.style.strokeDasharray = "none";
        path.style.opacity = "0.8";
      }
      group.appendChild(path);
    }
  });
  return { group, length: totalLength };
}

function renderTrees(treeList, radius) {
  const group = document.createElementNS(svgNS, "g");

  treeList.forEach(data => {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", data.x);
    circle.setAttribute("cy", data.y);
    circle.setAttribute("r", radius);
    circle.setAttribute("fill", "url(#treeGrad)");

    // Classes for movement and interaction
    let cssClass = "tree-node";
    if (state.movingTreeKey === data.key) cssClass += " tree-moving";
    circle.setAttribute("class", cssClass);
    circle.setAttribute("data-key", data.key);

    group.appendChild(circle);

    // Store data for UI interaction (Clicking)
    state.cachedTreeData.set(data.key, {
      type: "شجرة", r: data.r, c: data.c, num: data.num, key: data.key
    });
  });

  return group;
}

// ==========================================
// 4. Helpers & Event Setup
// ==========================================

function getBounds(vertices) {
  if (vertices.length === 0) return { minX: -50, minY: -50, maxX: 50, maxY: 50 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let v of vertices) {
    minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
  }
  return { minX, minY, maxX, maxY };
}

function createSVGContext({ minX, minY, maxX, maxY }) {
  const width = maxX - minX;
  const height = maxY - minY;
  const pad = Math.max(width, height) * 0.3;
  const viewBox = `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`;

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", viewBox);
  svg.style.overflow = "visible";
  svg.id = "farmSvg";
  if (state.isWatering) svg.classList.add('watering-active');

  const defs = document.createElementNS(svgNS, "defs");
  defs.innerHTML = `<radialGradient id="treeGrad" cx="30%" cy="30%" r="70%"><stop offset="0%" stop-color="#81c784"/><stop offset="100%" stop-color="#2e7d32"/></radialGradient>`;
  svg.appendChild(defs);
  return svg;
}

function drawLand(svg) {
  const polygon = document.createElementNS(svgNS, "polygon");
  polygon.setAttribute("points", state.vertices.map(v => `${v.x},${v.y}`).join(" "));
  polygon.setAttribute("fill", "#e8f5e9");
  polygon.setAttribute("stroke", "#4caf50");
  polygon.setAttribute("stroke-width", "2");
  polygon.setAttribute("vector-effect", "non-scaling-stroke");
  state.svgPolygon = polygon;
  svg.appendChild(polygon);
}

function renderHandles(svg) {
  const fragment = document.createDocumentFragment();
  state.vertices.forEach((v, i) => {
    const nextV = state.vertices[(i + 1) % state.vertices.length];
    const dist = Math.hypot(nextV.x - v.x, nextV.y - v.y);
    const midX = (v.x + nextV.x) / 2;
    const midY = (v.y + nextV.y) / 2;

    const labelGroup = document.createElementNS(svgNS, "g");
    labelGroup.style.cursor = "pointer";
    labelGroup.onclick = (e) => { e.stopPropagation(); showEdgeInput(dist, i, e.clientX, e.clientY); };

    const bg = document.createElementNS(svgNS, "rect");
    const w = 40, h = 18;
    bg.setAttribute("x", midX - w / 2); bg.setAttribute("y", midY - h / 1.5);
    bg.setAttribute("width", w); bg.setAttribute("height", h);
    bg.setAttribute("fill", "white");
    bg.setAttribute("rx", "4");
    bg.setAttribute("stroke", "#ccc");
    bg.setAttribute("stroke-width", "0.5");

    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", midX); text.setAttribute("y", midY);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "#1565c0");
    text.setAttribute("font-size", "11px");
    text.setAttribute("font-weight", "bold");
    text.textContent = dist.toFixed(1) + "m";

    labelGroup.appendChild(bg);
    labelGroup.appendChild(text);
    fragment.appendChild(labelGroup);

    const handle = document.createElementNS(svgNS, "circle");
    handle.setAttribute("cx", v.x); handle.setAttribute("cy", v.y);
    handle.setAttribute("r", 6);
    handle.setAttribute("class", "vertex-handle");
    handle.setAttribute("data-vertex", i);
    fragment.appendChild(handle);
  });
  svg.appendChild(fragment);
}

function setupEvents(svg) {
  svg.addEventListener('mousedown', handleSvgInteraction);
  svg.addEventListener('touchstart', handleSvgInteraction, { passive: false });
}

function handleSvgInteraction(e) {
  const evt = e.touches ? e.touches[0] : e;
  const target = e.target;
  if (target.classList.contains('tree-node')) {
    const key = target.getAttribute('data-key');
    if (key && state.cachedTreeData.has(key)) {
      if (state.movingTreeKey === key) return;
      e.preventDefault(); e.stopPropagation();
      showTreeCard(evt, state.cachedTreeData.get(key));
    }
  } else if (state.isEditMode && target.classList.contains('vertex-handle')) {
    const idx = parseInt(target.getAttribute('data-vertex'));
    if (!isNaN(idx)) {
      state.draggingVertex = idx;
      const board = $('drawingBoard');
      if (board) board.style.transition = 'none';
    }
  }
}

function updateStats(count, pipeLength) {
  let area = 0;
  const n = state.vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += state.vertices[i].x * state.vertices[j].y;
    area -= state.vertices[j].x * state.vertices[i].y;
  }
  area = Math.abs(area / 2);

  const elArea = $('statArea');
  const elTrees = $('statTrees');
  const elDensity = $('statDensity');

  if (elArea) elArea.innerText = Math.round(area).toLocaleString();
  if (elTrees) elTrees.innerText = count;
  if (elDensity) elDensity.innerText = area > 0 ? Math.round(count / (area / 10000)) : 0;

  const elCost = $('statTotalCost');
  const prices = state.prices || { tree: 50, hose: 10 };

  if (elCost) {
    const treeCost = count * prices.tree;
    const hoseCost = pipeLength * prices.hose;
    const total = treeCost + hoseCost;

    elCost.innerText = Math.round(total).toLocaleString();
    elCost.title = `شجر: ${Math.round(treeCost).toLocaleString()} | خراطيم: ${Math.round(hoseCost).toLocaleString()} (${Math.round(pipeLength)}م)`;
  }
}
