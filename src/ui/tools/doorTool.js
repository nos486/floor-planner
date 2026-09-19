import { dist, projectPointOnSegment, vec, vecNormalize } from '../../core/geometry.js';

export class DoorTool {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = canvas.state;
    this.preview = null;
    this.doorWidth = this.state.ui.doorDefaultWidth || 90;
    this.flipped = false;
    this.side = 1;
  }

  activate() {
    this.preview = null;
    this.doorWidth = this.state.ui.doorDefaultWidth || 90;
  }

  deactivate() {
    this.preview = null;
    this.canvas.clearOverlay();
  }

  onMouseMove(e, worldPos) {
    const wallHit = this.findWallAt(worldPos);
    if (!wallHit) {
      this.preview = null;
      this.canvas.clearOverlay();
      return;
    }

    this.preview = {
      wall: wallHit.wall,
      offset: wallHit.offset,
      doorPos: wallHit.projectedPoint,
      side: this.side,
      flipped: this.flipped,
      width: this.doorWidth
    };

    this.renderPreview();
  }

  onClick(e, worldPos) {
    if (!this.preview) return;

    this.state.addDoor(
      this.preview.wall.id,
      this.preview.offset,
      this.doorWidth,
      this.flipped
    );

    // Keep side/flipped settings, ready to place another door
    this.renderPreview();
  }

  onKeyDown(e) {
    if (e.key === 'f' || e.key === 'F' || e.code === 'Space') {
      e.preventDefault();
      // Flip swing direction / side
      this.side = -this.side;
      if (this.preview) {
        this.preview.side = this.side;
        this.renderPreview();
      }
    } else if (e.key === 'Escape') {
      this.preview = null;
      this.canvas.clearOverlay();
    }
  }

  findWallAt(worldPos) {
    const maxScreenDist = 35;
    const maxWorldDist = maxScreenDist / this.state.ui.zoom;
    let closest = null;
    let minD = maxWorldDist;

    for (const wall of this.state.project.walls) {
      const p1 = wall.points[0];
      const p2 = wall.points[1];
      const proj = projectPointOnSegment(worldPos, p1, p2);
      const wallLen = dist(p1, p2);

      // Ensure door fits comfortably on wall
      if (wallLen >= this.doorWidth && proj.distance < minD) {
        // Clamp offset so door doesn't exceed wall ends
        const halfW = this.doorWidth / 2;
        const currentDistFromP1 = proj.t * wallLen;
        const clampedOffset = Math.max(halfW, Math.min(wallLen - halfW, currentDistFromP1));
        const clampedT = clampedOffset / wallLen;

        const clampedPos = [
          p1[0] + clampedT * (p2[0] - p1[0]),
          p1[1] + clampedT * (p2[1] - p1[1])
        ];

        minD = proj.distance;
        closest = {
          wall,
          offset: clampedOffset,
          projectedPoint: clampedPos,
          wallLength: wallLen
        };
      }
    }

    return closest;
  }

  renderPreview() {
    this.canvas.clearOverlay();
    if (!this.preview) return;

    const { wall, offset, width, side, flipped } = this.preview;
    const p1 = wall.points[0];
    const p2 = wall.points[1];
    const wallLen = dist(p1, p2);
    if (wallLen === 0) return;

    const dir = [(p2[0] - p1[0]) / wallLen, (p2[1] - p1[1]) / wallLen];
    const normal = [-dir[1], dir[0]];

    const center = [
      p1[0] + dir[0] * offset,
      p1[1] + dir[1] * offset
    ];

    // Door opening endpoints
    const halfW = width / 2;
    const hinge = [
      center[0] - dir[0] * halfW,
      center[1] - dir[1] * halfW
    ];
    const strike = [
      center[0] + dir[0] * halfW,
      center[1] + dir[1] * halfW
    ];

    // Swing arc and door leaf
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'preview-door-group');

    // Highlight wall segment opening
    const openingLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    openingLine.setAttribute('x1', hinge[0]);
    openingLine.setAttribute('y1', hinge[1]);
    openingLine.setAttribute('x2', strike[0]);
    openingLine.setAttribute('y2', strike[1]);
    openingLine.setAttribute('stroke-width', wall.thickness + 4);
    openingLine.setAttribute('class', 'door-opening-cut');
    g.appendChild(openingLine);

    // Door leaf line (90 degree swing)
    const swingNormal = [normal[0] * side, normal[1] * side];
    const leafEnd = [
      hinge[0] + swingNormal[0] * width,
      hinge[1] + swingNormal[1] * width
    ];

    const leafLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    leafLine.setAttribute('x1', hinge[0]);
    leafLine.setAttribute('y1', hinge[1]);
    leafLine.setAttribute('x2', leafEnd[0]);
    leafLine.setAttribute('y2', leafEnd[1]);
    leafLine.setAttribute('class', 'door-leaf');
    g.appendChild(leafLine);

    // 90 degree swing arc
    const arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const sweepFlag = side > 0 ? 1 : 0;
    const d = `M ${strike[0]} ${strike[1]} A ${width} ${width} 0 0 ${sweepFlag} ${leafEnd[0]} ${leafEnd[1]}`;
    arcPath.setAttribute('d', d);
    arcPath.setAttribute('class', 'door-arc');
    g.appendChild(arcPath);

    this.canvas.overlayGroup.appendChild(g);

    // Hint badge
    this.canvas.renderDimensionBadge(center[0], center[1] - 25 / this.state.ui.zoom, `${(width / (this.state.project.scale.unitsPerMeter || 100)).toFixed(2)}m Door [Press Space or F to flip]`);
  }
}
