# TerraMind product scope

## Product definition
TerraMind is a natural-language-driven 3D scene authoring tool. Users describe a scene or edit an existing object; the system translates requests into bounded, inspectable scene operations and renders the result.

## Core loop
1. Understand the requested change using the command and structured scene context.
2. Resolve referenced objects, groups and spatial relationships against the current scene.
3. Produce a structured operation plan through a local planner or a configured LLM provider.
4. Validate the plan against a cloned SceneDocument.
5. Show a preview of affected entities and property changes.
6. Apply the plan only after explicit user confirmation and a scene-snapshot freshness check.
7. Support undo/redo and save/reopen.

## First usable release
- One editable 3D scene.
- Create, select, transform, rename and delete primitive objects and simple composite groups.
- A small explicit material and color vocabulary.
- Natural-language commands mapped to a validated operation schema.
- Multi-turn references to the previous target and explicit scene objects.
- Relative placement against an existing object/group.
- Preview, explicit confirmation, stale-plan rejection, undo/redo and scene serialization.
- A server-side LLM adapter with provider-neutral configuration and no browser-side credentials.

## Explicitly out of scope
- Ecosystem, animal, civilization or world evolution simulation.
- Custom physics or fluid simulation.
- Parallel universes and scientific prediction.
- Autonomous agents modifying scenes without approval.
- Arbitrary LLM-generated code execution.
- Visual scene understanding from rendered screenshots (future research).
- Public multi-user deployment before authentication and authorization are implemented.

## Architecture boundary
- SceneDocument is the deterministic source of truth for editable entities and optional group metadata.
- view.mjs owns Three.js rendering and user input; it requests plans from the local backend and owns preview/confirmation UI.
- semantic-index.mjs resolves entity names, group aliases, type aliases and conversation references; ambiguous targets are rejected instead of guessed.
- assistant.mjs produces local plans and validates model proposals. It does not mutate the live scene while planning.
- llm-contract.mjs defines the single permitted propose_scene_operations function.
- llm-provider.mjs adapts Chat Completions and Responses request/response formats. It passes all model output to validateToolProposal.
- server.mjs owns provider credentials, request limits, same-origin checks and the static asset allowlist. It binds to loopback only.
- The legacy ecological World module remains preserved as an experiment and is not part of the new product loop.

## V0.3 implementation slice
- Three.js renders editable primitive entities from SceneDocument.
- Users can select entities and manipulate translation, rotation and scale.
- The property panel edits name, color and position.
- Chinese local commands create primitives and a castle preset, edit a specific castle part or the whole castle group, recolor, move, scale and delete entities.
- Operations are validated and applied atomically.
- Undo/redo, browser local persistence, JSON export and JSON import are available.

## V0.4 implementation slice
- A scene semantic index resolves group names, simple aliases, object types and ambiguous references.
- Conversation context retains the last target and anchor for follow-up commands such as 再高一点.
- Relative placement supports creating a bridge beside a castle, moving an existing group beside a reference, and moving a group closer to or farther from another group.
- All natural-language commands generate a preview; explicit confirmation is required to commit.
- A preview is rejected if the scene changes before confirmation.
- A strict Function Calling contract and model-proposal validator are implemented.

## V0.5 implementation slice
- A Node.js local server exposes /api/health and /api/plan.
- The provider adapter supports OpenAI-compatible Chat Completions and Responses formats.
- Model input includes the structured scene, selected object, bounded conversation context and up to eight recent messages (normally four user/assistant exchanges).
- Model output is restricted to one propose_scene_operations call or a text clarification; multiple calls and unknown tool names are rejected.
- Provider credentials remain in server environment variables.
- The server applies request-size, scene-size, timeout, rate-limit, same-origin and static-file allowlist controls.
- The browser falls back to the local rule planner when the gateway or provider is not configured.

## Acceptance criteria
- Entity creation, update and deletion are deterministic.
- Invalid types, properties, vectors, colors and scales are rejected.
- Serialized scenes restore without changing entity state.
- Failed multi-operation plans do not partially mutate the source scene.
- Semantic resolution does not silently choose among multiple matching objects.
- Multi-turn references remain bound to existing scene IDs and fail safely if those IDs disappear.
- Plans are preview-only until confirmation and cannot be applied to a different scene snapshot.
- Model proposals are restricted to the declared operation schema and pass through deterministic scene validation.
- Provider credentials are never exposed to browser code or returned from health endpoints.
- The development server is loopback-only; public deployment remains blocked until authentication and authorization exist.
- Browser interaction and visual quality must be separately verified before calling the version release-ready.

## Status
V0.5 adds the local LLM gateway, Chat Completions / Responses adapters, provider request validation, bounded scene context, error handling and UI integration. Mock-provider tests cover both API response shapes and server-side safeguards. No real API key or model call has been tested in this environment. Real provider smoke testing, browser acceptance, visual quality, performance and production authentication remain outstanding.
