import { strict as assert } from "node:assert";
import { criarDescritorSessaoExportacao } from "../src/lib/desktop/sessao-exportacao";
import type { ManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";
import {
    prepararSnapshotManifestoExportacao,
    conferirManifestoSessao,
    conferirSnapshotManifestoExportacao,
} from "../src/lib/desktop/snapshot-manifesto-exportacao";

const agora = new Date("2026-11-12T12:00:00.000Z");
const manifesto: ManifestoImportacaoDesktop = {
    formato: "quality-desktop-import-manifest",
    versao: 1,
    modalidade: "producao_direta",
    origem: "production",
    criadoEm: agora.toISOString(),
    inventario: {
        arquivos: [{
            tipo: "evidencia",
            registroId: "arquivo-1",
            destinoRelativo: "evidencias/arquivo-1",
            referenciaSha256: "a".repeat(64),
        }],
        totalEvidencias: 1,
        totalRelatorios: 0,
    },
    totalArquivos: 1,
};

const descritor = criarDescritorSessaoExportacao(manifesto, agora);
const snapshot = prepararSnapshotManifestoExportacao(descritor, manifesto);
assert.equal(conferirManifestoSessao(descritor, manifesto), true);
assert.equal(conferirSnapshotManifestoExportacao(descritor, snapshot), true);
console.log("OK: snapshot íntegro corresponde à sessão.");

manifesto.inventario.arquivos[0].referenciaSha256 = "b".repeat(64);
assert.equal(conferirSnapshotManifestoExportacao(descritor, snapshot), true);
assert.equal(conferirManifestoSessao(descritor, manifesto), false);
console.log("OK: snapshot não acompanha mutação posterior do manifesto original.");

const adulterado = structuredClone(snapshot);
adulterado.manifesto.inventario.arquivos[0].referenciaSha256 = "c".repeat(64);
assert.equal(conferirSnapshotManifestoExportacao(descritor, adulterado), false);
console.log("OK: alteração de referência de arquivo detectada.");

const trocado = { ...snapshot, sessaoId: "123e4567-e89b-42d3-a456-426614174999" };
assert.equal(conferirSnapshotManifestoExportacao(descritor, trocado), false);
console.log("OK: troca de identificador de sessão rejeitada.");

const outroDescritor = criarDescritorSessaoExportacao(snapshot.manifesto, agora);
assert.equal(conferirSnapshotManifestoExportacao(outroDescritor, snapshot), false);
console.log("OK: snapshot não pode ser reutilizado em outra sessão.");

const totalAlterado = structuredClone(snapshot);
totalAlterado.manifesto.totalArquivos = 2;
assert.equal(conferirSnapshotManifestoExportacao(descritor, totalAlterado), false);
console.log("OK: alteração de contagem detectada.");
console.log("OK: testes locais sem banco, rede ou Blob.");
