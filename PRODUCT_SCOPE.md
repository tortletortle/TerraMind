# TerraMind product scope

## Product definition
TerraMind is a natural-language-driven 3D scene authoring tool. Users describe a scene or edit an existing object; the system translates requests into bounded, inspectable scene operations and renders the result.

## Core loop
1. Understand the requested change.
2. Resolve referenced objects and spatial relationships.
3. Produce a structured operation plan.
4. Validate the plan before applying it atomically.
5. Reflect the change in the 3D view.
6. Support undo/redo and save/reopen.

## First usable release
- One editable 3D scene.
- Create, select, transform, rename and delete primitive objects and simple composite groups.
- A small explicit material and color vocabulary.
- Natural-language commands mapped to a validated operation schema.
- Preview, validation, undo/redo and scene serialization.

## Explicitly out of scope
- Ecosystem, animal, civilization or world evolution simulation.
- Custom physics or fluid simulation.
- Parallel universes and scientific prediction.
- Autonomous agents modifying scenes without approval.
- Arbitrary LLM-generated code execution.

## Architecture boundary
- `SceneDocument` is the deterministic source of truth for editable entities.
- `view.mjs` owns Three.js rendering and user input.
- `intent.mjs` currently provides a constrained local parser and structured operation plan.
- A future LLM adapter may replace or augment intent parsing, but must emit the same validated operation schema; it must never execute generated JavaScript.
- The legacy ecological `World` module remains preserved as an experiment and is not part of the new product loop.

## V0.3 implementation slice
- Three.js renders editable primitive entities from `SceneDocument`.
- Users can select entities and manipulate translation, rotation and scale.
- The property panel edits name, color and position.
- Chinese local commands create primitives and a castle preset, edit a specific castle part or the whole castle group, recolor, move, scale and delete entities.
- Operations are validated and applied atomically.
- Undo/redo, browser local persistence, JSON export and JSON import are available.

## Acceptance criteria
- Entity creation, update and deletion are deterministic.
- Invalid types, properties, vectors, colors and scales are rejected.
- Serialized scenes restore without changing entity state.
- Failed multi-operation plans do not partially mutate the source scene.
- The Three.js view reflects the scene document without becoming the source of truth.
- Browser interaction and visual quality must be separately verified before calling the version release-ready.

## Status
The V0.3 code slice is committed. Node.js tests cover scene CRUD, validation, atomic operations and supported natural-language commands; the legacy ecology tests also pass, and the view module passes a JavaScript syntax check. Actual browser acceptance, cross-device behavior, frame-rate measurement, visual quality assessment and LLM integration remain outstanding.
