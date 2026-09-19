import {
  dist,
  distSq,
  polygonArea,
  signedPolygonArea,
  polygonCentroid,
  pointInPolygon,
  projectPointOnSegment,
  segmentIntersection,
  generateId
} from './geometry.js';

const EPSILON = 0.5; // vertex merge tolerance in world units

/**
 * Builds a planar graph from walls and detects all enclosed room polygons.
 */
export function detectRooms(walls, scale = { unitsPerMeter: 100 }, existingRooms = []) {
  if (!walls || walls.length < 3) {
    return [];
  }

  // 1. Gather all line segments from walls
  let rawSegments = walls.map(w => ({
    p1: [...w.points[0]],
    p2: [...w.points[1]],
    wallId: w.id
  })).filter(s => dist(s.p1, s.p2) > 1);

  if (rawSegments.length < 3) return [];

  // 2. Split intersecting segments and T-junctions
  const splitSegments = splitAllSegments(rawSegments);

  // 3. Build unique nodes and adjacency
  const { nodes, edges } = buildPlanarGraph(splitSegments);

  // 4. Extract interior faces (cycles) using left-turn traversal
  const rawPolygons = extractFaces(nodes, edges);

  // 5. Filter and format rooms
  const unitsPerMeter = scale.unitsPerMeter || 100;
  const detectedRooms = [];

  for (const poly of rawPolygons) {
    const areaUnitsSq = polygonArea(poly);
    // Convert to square meters
    const areaM2 = areaUnitsSq / (unitsPerMeter * unitsPerMeter);

    // Exclude micro slivers (< 0.1 m^2)
    if (areaM2 < 0.1) continue;

    const centroid = polygonCentroid(poly);

    // Try to match with existing room to preserve custom name
    let matchedName = null;
    let matchedId = null;

    for (const er of existingRooms) {
      // Check if old centroid was inside new polygon or vice versa
      if (er.centroid && (dist(centroid, er.centroid) < unitsPerMeter * 1.5 || pointInPolygon(er.centroid, poly))) {
        matchedName = er.name;
        matchedId = er.id;
        break;
      }
    }

    detectedRooms.push({
      id: matchedId || generateId('room'),
      name: matchedName || `Room ${detectedRooms.length + 1}`,
      points: poly,
      areaM2: Math.round(areaM2 * 100) / 100,
      centroid: [Math.round(centroid[0] * 10) / 10, Math.round(centroid[1] * 10) / 10]
    });
  }

  // Sort rooms by position (top-left to bottom-right) for stable ordering
  detectedRooms.sort((a, b) => {
    if (Math.abs(a.centroid[1] - b.centroid[1]) > 50) {
      return a.centroid[1] - b.centroid[1];
    }
    return a.centroid[0] - b.centroid[0];
  });

  return detectedRooms;
}

/**
 * Splits segments at intersections and T-junctions to form a valid planar graph.
 */
function splitAllSegments(segments) {
  let segs = segments.map(s => ({
    p1: [s.p1[0], s.p1[1]],
    p2: [s.p2[0], s.p2[1]],
    wallId: s.wallId
  }));

  const SPLIT_TOLERANCE = 1.0;
  let changed = true;
  let iterations = 0;
  const maxIterations = 30;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Check segment-segment intersections
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const s1 = segs[i];
        const s2 = segs[j];
        const inter = segmentIntersection(s1.p1, s1.p2, s2.p1, s2.p2);

        if (inter.intersects && inter.point) {
          const pt = inter.point;
          const split1 = dist(pt, s1.p1) > SPLIT_TOLERANCE && dist(pt, s1.p2) > SPLIT_TOLERANCE;
          const split2 = dist(pt, s2.p1) > SPLIT_TOLERANCE && dist(pt, s2.p2) > SPLIT_TOLERANCE;

          if (split1) {
            segs.splice(i, 1,
              { p1: s1.p1, p2: pt, wallId: s1.wallId },
              { p1: pt, p2: s1.p2, wallId: s1.wallId }
            );
            changed = true;
            break;
          }
          if (split2) {
            segs.splice(j, 1,
              { p1: s2.p1, p2: pt, wallId: s2.wallId },
              { p1: pt, p2: s2.p2, wallId: s2.wallId }
            );
            changed = true;
            break;
          }
        }
      }
      if (changed) break;
    }

    if (changed) continue;

    // Check T-junctions: when an endpoint of one segment lies strictly interior to another segment
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      for (const pt of [s.p1, s.p2]) {
        for (let j = 0; j < segs.length; j++) {
          if (i === j) continue;
          const target = segs[j];
          const proj = projectPointOnSegment(pt, target.p1, target.p2);
          if (proj.distance <= SPLIT_TOLERANCE) {
            const dStart = dist(proj.point, target.p1);
            const dEnd = dist(proj.point, target.p2);
            if (dStart > SPLIT_TOLERANCE && dEnd > SPLIT_TOLERANCE) {
              segs.splice(j, 1,
                { p1: target.p1, p2: proj.point, wallId: target.wallId },
                { p1: proj.point, p2: target.p2, wallId: target.wallId }
              );
              changed = true;
              break;
            }
          }
        }
        if (changed) break;
      }
      if (changed) break;
    }
  }

  return segs;
}

