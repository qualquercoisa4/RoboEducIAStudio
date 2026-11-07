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
