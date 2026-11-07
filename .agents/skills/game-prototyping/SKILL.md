# Game prototyping

## Choose the engine by game type
- 2D arcade/platformer: evaluate Phaser 3 browser build first for compatibility with the current static preview; inspect official examples and templates. Phaser 4 may require module/bundler support, so verify before choosing it.
- 3D browser game: evaluate Three.js browser UMD build first for compatibility with the current static preview; use a maintained game framework only if it materially helps.
- Physics-heavy 3D: evaluate Rapier or another maintained physics engine and verify browser/WASM setup and preview compatibility.
- Voxel/block worlds: use chunk-based terrain, instancing or merged geometry, spatial indexing, raycasting, and a real collision system. Do not create thousands of independent shadow-casting meshes.
- UI-heavy simulation or educational game: choose the smallest appropriate stack; do not force a game engine when DOM/canvas is sufficient.

## Required game loop
- Initialization and resize handling.
- Input abstraction for keyboard, mouse, and touch as applicable.
- Deterministic update loop with delta time.
- Camera and movement.
- Collision/physics that match the world geometry.
- Clear game state and restart/pause behavior.
- Feedback: HUD, selection, audio only when useful.
- Performance checks at a representative world size.

## Mobile requirements
- Never assume Pointer Lock is available on touch devices.
- Add touch-look (drag region or virtual joystick), virtual movement controls, action buttons, pointer events, and prevent unwanted page scrolling.
- Make buttons large enough and keep HUD within safe viewport areas.
- Test portrait/landscape and device pixel ratio; cap render resolution on slower devices.

## Three.js voxel checklist
- Prefer chunks and greedy meshing or InstancedMesh over one Mesh per block.
- Separate block data from render meshes.
- Use spatial lookup for raycast and collision; avoid rebuilding Array.from(blocks.values()) every click.
- Handle actual terrain height and axis-aligned collision.
- Reuse geometry/materials; avoid disposing shared geometry when deleting one block.
- Add world bounds and save/load if requested.
- Validate on touch devices, not only desktop.
