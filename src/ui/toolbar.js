export class Toolbar {
  constructor(containerEl, state, canvas) {
    this.container = containerEl;
    this.state = state;
    this.canvas = canvas;
    this.render();
    this.bindEvents();

    // Subscribe to state updates
    this.state.subscribe((s, type) => {
      this.updateActiveTool();
      this.updateHistoryButtons();
    });

    this.state.history.subscribe(() => {
      this.updateHistoryButtons();
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="toolbar-pill">
        <div class="tool-group">
          <button class="tool-btn active" data-tool="select" title="Select & Move (1 or V)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3l7 18 3-7 7-3L3 3z"/>
            </svg>
            <span>Select</span>
          </button>
          <button class="tool-btn" data-tool="pan" title="Pan / Hand Tool (H or Space)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 11V6a2 2 0 0 0-4 0v5"/>
              <path d="M14 10V4a2 2 0 0 0-4 0v7"/>
              <path d="M10 10.5V6a2 2 0 0 0-4 0v8"/>
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83L7 15"/>
            </svg>
            <span>Pan</span>
          </button>
          <button class="tool-btn" data-tool="wall" title="Wall Tool (2 or W)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="8" width="18" height="8" rx="1"/>
              <line x1="8" y1="8" x2="8" y2="16"/>
              <line x1="16" y1="8" x2="16" y2="16"/>
            </svg>
            <span>Wall</span>
          </button>
          <button class="tool-btn" data-tool="door" title="Door Tool (3 or D)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 20h16M6 20V4h8v16M14 4a8 8 0 0 1 8 8v8"/>
            </svg>
            <span>Door</span>
          </button>
          <button class="tool-btn" data-tool="window" title="Window Tool (4 or I)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="12" y1="3" x2="12" y2="21"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
            </svg>
            <span>Window</span>
          </button>
        </div>

        <div class="toolbar-divider"></div>

        <div class="tool-group">
          <button class="tool-btn icon-only" id="btn-undo" title="Undo (Ctrl+Z)" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
            </svg>
          </button>
          <button class="tool-btn icon-only" id="btn-redo" title="Redo (Ctrl+Y)" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
            </svg>
          </button>
          <button class="tool-btn icon-only danger" id="btn-delete" title="Delete Selected (Del / Backspace)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-divider"></div>

        <div class="tool-group zoom-group">
          <button class="tool-btn icon-only" id="btn-zoom-out" title="Zoom Out (-)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <button class="zoom-level-btn" id="btn-zoom-reset" title="Click to reset zoom to 100%">100%</button>
          <button class="tool-btn icon-only" id="btn-zoom-in" title="Zoom In (+)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <button class="tool-btn icon-only" id="btn-zoom-fit" title="Fit to Screen (0)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        this.canvas.setTool(tool);
      });
    });

    this.container.querySelector('#btn-undo').addEventListener('click', () => {
      this.state.undo();
    });

    this.container.querySelector('#btn-redo').addEventListener('click', () => {
      this.state.redo();
    });

    this.container.querySelector('#btn-delete').addEventListener('click', () => {
      this.state.deleteSelected();
    });

    this.container.querySelector('#btn-zoom-in').addEventListener('click', () => {
      const rect = this.canvas.svg.getBoundingClientRect();
      this.canvas.zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.25);
    });

    this.container.querySelector('#btn-zoom-out').addEventListener('click', () => {
      const rect = this.canvas.svg.getBoundingClientRect();
      this.canvas.zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.8);
    });

    this.container.querySelector('#btn-zoom-reset').addEventListener('click', () => {
      const rect = this.canvas.svg.getBoundingClientRect();
      const targetZoom = 1.0;
      const factor = targetZoom / this.state.ui.zoom;
      this.canvas.zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    });

    this.container.querySelector('#btn-zoom-fit').addEventListener('click', () => {
      this.canvas.centerView();
    });
  }

  updateActiveTool() {
    const activeTool = this.state.ui.activeTool;
    this.container.querySelectorAll('[data-tool]').forEach(btn => {
      if (btn.getAttribute('data-tool') === activeTool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const zoomResetBtn = this.container.querySelector('#btn-zoom-reset');
    if (zoomResetBtn) {
      zoomResetBtn.textContent = `${Math.round(this.state.ui.zoom * 100)}%`;
    }
  }

  updateHistoryButtons() {
    const undoBtn = this.container.querySelector('#btn-undo');
    const redoBtn = this.container.querySelector('#btn-redo');
    if (undoBtn) undoBtn.disabled = !this.state.history.canUndo();
    if (redoBtn) redoBtn.disabled = !this.state.history.canRedo();
  }
}
