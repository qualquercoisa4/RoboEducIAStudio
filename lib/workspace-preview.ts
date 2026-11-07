export type WorkspacePreviewFile = { path: string; content: string };

function readAttribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp("\\b" + escaped + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function normalizeVirtualPath(reference: string, basePath = "index.html"): string | null {
  const value = reference.trim();
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\\/\\/|#)/i.test(value)) return null;
  let decoded = value.split(/[?#]/, 1)[0];
  try { decoded = decodeURIComponent(decoded); } catch { /* preserve literal path */ }
  const base = value.startsWith("/") ? [] : basePath.split("/").slice(0, -1);
  const normalized: string[] = [];
  for (const segment of [...base, ...decoded.replace(/^\\/+/, "").split("/")]) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!normalized.length) return null;
      normalized.pop();
    } else normalized.push(segment);
  }
  return normalized.join("/");
}

function escapeInlineScript(source: string): string {
  return source.replace(/<\\/script/gi, "<\\\\/script");
}

function escapeInlineStyle(source: string): string {
  return source.replace(/<\\/style/gi, "<\\\\/style");
}

function dataModule(source: string): string {
  return "data:text/javascript;charset=utf-8," + encodeURIComponent(source);
}

function moduleUrl(path: string): string {
  return "https://roboeduc.local/" + path.split("/").map(encodeURIComponent).join("/");
}

function findModulePath(reference: string, importer: string, files: Map<string, WorkspacePreviewFile>): string | null {
  const normalized = normalizeVirtualPath(reference, importer);
  if (!normalized) return null;
  const candidates = /\\.(?:m?js|cjs)$/i.test(normalized)
    ? [normalized]
    : [normalized, normalized + ".js", normalized + ".mjs", normalized + "/index.js"];
  for (const candidate of candidates) {
    const file = files.get(candidate.toLowerCase());
    if (file && /\\.(?:m?js)$/i.test(file.path)) return file.path;
  }
  return null;
}

