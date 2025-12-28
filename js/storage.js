import { renderAll } from "./render.js";
import { state } from "./state.js";
import { showToast } from "./ui.js";
import { $ } from "./utils.js";

export function saveState() {
  const data = {
    vertices: state.vertices,
    deletedTrees: Array.from(state.deletedTrees),
    deletedRows: Array.from(state.deletedRows),
    deletedCols: Array.from(state.deletedCols),
    movedTrees: Array.from(state.movedTrees.entries()),
    treeStatus: Array.from(state.treeStatus.entries()),
    cropType: state.cropType,
    inputs: {
      rowSpacing: $("rowSpacing").value,
      treeSpacing: $("treeSpacing").value,
    },
  };
  localStorage.setItem("farmData_v3", JSON.stringify(data));
}

export function loadState() {
  const saved = localStorage.getItem("farmData_v3");
  if (saved) {
    loadDataJSON(saved);
  } else {
    initMap(true);
  }
}

export function loadDataJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    state.vertices = data.vertices;
    state.deletedTrees = new Set(data.deletedTrees);
    state.deletedRows = new Set(data.deletedRows);
    state.deletedCols = new Set(data.deletedCols);
    state.movedTrees = new Map(data.movedTrees);
    state.treeStatus = new Map(data.treeStatus || []);
    state.cropType = data.cropType || "نخيل";
    // $("cropType").value = state.cropType;
    if (data.inputs) {
      $("rowSpacing").value = data.inputs.rowSpacing;
      $("treeSpacing").value = data.inputs.treeSpacing;
    }
    showToast("تم تحميل البيانات بنجاح");
    renderAll();
  } catch (e) {
    console.error("Error loading data", e);
    showToast("خطأ في تحميل الملف");
  }
}

export function exportMap() {
  const svgData = new XMLSerializer().serializeToString($("farmSvg"));
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "farm_layout.svg";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("تم تحميل المخطط");
}
