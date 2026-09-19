export class Sidebar {
  constructor(containerEl, state, canvas, onOpenProjectModal) {
    this.container = containerEl;
    this.state = state;
    this.canvas = canvas;
    this.onOpenProjectModal = onOpenProjectModal;

    this.render();
    this.bindEvents();

    this.state.subscribe(() => {
      this.updateRoomList();
      this.updateSummary();
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-title-row">
          <h2 class="sidebar-title">Plan Overview</h2>
          <button class="settings-btn" id="btn-project-settings" title="Project Settings & Scale">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
        <div class="project-name-badge" id="sidebar-project-name">My Home Plan</div>
      </div>

      <div class="area-card">
        <div class="area-card-label">Total Home Area</div>
        <div class="area-card-value">
          <span id="total-area-val">0.00</span>
          <span class="unit">m²</span>
        </div>
        <div class="area-card-meta">
          <span id="meta-rooms-count">0 rooms</span>
          <span class="dot-sep">•</span>
          <span id="meta-walls-count">0 walls</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="section-heading">
          <span>Rooms</span>
          <span class="badge" id="rooms-badge-count">0</span>
        </div>
        <div class="rooms-container" id="rooms-list-container">
          <!-- Room items rendered dynamically -->
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="scale-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <span id="sidebar-scale-text">1 grid = 20 cm</span>
        </div>
        <div class="shortcuts-hint">
          <span>Shortcuts: <strong>1</strong> Select, <strong>H</strong> Pan, <strong>2</strong> Wall, <strong>3</strong> Door, <strong>4</strong> Window, <strong>Del</strong> Remove</span><br>
          <span>MacBook: <strong>2-Finger Swipe</strong> to Pan, <strong>Pinch</strong> to Zoom</span>
        </div>
      </div>
    `;

    this.updateSummary();
    this.updateRoomList();
  }

  bindEvents() {
    this.container.querySelector('#btn-project-settings').addEventListener('click', () => {
      if (this.onOpenProjectModal) this.onOpenProjectModal();
    });
  }

  updateSummary() {
    const totalArea = this.state.getTotalAreaM2();
    const totalEl = this.container.querySelector('#total-area-val');
    const roomsCountEl = this.container.querySelector('#meta-rooms-count');
    const wallsCountEl = this.container.querySelector('#meta-walls-count');
    const badgeCountEl = this.container.querySelector('#rooms-badge-count');
    const nameEl = this.container.querySelector('#sidebar-project-name');
    const scaleEl = this.container.querySelector('#sidebar-scale-text');

    if (totalEl) totalEl.textContent = totalArea.toFixed(2);
    if (roomsCountEl) roomsCountEl.textContent = `${this.state.project.rooms.length} room${this.state.project.rooms.length === 1 ? '' : 's'}`;
    if (wallsCountEl) wallsCountEl.textContent = `${this.state.project.walls.length} wall${this.state.project.walls.length === 1 ? '' : 's'}`;
    if (badgeCountEl) badgeCountEl.textContent = this.state.project.rooms.length;
    if (nameEl) nameEl.textContent = this.state.project.projectName;
    if (scaleEl) scaleEl.textContent = `1 grid = ${this.state.project.scale.gridCm} cm (1m = ${this.state.project.scale.unitsPerMeter}u)`;
  }

  updateRoomList() {
    const container = this.container.querySelector('#rooms-list-container');
    if (!container) return;

    const { rooms } = this.state.project;

    if (rooms.length === 0) {
      container.innerHTML = `
        <div class="empty-rooms-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
          <p>No rooms detected yet.</p>
          <small>Draw closed wall loops to detect rooms and calculate area.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    rooms.forEach(room => {
      const isSelected = this.state.ui.selected?.type === 'room' && this.state.ui.selected.id === room.id;
      const card = document.createElement('div');
      card.className = `room-item-card ${isSelected ? 'selected' : ''}`;

      card.innerHTML = `
        <div class="room-item-top">
          <input type="text" class="room-name-input" value="${room.name}" placeholder="Room Name" data-id="${room.id}">
          <span class="room-area-badge">${room.areaM2.toFixed(2)} m²</span>
        </div>
      `;

      // Click card to select room on canvas
      card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          this.state.select('room', room.id);
        }
      });

      // Name edit
      const input = card.querySelector('.room-name-input');
      input.addEventListener('change', (e) => {
        this.state.renameRoom(room.id, e.target.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
      });

      container.appendChild(card);
    });
  }
}
