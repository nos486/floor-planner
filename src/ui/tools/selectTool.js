import { dist, projectPointOnSegment, pointsEqual } from '../../core/geometry.js';

export class SelectTool {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = canvas.state;
    this.dragMode = null; // null | 'vertex' | 'wall' | 'opening'
    this.dragTarget = null;
    this.dragStartMouse = null;
    this.initialPoints = null;
    this.initialConnectedWalls = [];
  }

  activate() {}

  deactivate() {
    this.dragMode = null;
    this.dragTarget = null;
    this.canvas.clearOverlay();
  }

  onMouseDown(e, worldPos) {
    if (e.button !== 0) return; // only left button

    const hit = this.hitTest(worldPos);

    if (hit) {
      this.state.select(hit.type, hit.id);

      // Start drag interaction
      this.dragMode = hit.mode; // 'vertex' | 'wall' | 'opening'
      this.dragTarget = hit;
      this.dragStartMouse = [...worldPos];

      if (hit.mode === 'vertex') {
        const wall = this.state.project.walls.find(w => w.id === hit.id);
        const movingPt = wall.points[hit.vertexIndex];
        // Find all walls that share this exact endpoint
        this.initialConnectedWalls = this.state.project.walls.filter(w =>
          pointsEqual(w.points[0], movingPt, 1) || pointsEqual(w.points[1], movingPt, 1)
        ).map(w => ({
          wall: w,
          isStart: pointsEqual(w.points[0], movingPt, 1),
          isEnd: pointsEqual(w.points[1], movingPt, 1)
        }));
      } else if (hit.mode === 'wall') {
        const wall = this.state.project.walls.find(w => w.id === hit.id);
        this.initialPoints = [
          [...wall.points[0]],
          [...wall.points[1]]
        ];
      }
    } else {
      this.state.clearSelection();
      this.dragMode = null;
      this.dragTarget = null;
    }
  }

  onMouseMove(e, worldPos) {
    if (!this.dragMode || !this.dragTarget) {
      // Hover feedback
      return;
    }

    const dx = worldPos[0] - this.dragStartMouse[0];
    const dy = worldPos[1] - this.dragStartMouse[1];

    if (this.dragMode === 'vertex') {
      // Snap moving vertex to grid, endpoint, or angle
      const snap = this.canvas.snapEngine.resolveSnap({
        point: worldPos,
        walls: this.state.project.walls,
        zoom: this.state.ui.zoom,
        enableGrid: this.state.ui.snapToGrid,
        enableEndpoint: this.state.ui.snapToEndpoints,
        enableAngle: this.state.ui.snapToAngles,
        excludeWallId: this.dragTarget.id
      });

      const newPos = snap.point;

      // Move vertex across all connected walls
      for (const item of this.initialConnectedWalls) {
        if (item.isStart) {
          item.wall.points[0] = [...newPos];
        }
        if (item.isEnd) {
          item.wall.points[1] = [...newPos];
        }

        // Clamp attached doors/windows along resized wall
        const newWallLen = dist(item.wall.points[0], item.wall.points[1]);
        if (newWallLen > 0) {
          for (const door of this.state.project.doors.filter(d => d.wallId === item.wall.id)) {
            const halfW = door.width / 2;
            door.offset = Math.max(halfW, Math.min(newWallLen - halfW, door.offset));
          }
          for (const win of this.state.project.windows.filter(w => w.wallId === item.wall.id)) {
            const halfW = win.width / 2;
            win.offset = Math.max(halfW, Math.min(newWallLen - halfW, win.offset));
          }
        }
      }

      this.state.recalculateRooms(false);
      this.state.notify('wall_update');
    } else if (this.dragMode === 'wall') {
      const snapDx = this.state.ui.snapToGrid
        ? Math.round(dx / this.state.project.scale.gridCm) * this.state.project.scale.gridCm
        : dx;
      const snapDy = this.state.ui.snapToGrid
        ? Math.round(dy / this.state.project.scale.gridCm) * this.state.project.scale.gridCm
        : dy;

      const wall = this.state.project.walls.find(w => w.id === this.dragTarget.id);
      if (wall && this.initialPoints) {
        wall.points[0] = [this.initialPoints[0][0] + snapDx, this.initialPoints[0][1] + snapDy];
        wall.points[1] = [this.initialPoints[1][0] + snapDx, this.initialPoints[1][1] + snapDy];
        this.state.recalculateRooms(false);
        this.state.notify('wall_update');
      }
    } else if (this.dragMode === 'opening') {
      const item = this.dragTarget.type === 'door'
        ? this.state.project.doors.find(d => d.id === this.dragTarget.id)
        : this.state.project.windows.find(w => w.id === this.dragTarget.id);

      if (item) {
        const wall = this.state.project.walls.find(w => w.id === item.wallId);
        if (wall) {
          const proj = projectPointOnSegment(worldPos, wall.points[0], wall.points[1]);
          const wallLen = dist(wall.points[0], wall.points[1]);
          const halfW = (item.width || 90) / 2;
          const currentOffset = proj.t * wallLen;
          const clampedOffset = Math.max(halfW, Math.min(wallLen - halfW, currentOffset));
          item.offset = Math.round(clampedOffset * 10) / 10;
          this.state.notify(`${this.dragTarget.type}_update`);
        }
      }
    }
  }

  onMouseUp(e) {
    if (this.dragMode) {
      this.state.saveHistorySnapshot();
      this.dragMode = null;
      this.dragTarget = null;
      this.initialPoints = null;
      this.initialConnectedWalls = [];
    }
  }

  onKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Don't delete if user is typing in an input field
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }
      e.preventDefault();
      this.state.deleteSelected();
    } else if (e.key === 'Escape') {
      this.state.clearSelection();
    }
  }

  hitTest(worldPos) {
    const threshold = 16 / this.state.ui.zoom;

    // 1. Check endpoints of selected or any walls
    for (const wall of this.state.project.walls) {
      if (dist(worldPos, wall.points[0]) <= threshold) {
        return { type: 'wall', id: wall.id, mode: 'vertex', vertexIndex: 0 };
      }
      if (dist(worldPos, wall.points[1]) <= threshold) {
        return { type: 'wall', id: wall.id, mode: 'vertex', vertexIndex: 1 };
      }
    }

    // 2. Check doors
    for (const door of this.state.project.doors) {
      const wall = this.state.project.walls.find(w => w.id === door.wallId);
      if (wall) {
        const wallLen = dist(wall.points[0], wall.points[1]);
        if (wallLen > 0) {
          const t = door.offset / wallLen;
          const doorPt = [
            wall.points[0][0] + t * (wall.points[1][0] - wall.points[0][0]),
            wall.points[0][1] + t * (wall.points[1][1] - wall.points[0][1])
          ];
          if (dist(worldPos, doorPt) <= threshold + 10) {
            return { type: 'door', id: door.id, mode: 'opening' };
          }
        }
      }
    }

    // 3. Check windows
    for (const win of this.state.project.windows) {
      const wall = this.state.project.walls.find(w => w.id === win.wallId);
      if (wall) {
        const wallLen = dist(wall.points[0], wall.points[1]);
        if (wallLen > 0) {
          const t = win.offset / wallLen;
          const winPt = [
            wall.points[0][0] + t * (wall.points[1][0] - wall.points[0][0]),
            wall.points[0][1] + t * (wall.points[1][1] - wall.points[0][1])
          ];
          if (dist(worldPos, winPt) <= threshold + 10) {
            return { type: 'window', id: win.id, mode: 'opening' };
          }
        }
      }
    }

    // 4. Check wall segments
    for (const wall of this.state.project.walls) {
      const proj = projectPointOnSegment(worldPos, wall.points[0], wall.points[1]);
      if (proj.distance <= Math.max(threshold, wall.thickness / 2 + 5)) {
        return { type: 'wall', id: wall.id, mode: 'wall' };
      }
    }

    // 5. Check rooms
    for (const room of this.state.project.rooms) {
      if (room.centroid && dist(worldPos, room.centroid) <= threshold * 2) {
        return { type: 'room', id: room.id, mode: 'room' };
      }
    }

    return null;
  }
}
