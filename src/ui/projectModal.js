export class ProjectModal {
  constructor(state, onCreated) {
    this.state = state;
    this.onCreated = onCreated;
    this.createModalDOM();
  }

  createModalDOM() {
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'modal-backdrop hidden';

    this.modalOverlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title-text">Project Settings</h3>
          <button class="close-btn" id="modal-close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="project-name-input" class="form-label">Project Name</label>
            <input type="text" id="project-name-input" class="form-input" placeholder="e.g. Ground Floor, Downtown Loft">
          </div>

          <div class="form-group">
            <label for="project-grid-input" class="form-label">Grid Size (Scale)</label>
            <div class="input-desc">Real-world width/height of one grid square on the canvas.</div>
            <div class="grid-presets">
              <button type="button" class="preset-pill" data-grid="10">10 cm</button>
              <button type="button" class="preset-pill active" data-grid="20">20 cm (Standard)</button>
              <button type="button" class="preset-pill" data-grid="25">25 cm</button>
              <button type="button" class="preset-pill" data-grid="50">50 cm</button>
            </div>
            <div class="custom-grid-row">
              <input type="number" id="project-grid-input" class="form-input" min="5" max="200" step="5" value="20">
              <span class="unit-addon">cm / square</span>
            </div>
          </div>

          <div class="callout-tip">
            <strong>Drawing Tip:</strong> 1 meter = 100 cm. With a 20 cm grid, 5 grid squares equal exactly 1.0 meter.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="modal-cancel-btn">Cancel</button>
          <button class="btn-primary" id="modal-save-btn">Save Project</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);
    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.modalOverlay.querySelector('#modal-close-btn');
    const cancelBtn = this.modalOverlay.querySelector('#modal-cancel-btn');
    const saveBtn = this.modalOverlay.querySelector('#modal-save-btn');
    const gridInput = this.modalOverlay.querySelector('#project-grid-input');
    const nameInput = this.modalOverlay.querySelector('#project-name-input');
    const pills = this.modalOverlay.querySelectorAll('.preset-pill');

    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        gridInput.value = pill.getAttribute('data-grid');
      });
    });

    gridInput.addEventListener('input', () => {
      const val = gridInput.value;
      pills.forEach(p => {
        if (p.getAttribute('data-grid') === val) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
    });

    closeBtn.addEventListener('click', () => this.hide());
    cancelBtn.addEventListener('click', () => this.hide());

    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim() || 'My Home Plan';
      const gridCm = Math.max(5, Math.min(200, Number(gridInput.value) || 20));

      if (this.isNewProjectMode) {
        this.state.resetProject(name, gridCm, 100);
      } else {
        this.state.setProjectName(name);
        this.state.updateProjectScale(gridCm, 100);
      }

      this.hide();
      if (this.onCreated) this.onCreated();
    });
  }

  show(isNew = false) {
    this.isNewProjectMode = isNew;
    const title = this.modalOverlay.querySelector('#modal-title-text');
    const nameInput = this.modalOverlay.querySelector('#project-name-input');
    const gridInput = this.modalOverlay.querySelector('#project-grid-input');
    const saveBtn = this.modalOverlay.querySelector('#modal-save-btn');
    const pills = this.modalOverlay.querySelectorAll('.preset-pill');

    if (isNew) {
      title.textContent = 'Create New Floor Plan';
      nameInput.value = 'My Home Plan';
      gridInput.value = '20';
      saveBtn.textContent = 'Create Project';
    } else {
      title.textContent = 'Project Settings';
      nameInput.value = this.state.project.projectName || 'My Home Plan';
      gridInput.value = this.state.project.scale.gridCm || 20;
      saveBtn.textContent = 'Apply Settings';
    }

    pills.forEach(p => {
      if (p.getAttribute('data-grid') === String(gridInput.value)) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    this.modalOverlay.classList.remove('hidden');
    nameInput.focus();
  }

  hide() {
    this.modalOverlay.classList.add('hidden');
  }
}
