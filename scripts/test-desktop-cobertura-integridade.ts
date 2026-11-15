import { strict as assert } from "node:assert";
import type { ManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";
import type { IntegridadeEsperada } from "../src/lib/desktop/conferir-integridade-esperada";
import {
    conferirCoberturaIntegridadeManifesto,
    conferirMedicoesIntegridade,
} from "../src/lib/desktop/conferir-cobertura-integridade";

const manifesto: ManifestoImportacaoDesktop = {
    formato: "quality-desktop-import-manifest",
    versao: 1,
    modalidade: "producao_direta",
    origem: "production",
    criadoEm: "2026-11-12T12:00:00.000Z",
    inventario: {
        arquivos: [
            { tipo: "evidencia", registroId: "ev-1", destinoRelativo: "evidencias/ev-1", referenciaSha256: "a".repeat(64) },
            { tipo: "relatorio", registroId: "rel-1", destinoRelativo: "relatorios/rel-1", referenciaSha256: "b".repeat(64) },
        ],
        totalEvidencias: 1,
        totalRelatorios: 1,
    },
    totalArquivos: 2,
};
const integridades: IntegridadeEsperada[] = [
    { tipo: "evidencia", registroId: "ev-1", tamanhoBytes: 5, sha256: "c".repeat(64) },
    { tipo: "relatorio", registroId: "rel-1", tamanhoBytes: 8, sha256: "d".repeat(64) },
];

assert.equal(conferirCoberturaIntegridadeManifesto(manifesto, integridades), true);
assert.equal(conferirMedicoesIntegridade(integridades, [...integridades].reverse()), true);
console.log("OK: cobertura completa e medições independentes fora de ordem.");

assert.equal(conferirCoberturaIntegridadeManifesto(manifesto, integridades.slice(0, 1)), false);
assert.equal(conferirCoberturaIntegridadeManifesto(manifesto, [integridades[0], integridades[0]]), false);
assert.equal(conferirCoberturaIntegridadeManifesto(manifesto, [
    integridades[0], { ...integridades[1], registroId: "outro" },
]), false);
console.log("OK: arquivo faltante, duplicado ou estranho rejeitado.");

assert.equal(conferirCoberturaIntegridadeManifesto({
    ...manifesto, inventario: { ...manifesto.inventario, totalEvidencias: 2 },
}, integridades), false);
assert.equal(conferirCoberturaIntegridadeManifesto({
    ...manifesto, inventario: { ...manifesto.inventario, arquivos: [manifesto.inventario.arquivos[0], manifesto.inventario.arquivos[0]] },
}, integridades), false);
console.log("OK: contagens incorretas e duplicidade no manifesto rejeitadas.");

assert.equal(conferirMedicoesIntegridade(integridades, [
    integridades[0], { ...integridades[1], sha256: "e".repeat(64) },
]), false);
assert.equal(conferirMedicoesIntegridade(integridades, [
    integridades[0], { ...integridades[1], tamanhoBytes: 9 },
]), false);
assert.equal(conferirMedicoesIntegridade(integridades, [integridades[0], integridades[0]]), false);
console.log("OK: hash, tamanho e medições duplicadas rejeitados.");

assert.equal(conferirCoberturaIntegridadeManifesto(manifesto, [
    integridades[0], { ...integridades[1], tamanhoBytes: 0 },
]), false);
console.log("OK: metadados de integridade inválidos rejeitados.");
console.log("OK: teste inteiramente local, sem Turso ou Blob.");
