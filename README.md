# GeoJSON Studio

Vector map exporter — draw or import regions, then export them for Alight
Motion, SVG, KML or transparent PNG.

This used to be one 9,415-line `index.html`. It is now a Vite + React app.
The original file is kept at [`legacy/index.html`](legacy/index.html) so
behaviour can be diffed against it — and the test suite does exactly that.

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production bundle in dist/
npm run check     # module-graph check + TDZ check + tests
```

## Layout

```
index.html                  Vite entry: <div id="root"> + module script
src/
  main.jsx                  mounts React, then hands off to the engine
  App.jsx                   composes the UI in the original document order
  index.css                 Tailwind layers, then the app's own CSS
  ui/                       14 components — one per region of the old markup
    drawers/                Export / Draw / Style / Image / Layers
  engine/                   32 modules, split along the original section banners
    state.js                the 92 mutable fields, behind an observable Proxy
    actions.js              every function the UI can call (the old inline onclick targets)
  store/                    createStore + useSyncExternalStore hooks
  lib/
    icons.js                lucide registry + <Icon> + createIcons() shim
    leaflet-setup.js        loads Leaflet and Geoman in the required order
scripts/
  check-module-graph.mjs    every import resolves to a real export
  check-tdz.mjs             no top-level read of a binding from a module in a cycle
  migrate/                  the codemod that performed the split (see below)
legacy/index.html           the original monolith, untouched
```

## How the split was done

The refactor was performed by a codemod rather than by hand, so it is
reproducible: `npm run migrate` regenerates `src/` from `legacy/index.html`
byte-for-byte. The scripts in `scripts/migrate/` are the record of what
happened to those 9,400 lines.

| Step | What it did |
|---|---|
| Drop shadowed duplicates | The old script declared 11 functions twice (`ensureCurveStore`, `rebuildCurvedGeometry`, `setCurveAmount`, …). In one sloppy-mode script scope the last declaration wins, so the earlier copies were unreachable. They are gone. |
| `let` → `S.*` | 92 top-level mutable bindings moved onto a single store object; 1,089 references rewritten, using scope analysis so a local `const map = {}` was never mistaken for the engine's `map`. |
| Bucket into modules | Declarations were filed by the `// ===== SECTION =====` banner above them, then import statements were generated from what each bucket actually references. |
| CDN → npm | `loadScriptOnce()` injected `<script>` tags for Turf, TopoJSON and MapLibre. Those are dynamic `import()`s of real dependencies now, so Vite code-splits them. |
| `DOMContentLoaded` → `startEngine()` | React owns the document, so the engine is started explicitly from a ref callback once the tree has committed. |
| Markup → JSX | `class`→`className`, 151 `<i data-lucide>` → `<Icon>`, 129 inline handlers → `onClick={() => actions.foo()}` with `this` rewritten to `e.currentTarget`. `value` became `defaultValue` because the engine writes those fields imperatively. |

Two constants (`TUTORIAL_STEPS`, `TUTORIAL_CTAS`) were kept out of
`constants.js` on purpose: their initializers close over engine functions, so
putting them there would make that module import half the app and turn a
harmless import cycle into a TDZ crash the first time the entry order changed.

## Where React stops and the engine begins

This is a **hybrid**, deliberately. React renders the interface; the engine —
Leaflet, Geoman, the canvas bakers, the tile fetchers — stays imperative and
keeps updating the DOM it has always updated.

The seam is explicit:

- components never import engine internals, only `actions`
- the engine never imports React
- `src/engine/state.js` is the one place mutable app state lives, behind a
  Proxy, so a plain `S.foo = x` notifies subscribers

`src/store/useAppState.js` exposes `useEngineVersion()` and
`useEngineValue(select)` on top of `useSyncExternalStore`. They are used by
the tests today; no panel has been converted to render from them yet, so the
status chips and toggle highlights are still written imperatively by the
engine. Converting a panel means deleting its imperative writer at the same
time — doing both at once is what keeps React and the engine from fighting
over the same element.

`StrictMode` is off. Its development mount/unmount/remount cycle would rebuild
the subtree while the Leaflet map stays bound to the detached first copy.

## Notes

- **Icons.** Static markup uses `<Icon name="…">`. The engine still builds HTML
  strings with `data-lucide` for marker labels and tutorial steps, so
  `src/lib/icons.js` also exports a scoped `createIcons(root)`. The registry
  lists the 85 icons this app actually uses instead of all ~1,500.
- **Leaflet + Geoman.** Geoman ships a pre-bundled IIFE that reads a global
  `L`, so `src/lib/leaflet-setup.js` sets `window.L` in a module imported
  *before* it. Both must be loaded in that order.
- **Tailwind** is build-time 3.4 with default config, matching the CDN build
  the app used to load. The app's own CSS sits after the Tailwind layers,
  which is the order the CDN produced and therefore the order the specificity
  ties were resolved in.
- **Remaining CDN URLs** are runtime *data* fetches, not libraries:
  `world-atlas` TopoJSON and ISO country codes, each with the same fallback
  host list as before. Tile servers are unchanged.
- **Known dead code, left alone.** Most of the "curved edges" feature
  (`toggleCurveEdgeMode`, `curveAllEdges`, `setCurveAmount`, both the v1 and v2
  implementations) is not reachable from any button or keyboard shortcut in the
  original app either. Removing it is a separate decision from porting it, so
  it was carried across rather than deleted.

## Tests

`npm run check` runs three things:

1. **module graph** — 60 source files, 539 relative imports, every named
   import resolves to a real export
2. **TDZ** — no top-level initializer reads a binding from a module it is in an
   import cycle with
3. **37 tests**, in three groups:
   - *parity* — loads the original monolith into a `vm` sandbox and diffs it
     against the new modules on identical inputs: colour conversions, the SVG /
     KML / Alight Motion path builders, MVT decoding, the border roughener,
     sea-colour masking, and a byte-identical `liveGeoJSONString` comparison
     over real Leaflet features
   - *smoke* — mounts the component tree, runs `startEngine()`, asserts the
     engine finds the elements React rendered and initialises the map on them
   - *dist* — boots the built `dist/` bundle, because dev and prod resolve the
     Leaflet/Geoman UMD interop differently
