export type WorkspaceFileSnapshot = { path: string; content: string };

export type WorkspaceOperation = {
  path: string;
  action: "create" | "update" | "delete";
  reason: string;
};

export type WorkspacePlan = {
  summary: string;
  operations: WorkspaceOperation[];
};

export const MAX_WORKSPACE_FILES = 80;
export const MAX_WORKSPACE_FILE_CHARS = 120_000;
export const MAX_WORKSPACE_TOTAL_CHARS = 160_000;
export const MAX_PATCH_OPERATIONS = 4;

const BLOCKED_SEGMENTS = new Set([".git", ".next", ".vercel", ".turbo", "node_modules", "coverage"]);

export function assertSafeWorkspacePath(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 240 || value.trim() !== value) {
    throw new Error("O manifesto contém um caminho de arquivo vazio, excessivo ou inválido.");
  }
  if (value.startsWith("/") || value.includes("\\") || value.includes(":") || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Caminho de arquivo não permitido: " + value);
  }
  const segments = value.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === ".." || BLOCKED_SEGMENTS.has(segment.toLowerCase()))) {
    throw new Error("Caminho de arquivo não permitido: " + value);
  }
  const filename = segments[segments.length - 1].toLowerCase();
  if (filename === ".env" || filename.startsWith(".env.")) {
    throw new Error("A IA não pode criar, modificar ou excluir arquivos de segredos (.env).");
  }
}

export function validateProjectFiles(input: unknown): WorkspaceFileSnapshot[] {
  if (!Array.isArray(input) || input.length > MAX_WORKSPACE_FILES) {
    throw new Error("O projeto pode conter até " + MAX_WORKSPACE_FILES + " arquivos para edição.");
  }

  let totalChars = 0;
  const seen = new Set<string>();
  const files: WorkspaceFileSnapshot[] = [];

  for (const entry of input) {
    if (!entry || typeof entry !== "object") throw new Error("O snapshot do projeto contém um arquivo inválido.");
    const item = entry as { path?: unknown; content?: unknown };
    assertSafeWorkspacePath(item.path);
    if (typeof item.content !== "string" || item.content.length > MAX_WORKSPACE_FILE_CHARS) {
      throw new Error("Conteúdo inválido ou excessivamente grande em " + item.path + ".");
    }
    const key = item.path.toLowerCase();
    if (seen.has(key)) throw new Error("O snapshot contém caminhos duplicados: " + item.path);
    seen.add(key);
    totalChars += item.content.length;
    if (totalChars > MAX_WORKSPACE_TOTAL_CHARS) {
      throw new Error("O projeto excede o limite de contexto de 160.000 caracteres. Reduza os arquivos incluídos antes de editar.");
    }
    files.push({ path: item.path, content: item.content });
  }

  return files;
}

function extractWorkspaceJson(raw: string): string {
  const value = raw.trim();
  const fence = String.fromCharCode(96).repeat(3);
  const fenced = value.match(/^\x60{3}(?:json)?\s*([\s\S]*?)\s*\x60{3}$/i);
  if (fenced) return fenced[1].trim();

  // Accept a JSON object surrounded by harmless prose, while scanning braces
  // safely so braces inside strings do not terminate the object early.
  const start = value.indexOf("{");
  if (start < 0) return value;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }
  return value;
}

export function parseWorkspacePlan(raw: string, files: WorkspaceFileSnapshot[]): WorkspacePlan {
  const serialized = extractWorkspaceJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("A IA não retornou um manifesto JSON válido. Nenhum arquivo foi alterado.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("O manifesto da IA precisa ser um objeto JSON.");
  }

  const value = parsed as { summary?: unknown; operations?: unknown };
  if (typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > 2_000 || !Array.isArray(value.operations)) {
    throw new Error("O manifesto precisa conter summary e operations válidos.");
  }
  if (value.operations.length > MAX_PATCH_OPERATIONS) {
    throw new Error("A IA planejou mais de " + MAX_PATCH_OPERATIONS + " operações. Divida a solicitação em etapas menores.");
  }

  const existing = new Map(files.map(file => [file.path.toLowerCase(), file.path]));
  const seen = new Set<string>();
  const operations: WorkspaceOperation[] = [];

  for (const entry of value.operations) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("O manifesto contém uma operação em formato inválido.");
    }
    const operation = entry as { path?: unknown; action?: unknown; reason?: unknown };
    assertSafeWorkspacePath(operation.path);
    if (operation.action !== "create" && operation.action !== "update" && operation.action !== "delete") {
      throw new Error("A operação de " + operation.path + " precisa ser create, update ou delete.");
    }
    if (typeof operation.reason !== "string" || !operation.reason.trim() || operation.reason.length > 500) {
      throw new Error("A operação de " + operation.path + " não possui uma justificativa válida.");
    }
    const key = operation.path.toLowerCase();
    if (seen.has(key)) throw new Error("O manifesto repete o caminho " + operation.path + ".");
    seen.add(key);

    const existingPath = existing.get(key);
    const exists = existingPath !== undefined;
    if (operation.action === "create" && exists) {
      throw new Error("A IA tentou criar um arquivo que já existe: " + operation.path + ".");
    }
    if ((operation.action === "update" || operation.action === "delete") && !exists) {
      throw new Error("A IA tentou modificar ou excluir um arquivo inexistente: " + operation.path + ".");
    }
    if ((operation.action === "update" || operation.action === "delete") && existingPath !== operation.path) {
      throw new Error("Use a capitalização exata do caminho existente: " + existingPath + ".");
    }
    operations.push({ path: operation.path, action: operation.action, reason: operation.reason });
  }

  return { summary: value.summary.trim(), operations };
}
