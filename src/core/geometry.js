/**
 * Vector and geometric utilities for 2D floor planning.
 */

export function dist(p1, p2) {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
}

export function distSq(p1, p2) {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return dx * dx + dy * dy;
}

export function vec(p1, p2) {
  return [p2[0] - p1[0], p2[1] - p1[1]];
}

export function vecLen(v) {
  return Math.hypot(v[0], v[1]);
}

export function vecNormalize(v) {
  const len = Math.hypot(v[0], v[1]);
  if (len === 0) return [0, 0];
  return [v[0] / len, v[1] / len];
}

export function vecDot(u, v) {
  return u[0] * v[0] + u[1] * v[1];
}

export function vecCross(u, v) {
  return u[0] * v[1] - u[1] * v[0];
}

export function pointsEqual(p1, p2, tolerance = 0.001) {
  return Math.abs(p1[0] - p2[0]) <= tolerance && Math.abs(p1[1] - p2[1]) <= tolerance;
}

/**
 * Projects point p onto segment [a, b].
 * Returns { point: [x, y], t: number, distance: number }
 * where t is clamped in [0, 1].
 */
export function projectPointOnSegment(p, a, b) {
  const ab = vec(a, b);
  const abLenSq = distSq(a, b);
  if (abLenSq === 0) {
    return { point: [...a], t: 0, distance: dist(p, a) };
  }
  const ap = vec(a, p);
  let t = vecDot(ap, ab) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const projected = [a[0] + t * ab[0], a[1] + t * ab[1]];
  return { point: projected, t, distance: dist(p, projected) };
}

/**
 * Calculate signed polygon area (positive if counterclockwise, negative if clockwise)
 */
export function signedPolygonArea(points) {
  const n = points.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += points[i][0] * points[j][1] - points[j][0] * points[i][1];
  }
  return sum / 2;
}

/**
 * Calculate absolute polygon area using Shoelace formula
 */
export function polygonArea(points) {
  return Math.abs(signedPolygonArea(points));
}

/**
 * Calculates centroid of a polygon
 */
export function polygonCentroid(points) {
  const n = points.length;
  if (n === 0) return [0, 0];
  if (n === 1) return [...points[0]];
  if (n === 2) return [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];

  let cx = 0;
  let cy = 0;
  let signedArea = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = points[i][0] * points[j][1] - points[j][0] * points[i][1];
    signedArea += a;
    cx += (points[i][0] + points[j][0]) * a;
    cy += (points[i][1] + points[j][1]) * a;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-7) {
    // Degenerate polygon, compute average
    let avgX = 0;
    let avgY = 0;
    for (const p of points) {
      avgX += p[0];
      avgY += p[1];
    }
    return [avgX / n, avgY / n];
  }

  cx /= 6 * signedArea;
  cy /= 6 * signedArea;
  return [cx, cy];
}

/**
 * Ray casting algorithm to check if a point lies inside a polygon
 */
export function pointInPolygon(point, vs) {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Angle in degrees from p1 to p2, normalized to [0, 360)
 */
export function angleBetweenPoints(p1, p2) {
  const rad = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

/**
 * Checks if two line segments [p1, p2] and [p3, p4] intersect.
 * Returns { intersects: boolean, point: [x, y] | null, t1: number, t2: number }
 */
export function segmentIntersection(p1, p2, p3, p4, tolerance = 1e-5) {
  const d1x = p2[0] - p1[0];
  const d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0];
  const d2y = p4[1] - p3[1];

  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < tolerance) {
    return { intersects: false, point: null, t1: 0, t2: 0 };
  }

  const dx = p3[0] - p1[0];
  const dy = p3[1] - p1[1];

  const t1 = (dx * d2y - dy * d2x) / cross;
  const t2 = (dx * d1y - dy * d1x) / cross;

  if (t1 >= -tolerance && t1 <= 1 + tolerance && t2 >= -tolerance && t2 <= 1 + tolerance) {
    const clampedT1 = Math.max(0, Math.min(1, t1));
    return {
      intersects: true,
      point: [p1[0] + clampedT1 * d1x, p1[1] + clampedT1 * d1y],
      t1: clampedT1,
      t2: Math.max(0, Math.min(1, t2))
    };
  }

  return { intersects: false, point: null, t1, t2 };
}

/**
 * Generates unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}
