import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { conferirReferenciaSnapshot } from "../src/lib/desktop/conferir-referencia-snapshot";

const uriOriginal = "https://exemplo.invalid/arquivo-original";
const referencia = createHash("sha256").update(uriOriginal, "utf8").digest("hex");

assert.equal(conferirReferenciaSnapshot(uriOriginal, referencia), true);
console.log("OK: referência original aceita.");

assert.equal(conferirReferenciaSnapshot("https://exemplo.invalid/arquivo-substituido", referencia), false);
console.log("OK: referência alterada rejeitada.");

assert.equal(conferirReferenciaSnapshot(uriOriginal, "abc"), false);
assert.equal(conferirReferenciaSnapshot(uriOriginal, referencia.toUpperCase()), false);
assert.equal(conferirReferenciaSnapshot(uriOriginal, "g".repeat(64)), false);
console.log("OK: hashes malformados rejeitados.");

assert.equal(conferirReferenciaSnapshot(uriOriginal, "0".repeat(64)), false);
console.log("OK: hash incorreto rejeitado.");

console.log("OK: teste local sem rede, Turso ou Vercel Blob.");
