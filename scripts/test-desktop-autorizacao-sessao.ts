import { strict as assert } from "node:assert";
import { criarDescritorSessaoExportacao } from "../src/lib/desktop/sessao-exportacao";
import { vincularSessaoExportacao, autorizarSessaoExportacao } from "../src/lib/desktop/autorizacao-sessao-exportacao";
import type { ManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";

const agora = new Date("2026-11-12T12:00:00Z");
const manifesto: ManifestoImportacaoDesktop = {
    formato: "quality-desktop-import-manifest",
    versao: 1,
    modalidade: "producao_direta",
    origem: "production",
    criadoEm: agora.toISOString(),
    inventario: { arquivos: [], totalEvidencias: 0, totalRelatorios: 0 },
    totalArquivos: 0,
};
const descritor = criarDescritorSessaoExportacao(manifesto, agora);
const usuario = { id: "usuario-1", perfil: "SUPERVISORA" };
const registro = vincularSessaoExportacao(descritor, manifesto, usuario, agora);
const durante = new Date(agora.getTime() + 1000);

assert.equal(autorizarSessaoExportacao(registro, manifesto, usuario, durante), true);
console.log("OK: usuário responsável autorizado.");

assert.equal(autorizarSessaoExportacao(registro, manifesto, { id: "usuario-2", perfil: "MASTER" }, durante), false);
console.log("OK: outro usuário autorizado por perfil não reutiliza a sessão.");

assert.equal(autorizarSessaoExportacao(registro, manifesto, { id: usuario.id, perfil: "CONSULTOR" }, durante), false);
console.log("OK: perda de permissão rejeitada.");

assert.equal(autorizarSessaoExportacao(registro, manifesto, null, durante), false);
console.log("OK: usuário não autenticado rejeitado.");

assert.equal(autorizarSessaoExportacao(registro, { ...manifesto, totalArquivos: 1 }, usuario, durante), false);
console.log("OK: manifesto alterado rejeitado.");

assert.equal(autorizarSessaoExportacao(registro, manifesto, usuario, new Date(agora.getTime() + 30 * 60_000)), false);
console.log("OK: sessão expirada rejeitada.");

assert.throws(() => vincularSessaoExportacao(descritor, manifesto, { id: "consultor", perfil: "CONSULTOR" }, agora));
console.log("OK: CONSULTOR não pode iniciar sessão.");

console.log("OK: testes locais sem rede, Turso ou Blob.");
