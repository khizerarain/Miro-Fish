/**
 * tsx preload that neutralises the `server-only` guard.
 *
 * `server-only` deliberately throws when imported outside a React Server Component bundle. Node
 * scripts (verification, migrations) legitimately need the same modules, so this hook resolves
 * the package to an empty stub file instead.
 *
 * Usage: npx tsx --import ./scripts/no-server-only.mjs scripts/verify-github.ts
 */
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const STUB = new URL("./empty-module.mjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only" || specifier === "client-only") {
      return { url: STUB, shortCircuit: true, format: "module" };
    }
    return nextResolve(specifier, context);
  },
});

void fileURLToPath;
void path;
