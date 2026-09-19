import { SnapEngine } from '../core/snap.js';
import { dist, polygonCentroid } from '../core/geometry.js';
import { WallTool } from './tools/wallTool.js';
import { DoorTool } from './tools/doorTool.js';
import { WindowTool } from './tools/windowTool.js';
import { SelectTool } from './tools/selectTool.js';

export class Canvas {
  constructor(containerEl, state) {
    this.container = containerEl;
    this.state = state;
    this.snapEngine = new SnapEngine({
      gridSize: state.project.scale.gridCm || 20,
      endpointSnapRadius: 16,
      angleThresholdDeg: 6
    });

    this.isPanning = false;
    this.spacePressed = false;
    this.panStart = { x: 0, y: 0 };
    this.lastMouseWorld = [0, 0];

    this.initSVG();
    this.initTools();
    this.bindEvents();

    // Subscribe to state updates
    this.state.subscribe((s, type) => {
      if (type === 'scale_updated') {
        this.snapEngine.gridSize = s.project.scale.gridCm || 20;
        this.updateGridPattern();
      }
      this.render();
    });

    // Initial render
    this.centerView();
    this.render();
  }

  initSVG() {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'floor-canvas');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    // Defs for grid and markers
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.svg.appendChild(this.defs);

    // Root viewport transformation group
    this.viewGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.viewGroup.setAttribute('id', 'viewport-group');
    this.svg.appendChild(this.viewGroup);

    // Background rect to capture events everywhere
    this.bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.bgRect.setAttribute('x', '-50000');
    this.bgRect.setAttribute('y', '-50000');
    this.bgRect.setAttribute('width', '100000');
    this.bgRect.setAttribute('height', '100000');
    this.bgRect.setAttribute('class', 'canvas-bg');
    this.viewGroup.appendChild(this.bgRect);

    // Layers
    this.gridLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.gridLayer.setAttribute('id', 'layer-grid');
    this.viewGroup.appendChild(this.gridLayer);

    this.roomsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.roomsLayer.setAttribute('id', 'layer-rooms');
    this.viewGroup.appendChild(this.roomsLayer);

    this.wallsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.wallsLayer.setAttribute('id', 'layer-walls');
    this.viewGroup.appendChild(this.wallsLayer);

    this.openingsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.openingsLayer.setAttribute('id', 'layer-openings');
    this.viewGroup.appendChild(this.openingsLayer);

    this.dimensionsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.dimensionsLayer.setAttribute('id', 'layer-dimensions');
    this.viewGroup.appendChild(this.dimensionsLayer);

    this.selectionLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.selectionLayer.setAttribute('id', 'layer-selection');
    this.viewGroup.appendChild(this.selectionLayer);

    this.overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.overlayGroup.setAttribute('id', 'layer-overlay');
    this.viewGroup.appendChild(this.overlayGroup);

