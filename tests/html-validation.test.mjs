import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/html-validation.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { getInlineJavaScriptDiagnostics } = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));

test("does not parse import maps as JavaScript", () => {
  const html = '<html><head><script type="importmap">{"imports":{"three":"https://cdn.example/three.js"}}</script></head><body><script>console.log("ok")</script></body></html>';
  assert.deepEqual(getInlineJavaScriptDiagnostics(html), []);
});

test("does not parse embedded JSON data blocks as JavaScript", () => {
  const html = '<script type="application/json" id="game-data">{"enabled":true,"items":[1,2,3]}</script>';
  assert.deepEqual(getInlineJavaScriptDiagnostics(html), []);
});

test("validates classic inline JavaScript", () => {
  const html = '<script>const ready = true; console.log(ready);</script>';
  assert.deepEqual(getInlineJavaScriptDiagnostics(html), []);
});

test("validates inline module JavaScript", () => {
  const html = '<script type="module">import { start } from "./main.js"; start();</script>';
  assert.deepEqual(getInlineJavaScriptDiagnostics(html), []);
});

test("reports actual inline JavaScript syntax errors with a line number", () => {
  const html = '<script>\nconst ready = ;\n</script>';
  const diagnostics = getInlineJavaScriptDiagnostics(html);
  assert.ok(diagnostics.length > 0);
  assert.equal(diagnostics[0].scriptIndex, 1);
  assert.equal(diagnostics[0].line, 2);
});
