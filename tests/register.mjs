// Permite importar módulos de app/lib (que usan imports sin extensión, al
// estilo de Next) desde node:test.
import { register } from "node:module";
register("./resolve-ext.mjs", import.meta.url);
