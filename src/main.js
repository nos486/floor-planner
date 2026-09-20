import { AppState } from './core/state.js';
import { Canvas } from './ui/canvas.js';
import { Toolbar } from './ui/toolbar.js';
import { Sidebar } from './ui/sidebar.js';
import { Inspector } from './ui/inspector.js';
import { ProjectModal } from './ui/projectModal.js';
import { exportProjectJSON, importProjectJSON } from './core/storage.js';

function initApp() {
  const state = new AppState();

  // If brand new user with no saved project, provide a clean starter home plan (Living room + Bedroom)
  if (state.project.walls.length === 0) {
    initStarterPlan(state);
  }

  const canvasContainer = document.getElementById('canvas-container');
  const toolbarContainer = document.getElementById('toolbar-container');
  const sidebarContainer = document.getElementById('sidebar-container');
  const inspectorContainer = document.getElementById('inspector-container');

  const canvas = new Canvas(canvasContainer, state);

  // Modal controller
  const projectModal = new ProjectModal(state, () => {
    canvas.updateGridPattern();
    canvas.centerView();
    canvas.render();
  });

  const toolbar = new Toolbar(toolbarContainer, state, canvas);
  const sidebar = new Sidebar(sidebarContainer, state, canvas, () => {
    projectModal.show(false);
  });
  const inspector = new Inspector(inspectorContainer, state);

  // Top Nav Actions
  const btnNew = document.getElementById('btn-new-project');
  const btnLoad = document.getElementById('btn-load-project');
  const btnSave = document.getElementById('btn-save-project');
  const btnExportSvg = document.getElementById('btn-export-svg');

  btnNew.addEventListener('click', () => {
    projectModal.show(true);
  });

  btnSave.addEventListener('click', async () => {
    const success = await exportProjectJSON(state.project);
    if (success) {
      showToast('Project saved successfully!');
    }
  });

  btnLoad.addEventListener('click', async () => {
    try {
      const data = await importProjectJSON();
      if (data) {
        state.loadProject(data);
        canvas.updateGridPattern();
        canvas.centerView();
        showToast(`Loaded "${state.project.projectName}"`);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      showToast('Error loading project file.', true);
    }
  });

  btnExportSvg.addEventListener('click', () => {
    exportCurrentSVG(canvas.svg, state.project.projectName);
    showToast('SVG exported!');
  });

  setupMobileBlocker();
}

function setupMobileBlocker() {
  const btnCopy = document.getElementById('btn-copy-link');
  const copyText = document.getElementById('copy-link-text');
  const mobileBlocker = document.getElementById('mobile-blocker');

  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobileUA && window.innerWidth <= 1024) {
    if (mobileBlocker) mobileBlocker.style.display = 'flex';
  }

  if (btnCopy && copyText) {
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        copyText.textContent = '✓ Link Copied to Clipboard!';
        setTimeout(() => {
          copyText.textContent = 'Copy Link for PC';
        }, 2500);
      } catch (err) {
        prompt('Copy link to open on your PC:', window.location.href);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

/**
 * Initializes an elegant starter plan so users see the capability right away
 */
function initStarterPlan(state) {
  // Living Room: 5m x 4m (500cm x 400cm)
  // Bedroom: 3.5m x 4m (350cm x 400cm)
  // Wall thickness: 20cm
  state.project.projectName = 'Sample House';
  state.project.scale = { unitsPerMeter: 100, gridCm: 20 };

  const w1 = state.addWall([-150, -200], [350, -200], 20); // Top wall
  const w2 = state.addWall([350, -200], [350, 200], 20);   // Right wall
  const w3 = state.addWall([350, 200], [-150, 200], 20);   // Bottom wall
  const w4 = state.addWall([-150, 200], [-150, -200], 20); // Left wall

  // Partition wall dividing Living Room and Bedroom
  const w5 = state.addWall([150, -200], [150, 200], 20);

  if (w1) state.addWindow(w1.id, 100, 120);
  if (w2) state.addWindow(w2.id, 200, 140);
  if (w3) state.addDoor(w3.id, 80, 90, false);
  if (w5) state.addDoor(w5.id, 180, 90, false);

  state.recalculateRooms(false);

  // Give friendly names
  if (state.project.rooms.length >= 2) {
    state.project.rooms[0].name = 'Living Room';
    state.project.rooms[1].name = 'Bedroom';
  } else if (state.project.rooms.length === 1) {
    state.project.rooms[0].name = 'Living Room';
  }

  state.history.clear();
}

/**
 * Standalone SVG exporter
 */
function exportCurrentSVG(svgElement, projectName) {
  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Remove overlay preview layer in export
  const overlay = clone.querySelector('#layer-overlay');
  if (overlay) overlay.remove();

  const svgData = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${(projectName || 'floor_plan').toLowerCase().replace(/[^a-z0-9]/g, '_')}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Modern floating notification toast
 */
function showToast(message, isError = false) {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification ${isError ? 'error' : ''}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('visible');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}
