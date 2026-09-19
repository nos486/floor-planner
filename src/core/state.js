import { detectRooms } from './roomDetection.js';
import { HistoryManager } from './history.js';
import { saveToLocalStorage, loadFromLocalStorage } from './storage.js';
import { generateId, dist, projectPointOnSegment } from './geometry.js';

export class AppState {
  constructor() {
    this.history = new HistoryManager();
    this.listeners = new Set();

    // Default project template
    this.project = {
      projectName: 'My Home Plan',
      scale: {
        unitsPerMeter: 100, // 100 world units = 1 meter (1 unit = 1 cm)
        gridCm: 20          // 1 grid cell = 20 cm
      },
      walls: [],
      doors: [],
      windows: [],
      rooms: []
    };

    // UI and canvas settings
    this.ui = {
      activeTool: 'select', // 'select' | 'wall' | 'door' | 'window'
      selected: null,       // { type: 'wall'|'door'|'window'|'room', id: string }
      pan: { x: 0, y: 0 },
      zoom: 1.0,
      showGrid: true,
      snapToGrid: true,
      snapToEndpoints: true,
      snapToAngles: true,
      wallDefaultThickness: 20, // 20 cm
      doorDefaultWidth: 90,     // 90 cm
      windowDefaultWidth: 120   // 120 cm
    };

    // Try loading saved state from localStorage
    const saved = loadFromLocalStorage();
    if (saved) {
      this.project = saved;
      this.recalculateRooms(false);
    }
    this.saveDebounceTimer = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changeType = 'update') {
    // Debounced auto-save on project changes
    if (['wall', 'door', 'window', 'room', 'project', 'history'].some(t => changeType.includes(t))) {
      if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = setTimeout(() => {
        saveToLocalStorage(this.project);
      }, 400);
    }

    for (const listener of this.listeners) {
      try {
        listener(this, changeType);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    }
  }

  // --- Snapshot & History ---

  saveHistorySnapshot() {
    this.history.push({
      projectName: this.project.projectName,
      scale: { ...this.project.scale },
      walls: JSON.parse(JSON.stringify(this.project.walls)),
      doors: JSON.parse(JSON.stringify(this.project.doors)),
      windows: JSON.parse(JSON.stringify(this.project.windows)),
      rooms: JSON.parse(JSON.stringify(this.project.rooms))
    });
  }

  undo() {
    const current = {
      projectName: this.project.projectName,
      scale: { ...this.project.scale },
      walls: this.project.walls,
      doors: this.project.doors,
      windows: this.project.windows,
      rooms: this.project.rooms
    };
    const prev = this.history.undo(current);
    if (prev) {
      this.project = prev;
      this.ui.selected = null;
      this.recalculateRooms(false);
      this.notify('history_undo');
    }
  }

  redo() {
    const current = {
      projectName: this.project.projectName,
      scale: { ...this.project.scale },
      walls: this.project.walls,
      doors: this.project.doors,
      windows: this.project.windows,
      rooms: this.project.rooms
    };
    const next = this.history.redo(current);
    if (next) {
      this.project = next;
      this.ui.selected = null;
      this.recalculateRooms(false);
      this.notify('history_redo');
    }
  }

  // --- Project Management ---

  resetProject(name = 'New Floor Plan', gridCm = 20, unitsPerMeter = 100) {
    this.saveHistorySnapshot();
    this.project = {
      projectName: name,
      scale: {
        unitsPerMeter: Number(unitsPerMeter) || 100,
        gridCm: Number(gridCm) || 20
      },
      walls: [],
      doors: [],
      windows: [],
      rooms: []
    };
    this.ui.selected = null;
    this.ui.pan = { x: 0, y: 0 };
    this.ui.zoom = 1.0;
    this.notify('project_reset');
  }

  loadProject(projectData) {
    this.saveHistorySnapshot();
    this.project = {
      projectName: projectData.projectName || 'Loaded Plan',
      scale: {
        unitsPerMeter: projectData.scale?.unitsPerMeter || 100,
        gridCm: projectData.scale?.gridCm || 20
      },
      walls: projectData.walls || [],
      doors: projectData.doors || [],
      windows: projectData.windows || [],
      rooms: projectData.rooms || []
    };
    this.ui.selected = null;
    this.recalculateRooms(false);
    this.notify('project_loaded');
  }

  updateProjectScale(gridCm, unitsPerMeter) {
    this.saveHistorySnapshot();
    this.project.scale.gridCm = Number(gridCm);
    this.project.scale.unitsPerMeter = Number(unitsPerMeter);
    this.recalculateRooms(true);
    this.notify('scale_updated');
  }

  setProjectName(name) {
    this.project.projectName = name.trim() || 'Floor Plan';
    this.notify('project_name');
  }

  // --- Tool & Selection ---

  setActiveTool(tool) {
    this.ui.activeTool = tool;
    this.notify('tool_change');
  }

  select(type, id) {
    if (!type || !id) {
      this.ui.selected = null;
    } else {
      this.ui.selected = { type, id };
    }
    this.notify('selection_change');
  }

  clearSelection() {
    if (this.ui.selected) {
      this.ui.selected = null;
      this.notify('selection_change');
    }
  }

  getSelectedEntity() {
    if (!this.ui.selected) return null;
    const { type, id } = this.ui.selected;
    if (type === 'wall') return this.project.walls.find(w => w.id === id);
    if (type === 'door') return this.project.doors.find(d => d.id === id);
    if (type === 'window') return this.project.windows.find(w => w.id === id);
    if (type === 'room') return this.project.rooms.find(r => r.id === id);
    return null;
  }

  // --- Walls ---

  addWall(p1, p2, thickness = this.ui.wallDefaultThickness) {
    if (dist(p1, p2) < 5) return null; // Ignore tiny micro-walls

    this.saveHistorySnapshot();
    const newWall = {
      id: generateId('w'),
      points: [
        [Math.round(p1[0] * 10) / 10, Math.round(p1[1] * 10) / 10],
        [Math.round(p2[0] * 10) / 10, Math.round(p2[1] * 10) / 10]
      ],
      thickness: Number(thickness) || this.ui.wallDefaultThickness
    };

    this.project.walls.push(newWall);
    this.recalculateRooms(false);
    this.notify('wall_add');
    return newWall;
  }

  updateWallPoints(wallId, p1, p2) {
    const wall = this.project.walls.find(w => w.id === wallId);
    if (!wall) return;
    wall.points = [
      [Math.round(p1[0] * 10) / 10, Math.round(p1[1] * 10) / 10],
      [Math.round(p2[0] * 10) / 10, Math.round(p2[1] * 10) / 10]
    ];
    this.recalculateRooms(false);
    this.notify('wall_update');
  }

  updateWallThickness(wallId, thickness) {
    const wall = this.project.walls.find(w => w.id === wallId);
    if (!wall) return;
    this.saveHistorySnapshot();
    wall.thickness = Math.max(5, Math.min(100, Number(thickness)));
    this.notify('wall_update');
  }

  deleteWall(wallId) {
    const idx = this.project.walls.findIndex(w => w.id === wallId);
    if (idx === -1) return;

    this.saveHistorySnapshot();
    this.project.walls.splice(idx, 1);
    // Remove attached doors and windows
    this.project.doors = this.project.doors.filter(d => d.wallId !== wallId);
    this.project.windows = this.project.windows.filter(w => w.wallId !== wallId);

    if (this.ui.selected?.id === wallId) {
      this.ui.selected = null;
    }

    this.recalculateRooms(false);
    this.notify('wall_delete');
  }

  // --- Openings (Doors & Windows) ---

  addDoor(wallId, offset, width = this.ui.doorDefaultWidth, flipped = false) {
    const wall = this.project.walls.find(w => w.id === wallId);
    if (!wall) return null;

    this.saveHistorySnapshot();
    const newDoor = {
      id: generateId('d'),
      wallId,
      offset: Math.round(offset * 10) / 10,
      width: Number(width) || this.ui.doorDefaultWidth,
      flipped: Boolean(flipped),
      side: 1 // 1 or -1 for swing side
    };
    this.project.doors.push(newDoor);
    this.notify('door_add');
    return newDoor;
  }

  updateDoor(doorId, props) {
    const door = this.project.doors.find(d => d.id === doorId);
    if (!door) return;
    Object.assign(door, props);
    this.notify('door_update');
  }

  deleteDoor(doorId) {
    const idx = this.project.doors.findIndex(d => d.id === doorId);
    if (idx === -1) return;
    this.saveHistorySnapshot();
    this.project.doors.splice(idx, 1);
    if (this.ui.selected?.id === doorId) this.ui.selected = null;
    this.notify('door_delete');
  }

  addWindow(wallId, offset, width = this.ui.windowDefaultWidth) {
    const wall = this.project.walls.find(w => w.id === wallId);
    if (!wall) return null;

    this.saveHistorySnapshot();
    const newWindow = {
      id: generateId('win'),
      wallId,
      offset: Math.round(offset * 10) / 10,
      width: Number(width) || this.ui.windowDefaultWidth
    };
    this.project.windows.push(newWindow);
    this.notify('window_add');
    return newWindow;
  }

  updateWindow(windowId, props) {
    const win = this.project.windows.find(w => w.id === windowId);
    if (!win) return;
    Object.assign(win, props);
    this.notify('window_update');
  }

  deleteWindow(windowId) {
    const idx = this.project.windows.findIndex(w => w.id === windowId);
    if (idx === -1) return;
    this.saveHistorySnapshot();
    this.project.windows.splice(idx, 1);
    if (this.ui.selected?.id === windowId) this.ui.selected = null;
    this.notify('window_delete');
  }

  // --- Rooms ---

  recalculateRooms(recordHistory = false) {
    if (recordHistory) this.saveHistorySnapshot();
    const detected = detectRooms(this.project.walls, this.project.scale, this.project.rooms);
    this.project.rooms = detected;
  }

  renameRoom(roomId, newName) {
    const room = this.project.rooms.find(r => r.id === roomId);
    if (!room) return;
    this.saveHistorySnapshot();
    room.name = newName.trim() || 'Room';
    this.notify('room_update');
  }

  getTotalAreaM2() {
    return this.project.rooms.reduce((sum, r) => sum + (r.areaM2 || 0), 0);
  }

  // --- Deletion of active selection ---

  deleteSelected() {
    if (!this.ui.selected) return;
    const { type, id } = this.ui.selected;
    if (type === 'wall') this.deleteWall(id);
    else if (type === 'door') this.deleteDoor(id);
    else if (type === 'window') this.deleteWindow(id);
  }
}
