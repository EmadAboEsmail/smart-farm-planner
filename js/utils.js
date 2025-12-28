export function isPointInPolygon(p, vs) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    if (
      vs[i].y > p.y !== vs[j].y > p.y &&
      p.x <
      ((vs[j].x - vs[i].x) * (p.y - vs[i].y)) / (vs[j].y - vs[i].y) + vs[i].x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function getStatusLabel(s) {
  return (
    { healthy: "سليمة", sick: "مريضة", dead: "ميتة", harvested: "محصودة" }[s] ||
    s
  );
}

// دالة مساعدة للحصول على مرجع العناصر
export const $ = (id) => document.getElementById(id);