/**
 * Builds nodes and adjacency lists for planar graph
 */
function buildPlanarGraph(segments) {
  const nodes = [];

  function getOrCreateNode(pt) {
    for (let i = 0; i < nodes.length; i++) {
      if (dist(nodes[i], pt) <= EPSILON) {
        return i;
      }
    }
    nodes.push([pt[0], pt[1]]);
    return nodes.length - 1;
  }

  const adj = new Map(); // nodeIdx -> Array of { target: nodeIdx, angle: number }

  for (const s of segments) {
    const u = getOrCreateNode(s.p1);
    const v = getOrCreateNode(s.p2);

    if (u === v) continue;

    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);

    const ptU = nodes[u];
    const ptV = nodes[v];

    const angleUV = Math.atan2(ptV[1] - ptU[1], ptV[0] - ptU[0]);
    const angleVU = Math.atan2(ptU[1] - ptV[1], ptU[0] - ptV[0]);

    // Avoid duplicate parallel edges
    if (!adj.get(u).some(e => e.target === v)) {
      adj.get(u).push({ target: v, angle: angleUV });
    }
    if (!adj.get(v).some(e => e.target === u)) {
      adj.get(v).push({ target: u, angle: angleVU });
    }
  }

  // Sort outgoing edges around each node in counter-clockwise order
  for (const [node, edgesList] of adj.entries()) {
    edgesList.sort((a, b) => a.angle - b.angle);
  }

  return { nodes, edges: adj };
}

/**
 * Extracts all minimal enclosed faces using the next-leftmost-edge rule.
 */
function extractFaces(nodes, adj) {
  const visitedHalfEdges = new Set(); // Key: "u->v"
  const faces = [];

  for (const [u, outgoing] of adj.entries()) {
    for (const edge of outgoing) {
      const v = edge.target;
      const key = `${u}->${v}`;
      if (visitedHalfEdges.has(key)) continue;

      // Start traversing face cycle
      const cycle = [u];
      let currU = u;
      let currV = v;
      let validCycle = true;
      const pathEdges = [];

      while (true) {
        const edgeKey = `${currU}->${currV}`;
        visitedHalfEdges.add(edgeKey);
        pathEdges.push(edgeKey);
        cycle.push(currV);

        // Find the reverse edge currV -> currU in currV's outgoing edges
        const vOutgoing = adj.get(currV);
        if (!vOutgoing || vOutgoing.length === 0) {
          validCycle = false;
          break;
        }

        // Find index of reverse edge currV -> currU
        const revIdx = vOutgoing.findIndex(e => e.target === currU);
        if (revIdx === -1) {
          validCycle = false;
          break;
        }

        // The next edge in the face is the one immediately preceding revIdx (modulo length)
        // because outgoing edges are sorted CCW, moving clockwise around vertex turns left relative to incoming edge!
        const nextEdgeIdx = (revIdx - 1 + vOutgoing.length) % vOutgoing.length;
        const nextEdge = vOutgoing[nextEdgeIdx];

        currU = currV;
        currV = nextEdge.target;

        if (currU === u && currV === v) {
          // Returned to origin!
          break;
        }

        if (cycle.length > nodes.length * 2) {
          // Loop runaway protection
          validCycle = false;
          break;
        }
      }

      if (validCycle && cycle.length > 3) {
        // Drop the duplicate closing vertex from cycle
        const polygonNodeIndices = cycle.slice(0, -1);
        const polygonPoints = polygonNodeIndices.map(idx => nodes[idx]);
        const signedArea = signedPolygonArea(polygonPoints);
        // Interior faces in standard planar traversal
        // If CCW in screen coordinates: signedArea is positive or negative?
        // Let's keep all non-degenerate faces where signedArea != 0 and filter out the exterior face
        faces.push({ points: polygonPoints, signedArea });
      }
    }
  }

  // In SVG screen coordinates (y down):
  // When half-edge traversal turns right/left along faces, the unbounded exterior face has signedArea < 0,
  // and all enclosed interior room faces have signedArea > 0!
  const candidateFaces = [];
  for (const f of faces) {
    if (f.signedArea > 0) {
      candidateFaces.push(f.points);
    }
  }

  // Deduplicate identical faces
  const uniqueFaces = [];
  for (const f of candidateFaces) {
    const area = polygonArea(f);
    const c = polygonCentroid(f);
    const isDup = uniqueFaces.some(existing => {
      const exArea = polygonArea(existing);
      const exC = polygonCentroid(existing);
      return Math.abs(area - exArea) < 1 && dist(c, exC) < 5;
    });

    if (!isDup) {
      uniqueFaces.push(f);
    }
  }

  return uniqueFaces;
}
