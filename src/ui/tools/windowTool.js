import { dist, projectPointOnSegment } from '../../core/geometry.js';

export class WindowTool {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = canvas.state;
    this.preview = null;
    this.windowWidth = this.state.ui.windowDefaultWidth || 120;
  }

  activate() {
    this.preview = null;
    this.windowWidth = this.state.ui.windowDefaultWidth || 120;
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
      projectedPoint: wallHit.projectedPoint,
      width: this.windowWidth
    };

    this.renderPreview();
  }

  onClick(e, worldPos) {
    if (!this.preview) return;

    this.state.addWindow(
      this.preview.wall.id,
      this.preview.offset,
      this.windowWidth
    );

    this.renderPreview();
  }

  onKeyDown(e) {
    if (e.key === 'Escape') {
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

      if (wallLen >= this.windowWidth && proj.distance < minD) {
        const halfW = this.windowWidth / 2;
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

    const { wall, offset, width } = this.preview;
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

    const halfW = width / 2;
    const halfT = wall.thickness / 2;

    const startPt = [center[0] - dir[0] * halfW, center[1] - dir[1] * halfW];
    const endPt = [center[0] + dir[0] * halfW, center[1] + dir[1] * halfW];

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'preview-window-group');

    // Base opening cut
    const cutLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cutLine.setAttribute('x1', startPt[0]);
    cutLine.setAttribute('y1', startPt[1]);
    cutLine.setAttribute('x2', endPt[0]);
    cutLine.setAttribute('y2', endPt[1]);
    cutLine.setAttribute('stroke-width', wall.thickness + 2);
    cutLine.setAttribute('class', 'window-opening-cut');
    g.appendChild(cutLine);

    // Double glass lines
    for (const sign of [-0.3, 0.3]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', startPt[0] + normal[0] * (halfT * sign));
      line.setAttribute('y1', startPt[1] + normal[1] * (halfT * sign));
      line.setAttribute('x2', endPt[0] + normal[0] * (halfT * sign));
      line.setAttribute('y2', endPt[1] + normal[1] * (halfT * sign));
      line.setAttribute('class', 'window-glass-line');
      g.appendChild(line);
    }

    this.canvas.overlayGroup.appendChild(g);

    // Badge
    this.canvas.renderDimensionBadge(center[0], center[1] - 25 / this.state.ui.zoom, `${(width / (this.state.project.scale.unitsPerMeter || 100)).toFixed(2)}m Window`);
  }
}