    this.container.appendChild(this.svg);
    this.updateGridPattern();
  }

  initTools() {
    this.tools = {
      select: new SelectTool(this),
      wall: new WallTool(this),
      door: new DoorTool(this),
      window: new WindowTool(this)
    };
    this.activeToolInstance = this.tools.select;
    this.activeToolInstance.activate();
  }

  updateGridPattern() {
    this.defs.innerHTML = '';
    const gridCm = this.state.project.scale.gridCm || 20;
    const majorCm = (this.state.project.scale.unitsPerMeter || 100); // 1 meter major lines

    // Small grid pattern
    const smallPattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    smallPattern.setAttribute('id', 'minorGrid');
    smallPattern.setAttribute('width', gridCm);
    smallPattern.setAttribute('height', gridCm);
    smallPattern.setAttribute('patternUnits', 'userSpaceOnUse');

    const minorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    minorPath.setAttribute('d', `M ${gridCm} 0 L 0 0 0 ${gridCm}`);
    minorPath.setAttribute('fill', 'none');
    minorPath.setAttribute('stroke', 'rgba(255, 255, 255, 0.05)');
    minorPath.setAttribute('stroke-width', '1');
    smallPattern.appendChild(minorPath);
    this.defs.appendChild(smallPattern);

    // Major grid pattern
    const majorPattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    majorPattern.setAttribute('id', 'majorGrid');
    majorPattern.setAttribute('width', majorCm);
    majorPattern.setAttribute('height', majorCm);
    majorPattern.setAttribute('patternUnits', 'userSpaceOnUse');

    const rectFilled = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectFilled.setAttribute('width', majorCm);
    rectFilled.setAttribute('height', majorCm);
    rectFilled.setAttribute('fill', 'url(#minorGrid)');
    majorPattern.appendChild(rectFilled);

    const majorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    majorPath.setAttribute('d', `M ${majorCm} 0 L 0 0 0 ${majorCm}`);
    majorPath.setAttribute('fill', 'none');
    majorPath.setAttribute('stroke', 'rgba(255, 255, 255, 0.12)');
    majorPath.setAttribute('stroke-width', '1.5');
    majorPattern.appendChild(majorPath);

    this.defs.appendChild(majorPattern);

    this.gridLayer.innerHTML = '';
    const gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    gridRect.setAttribute('x', '-50000');
    gridRect.setAttribute('y', '-50000');
    gridRect.setAttribute('width', '100000');
    gridRect.setAttribute('height', '100000');
    gridRect.setAttribute('fill', 'url(#majorGrid)');
    this.gridLayer.appendChild(gridRect);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.applyTransform());

    this.svg.addEventListener('mousedown', (e) => {
      // Middle click or Space+Left click = Pan
      if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
        e.preventDefault();
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.svg.style.cursor = 'grabbing';
        return;
      }

      if (e.button === 0 && this.activeToolInstance?.onMouseDown) {
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        this.activeToolInstance.onMouseDown(e, worldPos);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.state.ui.pan.x += dx;
        this.state.ui.pan.y += dy;
        this.applyTransform();
        return;
      }

      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      this.lastMouseWorld = worldPos;

      if (this.activeToolInstance?.onMouseMove) {
        this.activeToolInstance.onMouseMove(e, worldPos);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.svg.style.cursor = this.spacePressed ? 'grab' : '';
        return;
      }

      if (this.activeToolInstance?.onMouseUp) {
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        this.activeToolInstance.onMouseUp(e, worldPos);
      }
    });

    this.svg.addEventListener('click', (e) => {
      if (this.spacePressed) return;
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      if (this.activeToolInstance?.onClick) {
        this.activeToolInstance.onClick(e, worldPos);
      }
    });

    this.svg.addEventListener('dblclick', (e) => {
      if (this.activeToolInstance?.onDblClick) {
        this.activeToolInstance.onDblClick(e);
      }
    });

    // Zoom on wheel (centered at mouse)
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = this.svg.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;

      // Current world position under cursor
      const worldX = (mouseScreenX - this.state.ui.pan.x) / this.state.ui.zoom;
      const worldY = (mouseScreenY - this.state.ui.pan.y) / this.state.ui.zoom;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.max(0.15, Math.min(5.0, this.state.ui.zoom * zoomFactor));

      // Adjust pan to keep cursor position fixed in world coordinates
      this.state.ui.pan.x = mouseScreenX - worldX * newZoom;
      this.state.ui.pan.y = mouseScreenY - worldY * newZoom;
      this.state.ui.zoom = newZoom;

      this.applyTransform();
      this.state.notify('view_change');
    }, { passive: false });

    // Keyboard events
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.code === 'Space' && !this.spacePressed) {
        this.spacePressed = true;
        this.svg.style.cursor = 'grab';
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.state.redo();
        } else {
          this.state.undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.state.redo();
        return;
      }

      // Tool hotkeys: 1=Select, 2=Wall, 3=Door, 4=Window
      if (e.key === '1' || e.key.toLowerCase() === 's') this.setTool('select');
      else if (e.key === '2' || e.key.toLowerCase() === 'w') this.setTool('wall');
      else if (e.key === '3' || e.key.toLowerCase() === 'd') this.setTool('door');
      else if (e.key === '4' || e.key.toLowerCase() === 'i') this.setTool('window');

      if (this.activeToolInstance?.onKeyDown) {
        this.activeToolInstance.onKeyDown(e);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spacePressed = false;
        this.svg.style.cursor = '';
      }
    });
  }

  setTool(toolName) {
    if (this.activeToolInstance) {
      this.activeToolInstance.deactivate();
    }
    this.state.setActiveTool(toolName);
    this.activeToolInstance = this.tools[toolName] || this.tools.select;
    this.activeToolInstance.activate();
    this.render();
  }

  screenToWorld(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const x = (screenX - this.state.ui.pan.x) / this.state.ui.zoom;
    const y = (screenY - this.state.ui.pan.y) / this.state.ui.zoom;
    return [x, y];
  }

  worldToScreen(worldX, worldY) {
    const rect = this.svg.getBoundingClientRect();
    const screenX = worldX * this.state.ui.zoom + this.state.ui.pan.x + rect.left;
    const screenY = worldY * this.state.ui.zoom + this.state.ui.pan.y + rect.top;
    return [screenX, screenY];
  }

  applyTransform() {
    this.viewGroup.setAttribute(
      'transform',
      `translate(${this.state.ui.pan.x}, ${this.state.ui.pan.y}) scale(${this.state.ui.zoom})`
    );
  }

  centerView() {
    const rect = this.container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    if (this.state.project.walls.length === 0) {
      this.state.ui.pan = { x: cx, y: cy };
      this.state.ui.zoom = 1.0;
    } else {
      // Fit all walls nicely with padding
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const w of this.state.project.walls) {
        minX = Math.min(minX, w.points[0][0], w.points[1][0]);
        minY = Math.min(minY, w.points[0][1], w.points[1][1]);
        maxX = Math.max(maxX, w.points[0][0], w.points[1][0]);
        maxY = Math.max(maxY, w.points[0][1], w.points[1][1]);
      }
      const planWidth = maxX - minX + 200;
      const planHeight = maxY - minY + 200;
      const scaleX = rect.width / planWidth;
      const scaleY = rect.height / planHeight;
      const zoom = Math.min(1.5, Math.max(0.3, Math.min(scaleX, scaleY)));
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      this.state.ui.zoom = zoom;
      this.state.ui.pan = {
        x: cx - midX * zoom,
        y: cy - midY * zoom
      };
    }

    this.applyTransform();
  }

  clearOverlay() {
    this.overlayGroup.innerHTML = '';
  }

  // --- Rendering Layers ---

  render() {
    this.applyTransform();
    this.renderRooms();
    this.renderWalls();
    this.renderOpenings();
    this.renderDimensions();
    this.renderSelection();
  }

  renderRooms() {
    this.roomsLayer.innerHTML = '';
    const { rooms } = this.state.project;

    // Palette of subtle, elegant architectural tints
    const tintColors = [
      'rgba(56, 189, 248, 0.08)',
      'rgba(168, 85, 247, 0.08)',
      'rgba(244, 114, 182, 0.08)',
      'rgba(52, 211, 153, 0.08)',
      'rgba(251, 191, 36, 0.08)',
      'rgba(99, 102, 241, 0.08)'
    ];

    rooms.forEach((room, idx) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'room-group');
      const isSelected = this.state.ui.selected?.type === 'room' && this.state.ui.selected.id === room.id;

      // Polygon polygon
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const ptsStr = room.points.map(p => `${p[0]},${p[1]}`).join(' ');
      poly.setAttribute('points', ptsStr);
      poly.setAttribute('fill', isSelected ? 'rgba(56, 189, 248, 0.22)' : tintColors[idx % tintColors.length]);
      poly.setAttribute('stroke', isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)');
      poly.setAttribute('stroke-width', isSelected ? '2' : '1');
      poly.setAttribute('class', 'room-polygon');

      poly.addEventListener('click', (e) => {
        if (this.state.ui.activeTool === 'select') {
          e.stopPropagation();
          this.state.select('room', room.id);
        }
      });
      g.appendChild(poly);

      // Centered Label Badge
      if (room.centroid) {
        const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        badgeG.setAttribute('transform', `translate(${room.centroid[0]}, ${room.centroid[1]})`);
        badgeG.setAttribute('class', 'room-badge');

        const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        titleText.setAttribute('class', 'room-title');
        titleText.setAttribute('text-anchor', 'middle');
        titleText.setAttribute('y', '-6');
        titleText.textContent = room.name || 'Room';
        badgeG.appendChild(titleText);

        const areaText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        areaText.setAttribute('class', 'room-area');
        areaText.setAttribute('text-anchor', 'middle');
        areaText.setAttribute('y', '14');
        areaText.textContent = `${room.areaM2.toFixed(2)} m²`;
        badgeG.appendChild(areaText);

        badgeG.addEventListener('click', (e) => {
          if (this.state.ui.activeTool === 'select') {
            e.stopPropagation();
            this.state.select('room', room.id);
          }
        });

        g.appendChild(badgeG);
      }

      this.roomsLayer.appendChild(g);
    });
  }

  renderWalls() {
    this.wallsLayer.innerHTML = '';
    const { walls } = this.state.project;

    for (const wall of walls) {
      const isSelected = this.state.ui.selected?.type === 'wall' && this.state.ui.selected.id === wall.id;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', wall.points[0][0]);
      line.setAttribute('y1', wall.points[0][1]);
      line.setAttribute('x2', wall.points[1][0]);
      line.setAttribute('y2', wall.points[1][1]);
      line.setAttribute('stroke-width', wall.thickness);
      line.setAttribute('stroke-linecap', 'square');
      line.setAttribute('class', `wall-segment ${isSelected ? 'selected' : ''}`);

      line.addEventListener('click', (e) => {
        if (this.state.ui.activeTool === 'select') {
          e.stopPropagation();
          this.state.select('wall', wall.id);
        }
      });

      this.wallsLayer.appendChild(line);

      // Render endpoints joints
      for (const pt of wall.points) {
        const joint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        joint.setAttribute('cx', pt[0]);
        joint.setAttribute('cy', pt[1]);
        joint.setAttribute('r', wall.thickness / 2);
        joint.setAttribute('class', `wall-joint ${isSelected ? 'selected' : ''}`);
        this.wallsLayer.appendChild(joint);
      }
    }
  }

  renderOpenings() {
    this.openingsLayer.innerHTML = '';
    const { walls, doors, windows } = this.state.project;

    // Doors
    for (const door of doors) {
      const wall = walls.find(w => w.id === door.wallId);
      if (!wall) continue;

      const isSelected = this.state.ui.selected?.type === 'door' && this.state.ui.selected.id === door.id;
      const p1 = wall.points[0];
      const p2 = wall.points[1];
      const wallLen = dist(p1, p2);
      if (wallLen === 0) continue;

      const dir = [(p2[0] - p1[0]) / wallLen, (p2[1] - p1[1]) / wallLen];
      const normal = [-dir[1], dir[0]];
      const center = [p1[0] + dir[0] * door.offset, p1[1] + dir[1] * door.offset];

      const halfW = door.width / 2;
      const hinge = [center[0] - dir[0] * halfW, center[1] - dir[1] * halfW];
      const strike = [center[0] + dir[0] * halfW, center[1] + dir[1] * halfW];

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `door-group ${isSelected ? 'selected' : ''}`);

      // Cutout mask line
      const cutLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      cutLine.setAttribute('x1', hinge[0]);
      cutLine.setAttribute('y1', hinge[1]);
      cutLine.setAttribute('x2', strike[0]);
      cutLine.setAttribute('y2', strike[1]);
      cutLine.setAttribute('stroke-width', wall.thickness + 2);
      cutLine.setAttribute('class', 'door-opening-cut');
      g.appendChild(cutLine);

      // Swing leaf
      const side = door.side || 1;
      const swingNormal = [normal[0] * side, normal[1] * side];
      const leafEnd = [hinge[0] + swingNormal[0] * door.width, hinge[1] + swingNormal[1] * door.width];

      const leafLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      leafLine.setAttribute('x1', hinge[0]);
      leafLine.setAttribute('y1', hinge[1]);
      leafLine.setAttribute('x2', leafEnd[0]);
      leafLine.setAttribute('y2', leafEnd[1]);
      leafLine.setAttribute('class', 'door-leaf');
      g.appendChild(leafLine);

      // Arc
      const arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const sweepFlag = side > 0 ? 1 : 0;
      const d = `M ${strike[0]} ${strike[1]} A ${door.width} ${door.width} 0 0 ${sweepFlag} ${leafEnd[0]} ${leafEnd[1]}`;
      arcPath.setAttribute('d', d);
      arcPath.setAttribute('class', 'door-arc');
      g.appendChild(arcPath);

      g.addEventListener('click', (e) => {
        if (this.state.ui.activeTool === 'select') {
          e.stopPropagation();
          this.state.select('door', door.id);
        }
      });

      this.openingsLayer.appendChild(g);
    }

    // Windows
    for (const win of windows) {
      const wall = walls.find(w => w.id === win.wallId);
      if (!wall) continue;

      const isSelected = this.state.ui.selected?.type === 'window' && this.state.ui.selected.id === win.id;
      const p1 = wall.points[0];
      const p2 = wall.points[1];
      const wallLen = dist(p1, p2);
      if (wallLen === 0) continue;

      const dir = [(p2[0] - p1[0]) / wallLen, (p2[1] - p1[1]) / wallLen];
      const normal = [-dir[1], dir[0]];
      const center = [p1[0] + dir[0] * win.offset, p1[1] + dir[1] * win.offset];

      const halfW = win.width / 2;
      const halfT = wall.thickness / 2;
      const startPt = [center[0] - dir[0] * halfW, center[1] - dir[1] * halfW];
      const endPt = [center[0] + dir[0] * halfW, center[1] + dir[1] * halfW];

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `window-group ${isSelected ? 'selected' : ''}`);

      // Opening cut
      const cutLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      cutLine.setAttribute('x1', startPt[0]);
      cutLine.setAttribute('y1', startPt[1]);
      cutLine.setAttribute('x2', endPt[0]);
      cutLine.setAttribute('y2', endPt[1]);
      cutLine.setAttribute('stroke-width', wall.thickness + 2);
      cutLine.setAttribute('class', 'window-opening-cut');
      g.appendChild(cutLine);

      // Glass lines
      for (const sign of [-0.3, 0.3]) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', startPt[0] + normal[0] * (halfT * sign));
        line.setAttribute('y1', startPt[1] + normal[1] * (halfT * sign));
        line.setAttribute('x2', endPt[0] + normal[0] * (halfT * sign));
        line.setAttribute('y2', endPt[1] + normal[1] * (halfT * sign));
        line.setAttribute('class', 'window-glass-line');
        g.appendChild(line);
      }

      g.addEventListener('click', (e) => {
        if (this.state.ui.activeTool === 'select') {
          e.stopPropagation();
          this.state.select('window', win.id);
        }
      });

      this.openingsLayer.appendChild(g);
    }
  }

  renderDimensions() {
    this.dimensionsLayer.innerHTML = '';
    const unitsPerMeter = this.state.project.scale.unitsPerMeter || 100;

    for (const wall of this.state.project.walls) {
      const p1 = wall.points[0];
      const p2 = wall.points[1];
      const lenUnits = dist(p1, p2);
      if (lenUnits < 40) continue; // Skip tiny dimensions

      const lenM = (lenUnits / unitsPerMeter).toFixed(2);
      const midX = (p1[0] + p2[0]) / 2;
      const midY = (p1[1] + p2[1]) / 2;

      // Normal offset for label so it doesn't collide with wall line
      const dir = [(p2[0] - p1[0]) / lenUnits, (p2[1] - p1[1]) / lenUnits];
      const normal = [-dir[1], dir[0]];
      const offsetDist = wall.thickness / 2 + 14 / this.state.ui.zoom;

      const labelX = midX + normal[0] * offsetDist;
      const labelY = midY + normal[1] * offsetDist;

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', labelX);
      text.setAttribute('y', labelY);
      text.setAttribute('class', 'dimension-label');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.textContent = `${lenM} m`;

      this.dimensionsLayer.appendChild(text);
    }
  }

  renderSelection() {
    if (this.selectionLayer) {
      this.selectionLayer.innerHTML = '';
    }
    if (!this.state.ui.selected) return;

    const { type, id } = this.state.ui.selected;
    if (type === 'wall') {
      const wall = this.state.project.walls.find(w => w.id === id);
      if (!wall) return;

      // Render vertex handles
      for (const [vIdx, pt] of wall.points.entries()) {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handle.setAttribute('cx', pt[0]);
        handle.setAttribute('cy', pt[1]);
        handle.setAttribute('r', 7 / this.state.ui.zoom);
        handle.setAttribute('class', 'selection-handle');
        this.selectionLayer.appendChild(handle);
      }
    }
  }

  renderSnapIndicator(point, snapInfo) {
    const zoom = this.state.ui.zoom;

    if (snapInfo.type === 'endpoint') {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point[0]);
      circle.setAttribute('cy', point[1]);
      circle.setAttribute('r', 8 / zoom);
      circle.setAttribute('class', 'snap-endpoint-circle');
      this.overlayGroup.appendChild(circle);
    } else if (snapInfo.type === 'grid') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const size = 10 / zoom;
      rect.setAttribute('x', point[0] - size / 2);
      rect.setAttribute('y', point[1] - size / 2);
      rect.setAttribute('width', size);
      rect.setAttribute('height', size);
      rect.setAttribute('class', 'snap-grid-box');
      this.overlayGroup.appendChild(rect);
    }

    if (snapInfo.guide) {
      // Render dashed angle guide line
      const guide = snapInfo.guide;
      const angleRad = (guide.angle * Math.PI) / 180;
      const lineLen = 3000;
      const gLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gLine.setAttribute('x1', guide.start[0] - Math.cos(angleRad) * lineLen);
      gLine.setAttribute('y1', guide.start[1] - Math.sin(angleRad) * lineLen);
      gLine.setAttribute('x2', guide.start[0] + Math.cos(angleRad) * lineLen);
      gLine.setAttribute('y2', guide.start[1] + Math.sin(angleRad) * lineLen);
      gLine.setAttribute('class', 'snap-guide-line');
      this.overlayGroup.appendChild(gLine);
    }
  }

  renderDimensionBadge(worldX, worldY, textContent) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${worldX}, ${worldY})`);
    g.setAttribute('class', 'dimension-badge');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.textContent = textContent;

    g.appendChild(text);
    this.overlayGroup.appendChild(g);
  }
}
