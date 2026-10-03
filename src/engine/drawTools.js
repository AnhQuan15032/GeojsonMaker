// Split out of the original single-file engine (see legacy/index.html).
// Origin: DRAW TOOLS

import { S } from './state.js';
import { PREVIEW_COLOR } from './constants.js';
import { removeShapeCompletely } from './countries.js';
import { exitCurveEdgeMode } from './curves.js';
import { setSplitStatus } from './split.js';
import { closeDrawers, showToast } from './uiHelpers.js';

// ================= DRAW TOOLS =================
export function setDrawMode(shape) {
  closeDrawers();
  S.splitModeActive = false;
  setSplitStatus('idle');
  exitCurveEdgeMode();
  S.map.pm.disableGlobalEditMode();
  S.map.pm.setGlobalOptions({
    pathOptions: {
      color: PREVIEW_COLOR,
      fillColor: PREVIEW_COLOR,
      fillOpacity: 1,
      weight: 0,
      opacity: 0
    }
  });
  if (shape === 'Polygon') S.map.pm.enableDraw('Polygon');else if (shape === 'Line') S.map.pm.enableDraw('Line');else if (shape === 'Rectangle') S.map.pm.enableDraw('Rectangle');else if (shape === 'Marker') S.map.pm.enableDraw('Marker');
  showToast(`Draw ${shape}: click/tap on map`);
}

export function toggleEditMode() {
  const btn = document.getElementById('btn-edit-mode');
  if (S.map.pm.globalEditModeEnabled()) {
    S.map.pm.disableGlobalEditMode();
    btn.classList.remove('bg-amber-600');
    showToast("Edit mode disabled");
  } else {
    S.map.pm.enableGlobalEditMode();
    btn.classList.add('bg-amber-600');
    closeDrawers();
    showToast("Drag shape points to edit");
  }
}

export function deleteSelectedOrLast() {
  if (S.activeSelectedLayer) {
    removeShapeCompletely(S.activeSelectedLayer);
    showToast("Shape deleted");
  } else {
    const layers = S.drawnItems.getLayers();
    if (layers.length > 0) {
      removeShapeCompletely(layers[layers.length - 1]);
      showToast("Last shape deleted");
    }
  }
}

// ================= BASE MAPS & BORDERS =================

// ---- MapLibre GL vector styles (bridge keeps Leaflet in charge) ----
