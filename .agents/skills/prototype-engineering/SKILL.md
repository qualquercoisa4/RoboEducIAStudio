# Functional browser prototype engineering

## Goal
Deliver a runnable, interactive prototype, not a static mockup or source-code-only answer.

## Current RoboEduc preview compatibility
The live preview currently embeds local CSS and classic JavaScript files into a virtual HTML document. It does not run npm scripts, Vite dev servers, or resolve relative imports between local ES modules.
- Prefer multiple classic JavaScript files loaded in explicit dependency order from index.html.
- Use browser-ready UMD/IIFE builds from verified CDNs where appropriate (e.g. Three.js or Phaser 3).
- A single module entry may use verified CDN imports, but do not import local relative modules in the current preview.
- Do not create a Vite/npm runtime project and claim it works in the preview. Only choose a bundler if a real live runtime is available and verified.
- CSS, HTML, JS, JSON, SVG and other text assets can be stored as project files. Binary assets are not currently supported by the editor pipeline; use procedural assets, SVG, or verified external asset URLs.

## Project setup
- Inspect existing files and package manager first.
- Keep code modular across as many files and folders as the project needs; avoid arbitrary three-file layouts.
- Include README.md with exact run instructions when the project is more than a single static file.
- Prefer established browser-compatible packages over hand-written complex systems. Verify package names, versions, docs, CDN builds, and browser support.

## Verification
- Run syntax checks and focused automated tests.
- Inspect browser console and network errors when browser tooling is available.
- Test resize, keyboard, mouse, touch, and narrow viewport when relevant.
- Test the actual core interaction loop, not only whether the page loads.
- Report exactly what was run and what remains unverified.
