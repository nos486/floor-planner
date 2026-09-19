import { dist } from '../core/geometry.js';

export class Inspector {
  constructor(containerEl, state) {
    this.container = containerEl;
    this.state = state;
    this.render();

    this.state.subscribe(() => {
      this.render();
    });
  }

  render() {
    const selected = this.state.ui.selected;
    if (!selected) {
      this.container.classList.add('hidden');
      this.container.innerHTML = '';
      return;
    }

    const entity = this.state.getSelectedEntity();
    if (!entity) {
      this.container.classList.add('hidden');
      this.container.innerHTML = '';
      return;
    }

    this.container.classList.remove('hidden');

    if (selected.type === 'wall') {
      this.renderWallInspector(entity);
    } else if (selected.type === 'door') {
      this.renderDoorInspector(entity);
    } else if (selected.type === 'window') {
      this.renderWindowInspector(entity);
    } else if (selected.type === 'room') {
      this.renderRoomInspector(entity);
    }
  }

  renderWallInspector(wall) {
    const p1 = wall.points[0];
    const p2 = wall.points[1];
    const lenUnits = dist(p1, p2);
    const unitsPerMeter = this.state.project.scale.unitsPerMeter || 100;
    const lenM = (lenUnits / unitsPerMeter).toFixed(2);

    this.container.innerHTML = `
      <div class="inspector-card">
        <div class="inspector-header">
          <span class="inspector-title">Wall Properties</span>
          <button class="close-btn" id="inspector-close">✕</button>
        </div>
        <div class="inspector-body">
          <div class="prop-row">
            <span class="prop-label">Length</span>
            <span class="prop-val">${lenM} m (${Math.round(lenUnits)} cm)</span>
          </div>
          <div class="prop-row">
            <label class="prop-label" for="wall-thickness-input">Thickness</label>
            <div class="prop-input-wrap">
              <input type="number" id="wall-thickness-input" min="5" max="80" step="1" value="${wall.thickness}">
              <span class="unit-addon">cm</span>
            </div>
          </div>
          <input type="range" id="wall-thickness-slider" min="10" max="50" step="1" value="${wall.thickness}" class="prop-slider">
          <div class="inspector-actions">
            <button class="btn-danger-outline" id="inspector-delete">Delete Wall</button>
          </div>
        </div>
      </div>
    `;

    const closeBtn = this.container.querySelector('#inspector-close');
    closeBtn.addEventListener('click', () => this.state.clearSelection());

    const numInput = this.container.querySelector('#wall-thickness-input');
    const slider = this.container.querySelector('#wall-thickness-slider');

    numInput.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (val >= 5 && val <= 80) {
        slider.value = val;
        this.state.updateWallThickness(wall.id, val);
      }
    });

    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      numInput.value = val;
      this.state.updateWallThickness(wall.id, val);
    });

    this.container.querySelector('#inspector-delete').addEventListener('click', () => {
      this.state.deleteWall(wall.id);
    });
  }

  renderDoorInspector(door) {
    this.container.innerHTML = `
      <div class="inspector-card">
        <div class="inspector-header">
          <span class="inspector-title">Door Properties</span>
          <button class="close-btn" id="inspector-close">✕</button>
        </div>
        <div class="inspector-body">
          <div class="prop-row">
            <label class="prop-label" for="door-width-input">Width</label>
            <div class="prop-input-wrap">
              <input type="number" id="door-width-input" min="50" max="180" step="5" value="${door.width}">
              <span class="unit-addon">cm</span>
            </div>
          </div>
          <input type="range" id="door-width-slider" min="60" max="140" step="5" value="${door.width}" class="prop-slider">
          <div class="inspector-actions">
            <button class="btn-secondary" id="door-flip-btn">Flip Swing Direction</button>
            <button class="btn-danger-outline" id="inspector-delete">Delete Door</button>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#inspector-close').addEventListener('click', () => this.state.clearSelection());

    const numInput = this.container.querySelector('#door-width-input');
    const slider = this.container.querySelector('#door-width-slider');

    numInput.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (val >= 40 && val <= 200) {
        slider.value = val;
        this.state.updateDoor(door.id, { width: val });
      }
    });

    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      numInput.value = val;
      this.state.updateDoor(door.id, { width: val });
    });

    this.container.querySelector('#door-flip-btn').addEventListener('click', () => {
      this.state.updateDoor(door.id, { side: -(door.side || 1) });
    });

    this.container.querySelector('#inspector-delete').addEventListener('click', () => {
      this.state.deleteDoor(door.id);
    });
  }

  renderWindowInspector(win) {
    this.container.innerHTML = `
      <div class="inspector-card">
        <div class="inspector-header">
          <span class="inspector-title">Window Properties</span>
          <button class="close-btn" id="inspector-close">✕</button>
        </div>
        <div class="inspector-body">
          <div class="prop-row">
            <label class="prop-label" for="win-width-input">Width</label>
            <div class="prop-input-wrap">
              <input type="number" id="win-width-input" min="40" max="300" step="5" value="${win.width}">
              <span class="unit-addon">cm</span>
            </div>
          </div>
          <input type="range" id="win-width-slider" min="50" max="250" step="5" value="${win.width}" class="prop-slider">
          <div class="inspector-actions">
            <button class="btn-danger-outline" id="inspector-delete">Delete Window</button>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#inspector-close').addEventListener('click', () => this.state.clearSelection());

    const numInput = this.container.querySelector('#win-width-input');
    const slider = this.container.querySelector('#win-width-slider');

    numInput.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (val >= 40 && val <= 300) {
        slider.value = val;
        this.state.updateWindow(win.id, { width: val });
      }
    });

    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      numInput.value = val;
      this.state.updateWindow(win.id, { width: val });
    });

    this.container.querySelector('#inspector-delete').addEventListener('click', () => {
      this.state.deleteWindow(win.id);
    });
  }

  renderRoomInspector(room) {
    this.container.innerHTML = `
      <div class="inspector-card">
        <div class="inspector-header">
          <span class="inspector-title">Room Properties</span>
          <button class="close-btn" id="inspector-close">✕</button>
        </div>
        <div class="inspector-body">
          <div class="prop-row">
            <label class="prop-label" for="room-name-field">Room Name</label>
            <input type="text" id="room-name-field" value="${room.name}" class="prop-text-input">
          </div>
          <div class="prop-row">
            <span class="prop-label">Calculated Area</span>
            <span class="prop-val-highlight">${room.areaM2.toFixed(2)} m²</span>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#inspector-close').addEventListener('click', () => this.state.clearSelection());

    const nameInput = this.container.querySelector('#room-name-field');
    nameInput.addEventListener('input', (e) => {
      this.state.renameRoom(room.id, e.target.value);
    });
  }
}
