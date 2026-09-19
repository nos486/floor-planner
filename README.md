# FloorPlanner 2D

A lightweight, modern 2D floor-plan design web application built with pure HTML/CSS/JavaScript and SVG. It runs 100% in the browser with no backend or database required, and calculates live enclosed room areas ($m^2$) as you draw walls, doors, and windows.

![FloorPlanner Preview](public/favicon.svg)

---

## Features

- **Interactive Scaled SVG Canvas**:
  - Configurable grid (e.g., $1\text{ grid square} = 20\text{ cm}$, $1\text{ m} = 100\text{ units}$).
  - Smooth pan (Space + Drag or Middle Mouse Drag) and zoom (mouse wheel / trackpad pinch).
  - Multi-tiered snapping: grid snapping, existing wall endpoint snapping, and $0^\circ / 45^\circ / 90^\circ$ angle guidelines.
- **Drawing Tools**:
  - **Wall Tool**: Click to place vertices (polyline chaining), live dimension tags, editable wall thickness (default $20\text{ cm}$). Double-click or `Esc` to finish.
  - **Door Tool**: Snaps directly to walls, calculates opening cut, draws architectural $90^\circ$ swing arcs, and supports flipping swing direction (`Space` or `F`).
  - **Window Tool**: Snaps to walls with clean double-line architectural sill rendering.
  - **Select & Move Tool**: Drag walls, move connected junction vertices together, adjust door/window offsets along walls, and delete elements with the `Delete` key.
- **Automated Room Detection & Area Calculation**:
  - Extracts enclosed polygons from planar wall graphs using left-turn traversal.
  - Computes room area in square meters ($m^2$) using the Shoelace formula converted via project scale.
  - Displays auto-centered room labels with live areas, allows renaming rooms, and reports total home area.
- **Undo / Redo History Stack**: Full state snapshots with `Ctrl+Z` / `Ctrl+Y` (`Cmd+Z` / `Cmd+Shift+Z`).
- **Persistence & Export**:
  - Auto-saves to browser `localStorage` on every change.
  - Save project as a `.json` file via the File System Access API (with download fallback).
  - Load previous `.json` files to resume work anytime.
  - Export floor plan directly as an SVG graphic.

---

## Local Development

To run the application locally:

```bash
# Install dependencies
npm install

# Start local dev server (default http://localhost:3000)
npm run dev

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Deploying to Cloudflare Pages

This application is completely static and contains no server-side functions. It can be deployed to Cloudflare Pages in two ways:

### Option A: Git Integration (Recommended)

1. Push your repository to **GitHub** or **GitLab**.
2. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select your repository and configure the build settings:
   - **Project name**: `fplanner` (or any name you choose)
   - **Production branch**: `main`
   - **Framework preset**: `Vite` (or `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Click **Save and Deploy**. Cloudflare Pages will build and deploy your site on its global edge network.

### Option B: Direct Upload via Wrangler CLI

If you prefer deploying without connecting Git:

```bash
# 1. Build the production output
npm run build

# 2. Deploy the dist directory using Wrangler
npx wrangler pages deploy dist --project-name fplanner
```

---

## JSON Project Schema

Floor plan files are exported as human-readable JSON files conforming to this schema:

```json
{
  "projectName": "My Home Plan",
  "scale": {
    "unitsPerMeter": 100,
    "gridCm": 20
  },
  "walls": [
    {
      "id": "w_1",
      "points": [[-150, -200], [350, -200]],
      "thickness": 20
    }
  ],
  "doors": [
    {
      "id": "d_1",
      "wallId": "w_1",
      "offset": 80,
      "width": 90,
      "flipped": false,
      "side": 1
    }
  ],
  "windows": [
    {
      "id": "win_1",
      "wallId": "w_1",
      "offset": 200,
      "width": 120
    }
  ],
  "rooms": [
    {
      "id": "room_1",
      "name": "Living Room",
      "areaM2": 20.0,
      "centroid": [100, 0]
    }
  ]
}
```

---

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `1` or `S` | Select & Move Tool |
| `2` or `W` | Wall Tool |
| `3` or `D` | Door Tool |
| `4` or `I` | Window Tool |
| `Space` + Drag | Pan Canvas |
| `Space` or `F` | Flip Door Swing Direction (while placing or editing) |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete Selected Element |
| `Escape` | Cancel Drawing / Clear Selection |
