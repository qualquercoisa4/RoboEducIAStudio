import ts from "typescript";

export type InlineScriptDiagnostic = {
  scriptIndex: number;
  line: number;
  column: number;
  message: string;
};

const JAVASCRIPT_MIME_TYPES = new Set([
  "application/ecmascript", "application/javascript", "application/x-ecmascript",
  "application/x-javascript", "text/ecmascript", "text/javascript",
  "text/javascript1.0", "text/javascript1.1", "text/javascript1.2",
  "text/javascript1.3", "text/javascript1.4", "text/javascript1.5",
  "text/jscript", "text/livescript"
]);

function isExecutableInlineScript(openingTag: string): boolean {
  if (/\bsrc\s*=/i.test(openingTag)) return false;
  const match = openingTag.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return true;
  const type = (match[1] ?? match[2] ?? match[3] ?? "").trim().toLowerCase();
  if (!type || type === "module") return true;
  return JAVASCRIPT_MIME_TYPES.has(type.split(";")[0].trim());
}

/** Validate only executable inline JS; import maps and embedded data are not JavaScript. */
export function getInlineJavaScriptDiagnostics(html: string): InlineScriptDiagnostic[] {
  const diagnostics: InlineScriptDiagnostic[] = [];
  const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  let scriptIndex = 0;
  while ((match = scripts.exec(html)) !== null) {
    scriptIndex += 1;
    const openingTag = match[1] ?? "";
    const source = match[2] ?? "";
    if (!source.trim() || !isExecutableInlineScript(openingTag)) continue;
    const result = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: { allowJs: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
    });
    for (const diagnostic of result.diagnostics ?? []) {
      if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
      const position = diagnostic.start ?? 0;
      const before = source.slice(0, position);
      diagnostics.push({
        scriptIndex,
        line: before.split("\n").length,
        column: position - before.lastIndexOf("\n"),
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")
      });
    }
  }
  return diagnostics;
}
