# TerraMind product scope

## Product definition
TerraMind is a natural-language-driven 3D scene authoring tool. Users describe a scene or edit an existing object; the system translates requests into bounded, inspectable scene operations and renders the result.

## Core loop
1. Understand the requested change.
2. Resolve referenced objects and spatial relationships.
3. Produce a structured operation plan.
4. Validate before applying.
5. Apply only the intended scene changes.
6. Support undo/redo and save/reopen.

## First usable release
- One editable 3D scene.
- Create, select, transform, rename and delete primitive objects.
- A small explicit material and lighting vocabulary.
- Natural-language commands mapped to structured operations.
- Preview, validation, undo/redo and scene serialization.

## Explicitly out of scope
- Ecosystem, animal, civilization or world evolution simulation.
- Custom physics or fluid simulation.
- Parallel universes and scientific prediction.
- Autonomous agents modifying scenes without approval.
- Arbitrary LLM-generated code execution.

## Architecture boundary
- SceneDocument is the deterministic source of truth for editable entities.
- view.mjs owns Three.js rendering and user input.
- A future intent adapter may call an LLM, but must emit a validated operation schema; it must never execute generated JavaScript.
- The legacy ecological World module remains preserved as an experiment and is not part of the new product loop.

## Acceptance criteria
- Entity creation, update and deletion are deterministic.
- Invalid types, properties, vectors and scales are rejected.
- Serialized scenes restore without changing entity state.
- Operations can be wrapped by undo/redo transactions.
- The Three.js view reflects SceneDocument without becoming the source of truth.

## Status
The repository still contains the earlier ecological prototype and its Three.js view. SceneDocument is the first isolated foundation for the narrowed direction; it is not yet wired into the view. LLM integration, browser acceptance, visual quality and performance are not claimed complete.
