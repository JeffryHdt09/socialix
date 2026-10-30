// Charge du code TypeScript du projet depuis un script Node, sans serveur ni compilation préalable : chaque fichier est transpilé
// à la volée (alias « @/ » et imports relatifs compris, « server-only » neutralisé). C'est le VRAI code qui est testé.
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";

import ts from "typescript";

export function createLoader(root) {
  const cache = new Map();

  function resolveSource(base) {
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) if (fs.existsSync(candidate)) return candidate;
    throw new Error(`Module introuvable : ${base}`);
  }

  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const m = new Module(file);
    m.paths = Module._nodeModulePaths(path.dirname(file));
    m.require = (req) => {
      if (req === "server-only") return {};
      if (req.startsWith("@/")) return load(resolveSource(path.join(root, "src", req.slice(2))));
      if (req.startsWith(".")) return load(resolveSource(path.resolve(path.dirname(file), req)));
      return Module.prototype.require.call(m, req);
    };
    cache.set(file, m);
    m._compile(js, file);
    return m.exports;
  }

  return (relativePath) => load(path.join(root, relativePath));
}
