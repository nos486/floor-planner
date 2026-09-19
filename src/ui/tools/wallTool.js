import { dist } from '../../core/geometry.js';

export class WallTool {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = canvas.state;
    this.startPoint = null;
    this.currentPoint = null;
    this.snapInfo = null;
    this.firstPointInChain = null;
  }

  activate() {
    this.reset();
  }

  deactivate() {
    this.reset();
    this.canvas.clearOverlay();
  }

  reset() {
    this.startPoint = null;
    this.currentPoint = null;
    this.snapInfo = null;
    this.firstPointInChain = null;
    this.canvas.clearOverlay();
  }

  onMouseMove(e, worldPos) {
    const snap = this.canvas.snapEngine.resolveSnap({
      point: worldPos,
      startPoint: this.startPoint,
      walls: this.state.project.walls,
      zoom: this.state.ui.zoom,
      enableGrid: this.state.ui.snapToGrid,
      enableEndpoint: this.state.ui.snapToEndpoints,
      enableAngle: this.state.ui.snapToAngles,
      forceAngleSnap: e.shiftKey
    });

    this.currentPoint = snap.point;
    this.snapInfo = snap;

    this.renderPreview();
  }

  onClick(e, worldPos) {
    if (!this.currentPoint) return;

    if (!this.startPoint) {
      // Begin new wall or chain
      this.startPoint = [...this.currentPoint];
      this.firstPointInChain = [...this.currentPoint];
      this.renderPreview();
      return;
    }

    // Check if clicked back on start point or too short
    const d = dist(this.startPoint, this.currentPoint);
    if (d < 10) return; // ignore accidental micro click

    // Add wall segment
    const addedWall = this.state.addWall(
      this.startPoint,
      this.currentPoint,
      this.state.ui.wallDefaultThickness
    );

    // If snapped back to first point in chain, close and finish
    if (this.firstPointInChain && dist(this.currentPoint, this.firstPointInChain) < 5) {
      this.reset();
      return;
    }

    // Continue polyline
    this.startPoint = [...this.currentPoint];
    this.renderPreview();
  }

  onDblClick(e) {
    // Finish drawing current wall chain
    this.reset();
  }

  onKeyDown(e) {
    if (e.key === 'Escape') {
      this.reset();
    }
  }

  renderPreview() {
    if (!this.canvas.overlayGroup) return;
    this.canvas.clearOverlay();

    if (!this.currentPoint) return;

    // Render snap indicator
    if (this.snapInfo && this.snapInfo.type !== 'none') {
      this.canvas.renderSnapIndicator(this.currentPoint, this.snapInfo);
    }

    if (!this.startPoint) {
      // Just cursor circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint[0]);
      circle.setAttribute('cy', this.currentPoint[1]);
      circle.setAttribute('r', 5 / this.state.ui.zoom);
      circle.setAttribute('class', 'preview-cursor');
      this.canvas.overlayGroup.appendChild(circle);
      return;
    }

    // Render ghost wall preview
    const p1 = this.startPoint;
    const p2 = this.currentPoint;
    const thickness = this.state.ui.wallDefaultThickness;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1[0]);
    line.setAttribute('y1', p1[1]);
    line.setAttribute('x2', p2[0]);
    line.setAttribute('y2', p2[1]);
    line.setAttribute('stroke-width', thickness);
    line.setAttribute('class', 'preview-wall');
    this.canvas.overlayGroup.appendChild(line);

    // Dimension label
    const lengthUnits = dist(p1, p2);
    const unitsPerMeter = this.state.project.scale.unitsPerMeter || 100;
    const lengthM = (lengthUnits / unitsPerMeter).toFixed(2);

    const midX = (p1[0] + p2[0]) / 2;
    const midY = (p1[1] + p2[1]) / 2;

    this.canvas.renderDimensionBadge(midX, midY, `${lengthM} m`);
  }
}
