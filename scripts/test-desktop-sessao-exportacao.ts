import { strict as assert } from "node:assert";
import {
    criarDescritorSessaoExportacao,
    validarDescritorSessaoExportacao,
} from "../src/lib/desktop/sessao-exportacao";
import type { ManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";

const agora = new Date("2026-11-12T12:00:00.000Z");
const manifesto: ManifestoImportacaoDesktop = {
    formato: "quality-desktop-import-manifest",
    versao: 1,
    modalidade: "producao_direta",
    origem: "production",
    criadoEm: agora.toISOString(),
    inventario: { arquivos: [], totalEvidencias: 0, totalRelatorios: 0 },
    totalArquivos: 0,
};

const sessao = criarDescritorSessaoExportacao(manifesto, agora, 30);
assert.equal(validarDescritorSessaoExportacao(sessao, manifesto, new Date(agora.getTime() + 1000)), true);
console.log("OK: sessão válida e vinculada ao manifesto.");

const modificado: ManifestoImportacaoDesktop = { ...manifesto, totalArquivos: 1 };
assert.equal(validarDescritorSessaoExportacao(sessao, modificado, new Date(agora.getTime() + 1000)), false);
console.log("OK: manifesto modificado rejeitado.");

assert.equal(validarDescritorSessaoExportacao(sessao, manifesto, new Date(agora.getTime() + 30 * 60_000)), false);
console.log("OK: sessão expirada rejeitada.");

assert.equal(validarDescritorSessaoExportacao(sessao, manifesto, new Date(agora.getTime() - 1000)), false);
console.log("OK: sessão ainda não iniciada rejeitada.");

assert.throws(() => criarDescritorSessaoExportacao(manifesto, agora, 120));
console.log("OK: duração fora do limite rejeitada.");

const outra = criarDescritorSessaoExportacao(manifesto, agora, 30);
assert.notEqual(sessao.sessaoId, outra.sessaoId);
console.log("OK: exportações recebem identificadores distintos.");
console.log("OK: testes locais sem rede, Turso ou Vercel Blob.");
