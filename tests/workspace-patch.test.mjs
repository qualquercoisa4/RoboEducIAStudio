import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/workspace-patch.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const workspacePatch = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));
const { assertSafeWorkspacePath, parseWorkspacePlan, validateProjectFiles } = workspacePatch;
const files = [{ path: "index.html", content: "<main></main>" }, { path: "src/main.js", content: "console.log('ready')" }];
test("aceita snapshot vazio", () => { assert.deepEqual(validateProjectFiles([]), []); });
test("preserva snapshot válido", () => { assert.deepEqual(validateProjectFiles(files), files); });
test("rejeita caminhos inseguros", () => {
  for (const path of ["../secret.txt", "/etc/passwd", "src" + String.fromCharCode(92) + "secret.js", ".env", ".env.local", "src/../secret.js", "src//file.js", ".git/config", "node_modules/pkg/index.js", ".next/cache"]) {
    assert.throws(() => assertSafeWorkspacePath(path));
  }
});
test("rejeita caracteres de controle", () => { assert.throws(() => assertSafeWorkspacePath("src/" + String.fromCharCode(0) + "bad.js")); });
test("rejeita snapshot com tipo, duplicata ou tamanho inválido", () => {
  assert.throws(() => validateProjectFiles([{ path: "a.js", content: 123 }]));
  assert.throws(() => validateProjectFiles([{ path: "src/a.js", content: "" }, { path: "SRC/A.JS", content: "" }]));
  assert.throws(() => validateProjectFiles([{ path: "large.js", content: "x".repeat(120001) }]));
  assert.throws(() => validateProjectFiles(Array.from({ length: 81 }, (_, i) => ({ path: "src/" + i + ".js", content: "" }))));
});
test("aceita criação e atualização", () => {
  const plan = parseWorkspacePlan(JSON.stringify({ summary: "Adicionar física", operations: [
    { path: "src/physics.js", action: "create", reason: "Separar a física" },
    { path: "src/main.js", action: "update", reason: "Integrar a física" }
  ] }), files);
  assert.equal(plan.summary, "Adicionar física");
  assert.deepEqual(plan.operations.map(item => item.action), ["create", "update"]);
});
test("aceita exclusão apenas de arquivo existente", () => {
  const plan = parseWorkspacePlan(JSON.stringify({ summary: "Remover arquivo", operations: [{ path: "src/main.js", action: "delete", reason: "Obsoleto" }] }), files);
  assert.equal(plan.operations[0].action, "delete");
});
test("aceita manifesto sem alterações", () => {
  assert.deepEqual(parseWorkspacePlan(JSON.stringify({ summary: "Sem mudanças", operations: [] }), files).operations, []);
});
test("extrai manifesto JSON de texto introdutório e texto final", () => {
  const json = JSON.stringify({ summary: "Quadrado arrastável", operations: [
    { path: "src/main.js", action: "update", reason: "Implementar interação por toque" }
  ] });
  const plan = parseWorkspacePlan("Plano solicitado:\n" + json + "\nConcluído.", files);
  assert.equal(plan.summary, "Quadrado arrastável");
  assert.equal(plan.operations[0].path, "src/main.js");
});
test("extrai manifesto JSON de cerca Markdown mesmo com espaços", () => {
  const fence = String.fromCharCode(96).repeat(3);
  const json = JSON.stringify({ summary: "Plano", operations: [] });
  assert.equal(parseWorkspacePlan("  " + fence + "json\n" + json + "\n" + fence + "  ", files).summary, "Plano");
});
test("rejeita JSON inválido, arrays e campos obrigatórios ausentes", () => {
  assert.throws(() => parseWorkspacePlan("{", files));
  assert.throws(() => parseWorkspacePlan("[]", files));
  assert.throws(() => parseWorkspacePlan(JSON.stringify({ summary: "x" }), files));
  assert.throws(() => parseWorkspacePlan(JSON.stringify({ summary: "", operations: [] }), files));
});
test("rejeita ação desconhecida, duplicatas e arquivo ausente", () => {
  const invalid = [
    [{ path: "src/a.js", action: "replace", reason: "x" }],
    [{ path: "src/new.js", action: "create", reason: "x" }, { path: "SRC/NEW.JS", action: "create", reason: "x" }],
    [{ path: "src/missing.js", action: "update", reason: "x" }],
    [{ path: "src/missing.js", action: "delete", reason: "x" }],
    [{ path: "index.html", action: "create", reason: "x" }],
    [{ path: "src/main.js", action: "update", reason: "" }]
  ];
  for (const operations of invalid) assert.throws(() => parseWorkspacePlan(JSON.stringify({ summary: "Teste", operations }), files));
});
test("aceita até doze operações em uma edição de projeto", () => {
  const operations = Array.from({ length: 12 }, (_, i) => ({ path: "new-" + i + ".js", action: "create", reason: "teste" }));
  assert.equal(parseWorkspacePlan(JSON.stringify({ summary: "Projeto amplo", operations }), files).operations.length, 12);
});
test("rejeita manifesto acima de doze operações", () => {
  const operations = Array.from({ length: 13 }, (_, i) => ({ path: "new-" + i + ".js", action: "create", reason: "teste" }));
  assert.throws(() => parseWorkspacePlan(JSON.stringify({ summary: "Muitas", operations }), files));
});
test("aceita cerca Markdown completa e rejeita cerca truncada", () => {
  const fence = String.fromCharCode(96).repeat(3);
  const json = JSON.stringify({ summary: "Plano", operations: [] });
  assert.equal(parseWorkspacePlan(fence + "json\n" + json + "\n" + fence, files).summary, "Plano");
  assert.throws(() => parseWorkspacePlan(fence + "json\n" + json, files));
});
