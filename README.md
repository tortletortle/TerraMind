# TerraMind

**Direction:** natural-language-driven 3D scene authoring, not a full ecological simulator.

## Repository
- index.html / view.mjs: earlier Three.js ecological prototype and interaction view.
- engine.mjs / protocol.mjs: legacy deterministic ecology model and constrained Chinese command parser.
- scene.mjs: new deterministic editable scene document (entity CRUD, validation, snapshot restore).
- test.mjs / test-protocol.mjs / test-scene.mjs: Node.js tests for legacy and new modules.

## Run
Serve this directory over HTTP and open http://localhost:8000. ES modules require a local server. Three.js is loaded from jsDelivr; internet access and WebGL are required for the current view.

Run tests:
    node test.mjs
    node test-protocol.mjs
    node test-scene.mjs

## Status boundaries
The existing UI is still the ecological prototype. The new scene document is not yet wired into the Three.js view. Natural-language commands use a small deterministic parser, not an LLM. Browser rendering, visual quality and performance have not been independently verified.

See PRODUCT_SCOPE.md for the narrowed product definition and acceptance criteria.
