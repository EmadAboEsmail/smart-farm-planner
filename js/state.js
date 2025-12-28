export const state = {
  scale: 1,
  panning: false,
  rotation: 0,
  tilt: 0,
  pointX: 0,
  pointY: 0,
  startX: 0,
  startY: 0,
  isEditMode: false,
  is3D: false,
  isWatering: false,
  draggingVertex: -1,
  vertices: [],
  deletedTrees: new Set(),
  deletedRows: new Set(),
  deletedCols: new Set(),
  movedTrees: new Map(),
  treeStatus: new Map(), // الإضافة الجديدة
  selectedTreeData: null,
  movingTreeKey: null,
  editingEdgeIndex: -1,
  cachedTreeData: new Map(),
  svgPolygon: null,
  cropType: "tree",
  irrigation: {
    mode: "row", // 'row' (أفقي) أو 'col' (عمودي)
    offset: 0, // مسافة الإزاحة عن المركز بالمتر
  },

  prices: {
    tree: 50, // السعر الافتراضي للشتلة
    hose: 10, // السعر الافتراضي لمتر الخرطوم
  },
  buildings: [],
  selectedBuildingIndex: -1,
  movingBuildingIndex: -1,
};

export const historyStack = [];
export const MAX_HISTORY = 20;

export function pushHistory() {
  const snapshot = {
    vertices: JSON.parse(JSON.stringify(state.vertices)),
    deletedTrees: new Set(state.deletedTrees),
    deletedRows: new Set(state.deletedRows),
    deletedCols: new Set(state.deletedCols),
    movedTrees: new Map(state.movedTrees),
    treeStatus: new Map(state.treeStatus),
  };
  historyStack.push(snapshot);
  if (historyStack.length > MAX_HISTORY) historyStack.shift();

  // تحديث واجهة التراجع (Badge)
  const badge = document.getElementById("undoBadge");
  if (badge) {
    badge.innerText = historyStack.length;
    badge.style.display = historyStack.length > 0 ? "flex" : "none";
  }
}
