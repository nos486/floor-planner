export class PanTool {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = canvas.state;
    this.isDragging = false;
    this.startPos = { x: 0, y: 0 };
  }

  activate() {
    this.canvas.svg.style.cursor = 'grab';
    this.canvas.clearOverlay();
  }

  deactivate() {
    this.isDragging = false;
    this.canvas.svg.style.cursor = '';
  }

  onMouseDown(e) {
    if (e.button === 0) {
      this.isDragging = true;
      this.startPos = { x: e.clientX, y: e.clientY };
      this.canvas.svg.style.cursor = 'grabbing';
    }
  }

  onMouseMove(e) {
    if (this.isDragging) {
      const dx = e.clientX - this.startPos.x;
      const dy = e.clientY - this.startPos.y;
      this.startPos = { x: e.clientX, y: e.clientY };
      this.state.ui.pan.x += dx;
      this.state.ui.pan.y += dy;
      this.canvas.applyTransform();
    }
  }

  onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.svg.style.cursor = 'grab';
      this.state.notify('view_change');
    }
  }
}
