# TerraMind product scope

## Product definition
TerraMind is a natural-language-driven 3D scene authoring tool. Users describe a scene or edit an existing object; the system translates requests into bounded, inspectable scene operations and renders the result.

## Core loop
1. Understand the requested change.
2. Resolve referenced objects, groups and spatial relationships against the current scene.
3. Produce a structured operation plan.
4. Show a preview of affected entities and property changes.
5. Validate and apply the plan only after explicit user confirmation.
6. Support undo/redo and save/reopen.

## First usable release
- One editable 3D scene.
- Create, select, transform, rename and delete primitive objects and simple composite groups.
- A small explicit material and color vocabulary.
- Natural-language commands mapped to a validated operation schema.
- Multi-turn references to the previous target and explicit scene objects.
- Relative placement against an existing object/group.
- Preview, explicit confirmation, stale-plan rejection, undo/redo and scene serialization.

## Explicitly out of scope
- Ecosystem, animal, civilization or world evolution simulation.
- Custom physics or fluid simulation.
- Parallel universes and scientific prediction.
- Autonomous agents modifying scenes without approval.
- Arbitrary LLM-generated code execution.

## Architecture boundary
- \`SceneDocument\` is the deterministic source of truth for editable entities and optional group metadata.
- \`view.mjs\` owns Three.js rendering and user input.
- \`semantic-index.mjs\` resolves entity names, group aliases, type aliases and conversation references; ambiguous targets are rejected instead of guessed.
- \`assistant.mjs\` produces validated operation plans, previews and confirmation-time commits. A plan is bound to the exact scene snapshot used to create it.
- \`llm-contract.mjs\` defines a provider-neutral Function Calling schema. A future server-side provider adapter must pass model output through \`validateToolProposal\`; generated code is never executed.
- The legacy ecological \`World\` module remains preserved as an experiment and is not part of the new product loop.

## V0.3 implementation slice
- Three.js renders editable primitive entities from \`SceneDocument\`.
- Users can select entities and manipulate translation, rotation and scale.
- The property panel edits name, color and position.
- Chinese local commands create primitives and a castle preset, edit a specific castle part or the whole castle group, recolor, move, scale and delete entities.
- Operations are validated and applied atomically.
- Undo/redo, browser local persistence, JSON export and JSON import are available.

## V0.4 implementation slice
- A scene semantic index resolves group names, simple aliases, object types and ambiguous references.
- Conversation context retains the last target and anchor for follow-up commands such as \`再高一点\`.
- Relative placement supports creating a bridge beside a castle, moving an existing group beside a reference, and moving a group closer to or farther from another group.
- All natural-language commands generate a preview; explicit confirmation is required to commit.
- A preview is rejected if the scene changes before confirmation.
- A strict Function Calling contract and model-proposal validator are implemented, but no live model provider or backend endpoint is connected.

## Acceptance criteria
- Entity creation, update and deletion are deterministic.
- Invalid types, properties, vectors, colors and scales are rejected.
- Serialized scenes restore without changing entity state.
- Failed multi-operation plans do not partially mutate the source scene.
- Semantic resolution does not silently choose among multiple matching objects.
- Multi-turn references remain bound to existing scene IDs and fail safely if those IDs disappear.
- Plans are preview-only until confirmation and cannot be applied to a different scene snapshot.
- Model proposals are restricted to the declared operation schema and pass through deterministic scene validation.
- Browser interaction and visual quality must be separately verified before calling the version release-ready.

## Status
The V0.4 planning slice is committed. Node.js tests cover semantic planning, relative placement, multi-turn context, preview/confirm, stale-plan rejection and Function Calling proposal validation. Legacy ecology and protocol tests also pass; the view module passes a JavaScript syntax check. Real browser acceptance, visual quality, performance and live LLM integration remain outstanding.
