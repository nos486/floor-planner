import { dist, pointsEqual } from './geometry.js';

/**
 * Snapping engine for grid, endpoints, and angles.
 */
export class SnapEngine {
  constructor(options = {}) {
    this.gridSize = options.gridSize || 20; // world units (e.g. 20 cm)
    this.endpointSnapRadius = options.endpointSnapRadius || 15; // screen pixels
    this.angleThresholdDeg = options.angleThresholdDeg || 6; // snap to orthogonal/45 if within 6 degrees
  }

  /**
   * Snaps a world coordinate point to the nearest grid line.
   */
  snapToGrid(point, gridSize = this.gridSize) {
    const x = Math.round(point[0] / gridSize) * gridSize;
    const y = Math.round(point[1] / gridSize) * gridSize;
    return [x, y];
  }

  /**
   * Finds closest wall endpoint within screen radius
   * @param {Array<number>} point - Current mouse position [x, y] in world units
   * @param {Array} walls - List of wall objects
   * @param {number} zoom - Current canvas zoom factor (to calculate world threshold from screen pixels)
   * @param {string|null} excludeWallId - Wall ID to exclude from snapping
   * @param {Array<number>|null} excludePoint - Specific point to exclude
   */
  snapToEndpoint(point, walls, zoom = 1, excludeWallId = null, excludePoint = null) {
    const worldRadius = this.endpointSnapRadius / zoom;
    let closestPoint = null;
    let minDistance = worldRadius;
    let matchedEndpointType = null; // 'start' | 'end'
    let matchedWallId = null;

    for (const wall of walls) {
      if (excludeWallId && wall.id === excludeWallId) continue;

      const endpoints = [
        { pt: wall.points[0], type: 'start' },
        { pt: wall.points[1], type: 'end' }
      ];

      for (const ep of endpoints) {
        if (excludePoint && pointsEqual(ep.pt, excludePoint, 0.001)) {
          continue;
        }

        const d = dist(point, ep.pt);
        if (d < minDistance) {
          minDistance = d;
          closestPoint = [...ep.pt];
          matchedEndpointType = ep.type;
          matchedWallId = wall.id;
        }
      }
    }

    if (closestPoint) {
      return {
        point: closestPoint,
        snapped: true,
        type: 'endpoint',
        wallId: matchedWallId,
        endpointType: matchedEndpointType,
        distance: minDistance
      };
    }

    return { point, snapped: false, type: null };
  }

  /**
   * Snaps a candidate point to 0°, 45°, 90°, 135°, 180°, etc. relative to startPoint.
   */
  snapToAngle(startPoint, currentPoint, forceSnap = false) {
    const dx = currentPoint[0] - startPoint[0];
    const dy = currentPoint[1] - startPoint[1];
    const length = Math.hypot(dx, dy);

    if (length < 1e-4) {
      return { point: [...currentPoint], snapped: false, angleDeg: 0 };
    }

    let angleRad = Math.atan2(dy, dx);
    let angleDeg = (angleRad * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;

    // Find nearest 45-degree increment (0, 45, 90, 135, 180, 225, 270, 315)
    const targetAngleDeg = Math.round(angleDeg / 45) * 45;
    const diff = Math.abs(angleDeg - targetAngleDeg);

    if (forceSnap || diff <= this.angleThresholdDeg || (360 - diff) <= this.angleThresholdDeg) {
      const snappedRad = (targetAngleDeg * Math.PI) / 180;
      const snappedX = startPoint[0] + length * Math.cos(snappedRad);
      const snappedY = startPoint[1] + length * Math.sin(snappedRad);
      return {
        point: [Math.round(snappedX * 100) / 100, Math.round(snappedY * 100) / 100],
        snapped: true,
        angleDeg: targetAngleDeg % 360,
        guide: {
          start: [...startPoint],
          angle: targetAngleDeg % 360
        }
      };
    }

    return { point: currentPoint, snapped: false, angleDeg };
  }

  /**
   * Comprehensive snap function that resolves endpoint snap (highest priority),
   * then angle snap, then grid snap.
   */
  resolveSnap({
    point,
    startPoint = null,
    walls = [],
    zoom = 1,
    enableGrid = true,
    enableEndpoint = true,
    enableAngle = true,
    forceAngleSnap = false,
    excludeWallId = null,
    excludePoint = null
  }) {
    let resultPoint = [...point];
    let snapInfo = {
      point: resultPoint,
      type: 'none',
      guide: null
    };

    // 1. Endpoint snapping (Highest priority)
    if (enableEndpoint && walls.length > 0) {
      const epSnap = this.snapToEndpoint(resultPoint, walls, zoom, excludeWallId, excludePoint);
      if (epSnap.snapped) {
        return {
          point: epSnap.point,
          type: 'endpoint',
          target: epSnap,
          guide: null
        };
      }
    }

    // 2. Angle snapping relative to start point
    if (enableAngle && startPoint) {
      const angleSnap = this.snapToAngle(startPoint, resultPoint, forceAngleSnap);
      if (angleSnap.snapped) {
        resultPoint = angleSnap.point;
        snapInfo = {
          point: resultPoint,
          type: 'angle',
          angleDeg: angleSnap.angleDeg,
          guide: angleSnap.guide
        };
      }
    }

    // 3. Grid snapping
    if (enableGrid && snapInfo.type !== 'angle') {
      const gridPoint = this.snapToGrid(resultPoint);
      return {
        point: gridPoint,
        type: 'grid',
        guide: null
      };
    }

    return snapInfo;
  }
}
