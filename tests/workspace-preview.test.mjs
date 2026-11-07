import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/workspace-preview.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { buildWorkspacePreview } = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));

test("embeds local CSS paths with relative prefixes and query strings", () => {
  const html = '<html><head><link rel="stylesheet" href="./src/style.css?v=2"></head><body></body></html>';
  const result = buildWorkspacePreview(html, [{ path: "src/style.css", content: "body { color: red; }" }]);
  assert.match(result, /<style data-roboeduc-file="src\/style\.css">/);
  assert.match(result, /body \{ color: red; \}/);
  assert.doesNotMatch(result, /href="\.\/src\/style\.css\?v=2"/);
});

test("embeds local JavaScript paths and preserves module type", () => {
  const html = '<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>';
  const result = buildWorkspacePreview(html, [{ path: "src/main.js", content: "window.gameReady = true;" }]);
  assert.match(result, /<script type="module" data-roboeduc-file="src\/main\.js">/);
  assert.match(result, /window\.gameReady = true;/);
  assert.doesNotMatch(result, /src="\/src\/main\.js"/);
});

test("keeps external resources unchanged", () => {
  const html = '<html><head><link rel="stylesheet" href="https://cdn.example.com/app.css"></head><body><script src="https://cdn.example.com/app.js"></script></body></html>';
  const result = buildWorkspacePreview(html, []);
  assert.match(result, /https:\/\/cdn\.example\.com\/app\.css/);
  assert.match(result, /https:\/\/cdn\.example\.com\/app\.js/);
});

test("does not resolve paths outside the virtual project", () => {
  const html = '<html><head><link rel="stylesheet" href="../outside.css"></head><body><script src="../../outside.js"></script></body></html>';
  const result = buildWorkspacePreview(html, [{ path: "outside.css", content: "body{color:red}" }, { path: "outside.js", content: "alert(1)" }]);
  assert.match(result, /\.\.\/outside\.css/);
  assert.match(result, /\.\.\/\.\.\/outside\.js/);
});

test("injects isolated preview runtime diagnostics", () => {
  const result = buildWorkspacePreview("<html><head></head><body></body></html>", []);
  assert.match(result, /__roboeducWorkspacePreview/);
  assert.match(result, /unhandledrejection/);
});


test("resolves Three.js bare imports and its addon package through an import map", () => {
  const html = '<html><head></head><body><script type="module" src="src/main.js"></script></body></html>';
  const files = [
    { path: "src/main.js", content: 'import * as THREE from "three";\nimport { PointerLockControls } from "three/addons/controls/PointerLockControls.js";\nimport { Player } from "./player.js";' },
    { path: "src/player.js", content: "export class Player {}" }
  ];
  const result = buildWorkspacePreview(html, files);
  assert.match(result, /"three":"https:\/\/unpkg\.com\/three@0\.160\.0\/build\/three\.module\.js"/);
  assert.match(result, /"three\/addons\/":"https:\/\/unpkg\.com\/three@0\.160\.0\/examples\/jsm\//);
  assert.match(result, /https:\/\/roboeduc\.local\/src\/player\.js/);
  assert.match(result, /data:text\/javascript;charset=utf-8/);
  assert.match(result, /<script type="module" data-roboeduc-file="src\/main\.js">/);
});

test("reports unresolved local module imports with a readable preview error", () => {
  const html = '<html><head></head><body><script type="module" src="src/main.js"></script></body></html>';
  const result = buildWorkspacePreview(html, [{ path: "src/main.js", content: 'import "./missing.js";' }]);
  assert.match(result, /Depend%C3%AAncia%20ou%20m%C3%B3dulo%20n%C3%A3o%20dispon%C3%ADvel%20no%20preview/);
});

test("does not rewrite import-like text inside comments and strings", () => {
  const html = '<html><head></head><body><script type="module" src="src/main.js"></script></body></html>';
  const code = `const example = 'import "./missing.js"';
// import "./also-missing.js";
export const ready = true;`;
// import "./also-missing.js";
export const ready = true;`;
  const result = buildWorkspacePreview(html, [{ path: "src/main.js", content: code }]);
  assert.match(result, /import "\.\/missing\.js"/);
  assert.match(result, /also-missing/);
  assert.doesNotMatch(result, /Depend%C3%AAncia%20ou%20m%C3%B3dulo/);
});

test("rewrites export-from and dynamic local imports", () => {
  const html = '<html><head></head><body><script type="module" src="src/main.js"></script></body></html>';
  const code = 'export { Player } from "./player.js";\nconst load = () => import("./lazy.js");';
  const result = buildWorkspacePreview(html, [
    { path: "src/main.js", content: code },
    { path: "src/player.js", content: "export class Player {}" },
    { path: "src/lazy.js", content: "export const loaded = true;" }
  ]);
  assert.equal((result.match(/roboeduc\.local\/src\/(?:player|lazy)\.js/g) ?? []).length, 2);
});


test("transpiles TypeScript entry modules and resolves typed local imports", () => {
  const html = '<html><head></head><body><script type="module" src="src/main.ts"></script></body></html>';
  const result = buildWorkspacePreview(html, [
    { path: "src/main.ts", content: `import { Player } from "./player";
const player: Player = new Player();
window.player = player;` },
    { path: "src/player.ts", content: 'export class Player { ready = true; }' }
  ]);
  assert.match(result, /<script type="module" data-roboeduc-file="src\/main\.ts">/);
  assert.match(result, /https:\/\/roboeduc\.local\/src\/player\.ts/);
  assert.doesNotMatch(result, /const player: Player/);
});

test("rewrites local imports inside inline module scripts", () => {
  const html = '<html><head></head><body><script type="module">import { Player } from "./src/player.js"; window.Player = Player;</script></body></html>';
  const result = buildWorkspacePreview(html, [{ path: "src/player.js", content: "export class Player {}" }]);
  assert.match(result, /https:\/\/roboeduc\.local\/src\/player\.js/);
  assert.match(result, /<script type="module">/);
});

test("merges multiple import maps and preserves scoped imports", () => {
  const html = '<html><head><script type="importmap">{"imports":{"pkg":"https://cdn.example/pkg.js"}}</script><script type="importmap">{"imports":{"other":"https://cdn.example/other.js"},"scopes":{"https://cdn.example/":{"dep":"https://cdn.example/dep.js"}}}</script></head><body></body></html>';
  const result = buildWorkspacePreview(html, []);
  assert.ok(result.includes('"pkg":"https://cdn.example/pkg.js"'));
  assert.ok(result.includes('"other":"https://cdn.example/other.js"'));
  assert.ok(result.includes('"scopes":{"https://cdn.example/"'));
  assert.equal((result.match(/type="importmap"/g) ?? []).length, 1);
});

test("inlines nested local CSS imports and keeps external imports", () => {
  const html = '<html><head><link rel="stylesheet" href="src/style.css"></head><body></body></html>';
  const files = [
    { path: "src/style.css", content: '@import "./theme/colors.css";\\n@import url("https://cdn.example/remote.css");\\nmain{display:grid}' },
    { path: "src/theme/colors.css", content: ':root{--accent:#4598d1}' }
  ];
  const result = buildWorkspacePreview(html, files);
  assert.match(result, /--accent:#4598d1/);
  assert.match(result, /https:\/\/cdn\.example\/remote\.css/);
  assert.doesNotMatch(result, /@import "\.\/theme\/colors\.css"/);
});
