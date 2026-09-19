/**
 * Persistence: LocalStorage auto-save and JSON file import/export.
 */

const STORAGE_KEY = 'fplanner_saved_project_v1';

export function saveToLocalStorage(projectData) {
  try {
    const serialized = JSON.stringify(projectData);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    console.warn('Could not save project to localStorage:', err);
    return false;
  }
}

export function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateProjectSchema(parsed) ? parsed : null;
  } catch (err) {
    console.warn('Could not load project from localStorage:', err);
    return null;
  }
}

export function clearLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Exports project as a formatted .json file.
 * Uses File System Access API `showSaveFilePicker` if supported, with fallback to blob download.
 */
export async function exportProjectJSON(projectData) {
  const filename = `${(projectData.projectName || 'floor_plan').toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
  const content = JSON.stringify(projectData, null, 2);

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Floor Plan JSON File',
          accept: { 'application/json': ['.json'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false; // User cancelled picker
      console.warn('showSaveFilePicker failed, falling back to download:', err);
    }
  }

  // Fallback: standard <a> blob download
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Imports project from a .json file.
 * Uses `showOpenFilePicker` if supported, with fallback to hidden file input.
 */
export async function importProjectJSON() {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Floor Plan JSON File',
          accept: { 'application/json': ['.json'] }
        }],
        multiple: false
      });
      const file = await handle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!validateProjectSchema(parsed)) {
        throw new Error('Invalid floor plan file format.');
      }
      return parsed;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      console.warn('showOpenFilePicker failed, falling back to file input:', err);
    }
  }

  // Fallback: input element
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!validateProjectSchema(parsed)) {
          alert('Selected file does not have a valid floor plan structure.');
          resolve(null);
          return;
        }
        resolve(parsed);
      } catch (err) {
        alert('Failed to parse JSON file: ' + err.message);
        reject(err);
      } finally {
        document.body.removeChild(input);
      }
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Validates project JSON schema
 */
export function validateProjectSchema(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.walls)) return false;
  if (!data.scale || typeof data.scale !== 'object') return false;
  return true;
}