function rewriteModuleImports(source: string, importer: string, files: Map<string, WorkspacePreviewFile>, unresolved: Set<string>): string {
  return source.replace(/((?:\\bfrom\\s*|\\bimport\\s*\\(\\s*|^\\s*import\\s*)["'])([^"']+)(["'])/gm,
    (whole, before: string, specifier: string, after: string) => {
      if (/^(?:[a-z][a-z0-9+.-]*:|\\/\\/|#)/i.test(specifier)) return whole;
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const target = findModulePath(specifier, importer, files);
        if (target) return before + moduleUrl(target) + after;
        const missing = normalizeVirtualPath(specifier, importer);
        if (missing) unresolved.add(missing);
        return before + (missing ? moduleUrl(missing) : specifier) + after;
      }
      if (specifier !== "three" && !specifier.startsWith("three/addons/")) unresolved.add(specifier);
      return whole;
    });
}

function makeImportMap(files: WorkspacePreviewFile[], originalHtml: string): string {
  const byPath = new Map(files.map(file => [file.path.toLowerCase(), file]));
  const unresolved = new Set<string>();
  const imports: Record<string, string> = {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  };
  const modules = files.filter(file => /\\.(?:m?js)$/i.test(file.path));
  for (const file of modules) {
    const rewritten = rewriteModuleImports(file.content, file.path, byPath, unresolved);
    imports[moduleUrl(file.path)] = dataModule(rewritten);
  }
  for (const missing of unresolved) {
    const message = missing.startsWith("https://") ? "Módulo local não encontrado: " + missing : "Dependência não disponível no preview: " + missing + ". Use uma URL CDN compatível ou adicione o mapeamento da biblioteca.";
    imports[moduleUrl(missing)] = dataModule("throw new Error(" + JSON.stringify(message) + ");");
    if (!missing.startsWith("https://") && !(missing in imports)) {
      imports[missing] = dataModule("throw new Error(" + JSON.stringify(message) + ");");
    }
  }
  const existing = originalHtml.match(/<script\\b[^>]*type\\s*=\\s*["']importmap["'][^>]*>([\\s\\S]*?)<\\/script\\s*>/i);
  if (existing) {
    try {
      const parsed = JSON.parse(existing[1]) as { imports?: Record<string, string>; scopes?: Record<string, Record<string, string>> };
      Object.assign(imports, parsed.imports ?? {});
    } catch { /* the browser will report malformed author-provided import maps */ }
  }
  const json = JSON.stringify({ imports }).replace(/</g, "\\u003c");
  return '<script type="importmap">' + json + "</script>";
}

function makeDiagnosticsBridge(): string {
  return `<script>
(() => {
  const send = (type, message) => {
    try { parent.postMessage({ __roboeducWorkspacePreview: true, type, message: String(message ?? "") }, "*"); } catch {}
  };
  window.addEventListener("error", (event) => {
    const target = event.target;
    const resource = target && (target.src || target.href);
    const location = event.filename ? " — " + event.filename + (event.lineno ? ":" + event.lineno : "") + (event.colno ? ":" + event.colno : "") : "";
    send("error", resource ? "Falha ao carregar recurso: " + resource : (event.message || "Erro JavaScript") + location);
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    send("error", reason && (reason.stack || reason.message) || reason || "Promise rejeitada");
  });
  const originalError = console.error.bind(console);
  console.error = (...args) => {
    send("error", args.map(value => typeof value === "string" ? value : (() => { try { return JSON.stringify(value); } catch { return String(value); } })()).join(" "));
    originalError(...args);
  };
  window.addEventListener("load", () => send("ready", "Prévia carregada"));
})();
</script>`;
}

/**
 * Builds an isolated HTML document from the workspace virtual file system.
 * Local CSS/classic scripts are embedded. ES modules are exposed through an
 * import map, including local relative imports and common Three.js imports.
 */
export function buildWorkspacePreview(html: string, files: WorkspacePreviewFile[]): string {
  const byPath = new Map(files.map(file => [file.path.toLowerCase(), file]));
  let document = html;

  document = document.replace(/<link\\b[^>]*>/gi, tag => {
    const href = readAttribute(tag, "href");
    if (!href) return tag;
    const path = normalizeVirtualPath(href);
    const file = path ? byPath.get(path.toLowerCase()) : undefined;
    if (!file || !/\\.css$/i.test(file.path)) return tag;
    const media = readAttribute(tag, "media");
    return `<style data-roboeduc-file="${file.path}"${media ? ` media="${media.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"` : ""}>\\n${escapeInlineStyle(file.content)}\\n</style>`;
  });

  document = document.replace(/<script\\b[^>]*\\bsrc\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)[^>]*>\\s*<\\/script\\s*>/gi, tag => {
    const src = readAttribute(tag, "src");
    if (!src) return tag;
    const path = normalizeVirtualPath(src);
    const file = path ? byPath.get(path.toLowerCase()) : undefined;
    if (!file || !/\\.(?:m?js|cjs)$/i.test(file.path)) return tag;
    const openingTag = tag.match(/^<script\\b([^>]*)>/i)?.[1] ?? "";
    const isModule = /\\btype\\s*=\\s*(?:"module"|'module'|module)/i.test(openingTag);
    const attributes = openingTag
      .replace(/\\s+src\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/i, "")
      .replace(/\\s+(?:integrity|crossorigin|referrerpolicy|async|defer)\\b(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?/gi, "");
    const code = isModule ? rewriteModuleImports(file.content, file.path, byPath, new Set()) : file.content;
    return `<script${attributes} data-roboeduc-file="${file.path}">\\n${escapeInlineScript(code)}\\n</script>`;
  });

  const importMap = makeImportMap(files, html);
  if (/<head\\b[^>]*>/i.test(document)) {
    document = document.replace(/<head\\b[^>]*>/i, match => match + importMap + makeDiagnosticsBridge());
  } else if (/<html\\b[^>]*>/i.test(document)) {
    document = document.replace(/<html\\b[^>]*>/i, match => match + "<head>" + importMap + makeDiagnosticsBridge() + "</head>");
  } else {
    document = "<!doctype html><html lang=\"pt-BR\"><head>" + importMap + makeDiagnosticsBridge() + "</head><body>" + document + "</body></html>";
  }
  return document;
}
