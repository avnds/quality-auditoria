import { strict as assert } from "node:assert";
import { criarDescritorSessaoExportacao } from "../src/lib/desktop/sessao-exportacao";
import type { ManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";
import { prepararSnapshotManifestoExportacao } from "../src/lib/desktop/snapshot-manifesto-exportacao";
import {
    serializarSnapshotManifesto,
    desserializarSnapshotManifesto,
} from "../src/lib/desktop/serializacao-snapshot-manifesto";

const agora = new Date("2026-11-12T12:00:00.000Z");
const manifesto: ManifestoImportacaoDesktop = {
    formato: "quality-desktop-import-manifest",
    versao: 1,
    modalidade: "producao_direta",
    origem: "production",
    criadoEm: agora.toISOString(),
    inventario: {
        arquivos: [{
            tipo: "relatorio",
            registroId: "relatorio-1",
            destinoRelativo: "relatorios/relatorio-1",
            referenciaSha256: "a".repeat(64),
        }],
        totalEvidencias: 0,
        totalRelatorios: 1,
    },
    totalArquivos: 1,
};

const descritor = criarDescritorSessaoExportacao(manifesto, agora);
const snapshot = prepararSnapshotManifestoExportacao(descritor, manifesto);
const envelope = serializarSnapshotManifesto(descritor, snapshot);
assert.deepEqual(desserializarSnapshotManifesto(descritor, envelope), snapshot);
console.log("OK: serialização e recuperação preservam o snapshot.");

const adulterado = { ...envelope, conteudoJson: envelope.conteudoJson.replace("relatorio-1", "relatorio-2") };
assert.throws(() => desserializarSnapshotManifesto(descritor, adulterado));
console.log("OK: alteração do JSON sem atualizar o hash é rejeitada.");

const hashAdulterado = { ...envelope, conteudoSha256: "f".repeat(64) };
assert.throws(() => desserializarSnapshotManifesto(descritor, hashAdulterado));
console.log("OK: hash adulterado é rejeitado.");

const sessaoTrocada = { ...envelope, sessaoId: "123e4567-e89b-42d3-a456-426614174999" };
assert.throws(() => desserializarSnapshotManifesto(descritor, sessaoTrocada));
console.log("OK: envelope vinculado a outra sessão é rejeitado.");

const outroDescritor = criarDescritorSessaoExportacao(manifesto, agora);
assert.throws(() => desserializarSnapshotManifesto(outroDescritor, envelope));
console.log("OK: recuperação com descritor de outra sessão é rejeitada.");

const invalido = { ...envelope, conteudoJson: "{" };
assert.throws(() => desserializarSnapshotManifesto(descritor, invalido));
console.log("OK: JSON inválido é rejeitado.");

const manifestoModificado = structuredClone(manifesto);
manifestoModificado.totalArquivos = 2;
assert.throws(() => serializarSnapshotManifesto(descritor, prepararSnapshotManifestoExportacao(
    criarDescritorSessaoExportacao(manifestoModificado, agora), manifestoModificado
)));
console.log("OK: snapshot incompatível não pode ser serializado.");

console.log("OK: testes locais sem banco, rede ou Blob.");
