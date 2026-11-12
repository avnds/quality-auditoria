import { strict as assert } from "node:assert";
import { conferirIntegridadeEsperada } from "../src/lib/desktop/conferir-integridade-esperada";
import type { PlanoTransferencia } from "../src/lib/desktop/plano-transferencia";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

const plano: PlanoTransferencia = {
    versao: 1,
    arquivos: [
        {
            tipo: "evidencia",
            registroId: "ev-1",
            urlOriginal: "https://exemplo.invalid/ev-1",
            destinoRelativo: "evidencias/ev-1",
            estado: "validado",
            tamanhoBytes: 100,
            sha256: hashA,
        },
        {
            tipo: "relatorio",
            registroId: "rel-1",
            urlOriginal: "https://exemplo.invalid/rel-1",
            destinoRelativo: "relatorios/rel-1",
            estado: "validado",
            tamanhoBytes: 200,
            sha256: hashB,
        },
    ],
};

const esperados = [
    { tipo: "evidencia" as const, registroId: "ev-1", tamanhoBytes: 100, sha256: hashA },
    { tipo: "relatorio" as const, registroId: "rel-1", tamanhoBytes: 200, sha256: hashB },
];

assert.equal(conferirIntegridadeEsperada(plano, esperados), true);
console.log("OK: arquivos corretos aceitos.");

assert.equal(conferirIntegridadeEsperada(plano, [{ ...esperados[0], tamanhoBytes: 101 }, esperados[1]]), false);
console.log("OK: tamanho divergente rejeitado.");

assert.equal(conferirIntegridadeEsperada(plano, [{ ...esperados[0], sha256: hashB }, esperados[1]]), false);
console.log("OK: SHA-256 divergente rejeitado.");

assert.equal(conferirIntegridadeEsperada(plano, [esperados[0], esperados[0]]), false);
console.log("OK: registros esperados duplicados rejeitados.");

assert.equal(conferirIntegridadeEsperada(plano, [esperados[0]]), false);
console.log("OK: arquivo esperado ausente rejeitado.");

assert.equal(conferirIntegridadeEsperada({ ...plano, arquivos: [plano.arquivos[0], plano.arquivos[0]] }, esperados), false);
console.log("OK: arquivos transferidos duplicados rejeitados.");

assert.equal(conferirIntegridadeEsperada({
    ...plano,
    arquivos: [{ ...plano.arquivos[0], estado: "baixando" }, plano.arquivos[1]],
}, esperados), false);
console.log("OK: arquivo ainda baixando rejeitado.");

assert.equal(conferirIntegridadeEsperada(plano, [{ ...esperados[0], sha256: "invalido" }, esperados[1]]), false);
console.log("OK: hash esperado malformado rejeitado.");

console.log("OK: testes locais sem acesso à rede, Turso ou Vercel Blob.");
