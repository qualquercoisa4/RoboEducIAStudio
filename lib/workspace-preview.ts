export type WorkspacePreviewFile = { path: string; content: string };

function readAttribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp("\\b" + escaped + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function normalizeVirtualPath(reference: string, basePath = "index.html"): string | null {
  const value = reference.trim();
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return null;

  let decoded = value.split(/[?#]/, 1)[0];
  try { decoded = decodeURIComponent(decoded); } catch { /* preserve the literal path */ }
  const base = value.startsWith("/") ? [] : basePath.split("/").slice(0, -1);
  const segments = [...base, ...decoded.replace(/^\/+/, "").split("/")];
  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!normalized.length) return null;
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }
  return normalized.join("/");
}

function escapeInlineScript(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

function escapeInlineStyle(source: string): string {
  return source.replace(/<\/style/gi, "<\\/style");
}

function makeDiagnosticsBridge(): string {
  return `<script>
(() => {
  const send = (type, message) => {
    try {
      parent.postMessage({ __roboeducWorkspacePreview: true, type, message: String(message ?? "") }, "*");
    } catch {}
  };
  window.addEventListener("error", (event) => {
    const target = event.target;
    const resource = target && (target.src || target.href);
    send("error", resource
      ? "Falha ao carregar recurso: " + resource
      : (event.message || "Erro JavaScript") + (event.lineno ? " — linha " + event.lineno : ""));
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    send("error", reason && (reason.stack || reason.message) || reason || "Promise rejeitada");
  });
  const originalError = console.error.bind(console);
  console.error = (...args) => {
    send("error", args.map(value => typeof value === "string" ? value : (() => {
      try { return JSON.stringify(value); } catch { return String(value); }
    })()).join(" "));
    originalError(...args);
  };
  window.addEventListener("load", () => send("ready", "Prévia carregada"));
})();
</script>`;
}

/**
 * Builds an isolated HTML document from the workspace's virtual file system.
 * Local CSS and classic JavaScript files referenced by index.html are embedded,
 * so the preview does not try to fetch nonexistent /workspace/src/... URLs.
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
    return `<style data-roboeduc-file="${file.path}"${media ? ` media="${media.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"` : ""}>\n${escapeInlineStyle(file.content)}\n</style>`;
  });

  document = document.replace(/<script\\b[^>]*\\bsrc\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)[^>]*>\\s*<\\/script\\s*>/gi, tag => {
    const src = readAttribute(tag, "src");
    if (!src) return tag;
    const path = normalizeVirtualPath(src);
    const file = path ? byPath.get(path.toLowerCase()) : undefined;
    if (!file || !/\\.(?:m?js|cjs)$/i.test(file.path)) return tag;

    const openingTag = tag.match(/^<script\\b([^>]*)>/i)?.[1] ?? "";
    const attributes = openingTag
      .replace(/\\s+src\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/i, "")
      .replace(/\\s+(?:integrity|crossorigin|referrerpolicy|async|defer)\\b(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?/gi, "");
    return `<script${attributes} data-roboeduc-file="${file.path}">\n${escapeInlineScript(file.content)}\n</script>`;
  });

  const bridge = makeDiagnosticsBridge();
  if (/<head\\b[^>]*>/i.test(document)) {
    document = document.replace(/<head\\b[^>]*>/i, match => match + bridge);
  } else if (/<html\\b[^>]*>/i.test(document)) {
    document = document.replace(/<html\\b[^>]*>/i, match => match + "<head>" + bridge + "</head>");
  } else {
    document = "<!doctype html><html lang=\"pt-BR\"><head>" + bridge + "</head><body>" + document + "</body></html>";
  }
  return document;
}
