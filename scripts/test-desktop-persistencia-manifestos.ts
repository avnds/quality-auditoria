import { strict as assert } from "node:assert";
import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQL_CRIAR_TABELA_SESSOES_EXPORTACAO } from "../src/lib/desktop/schema-sessoes-exportacao";
import {
    SQL_CRIAR_TABELA_MANIFESTOS_EXPORTACAO,
    guardarManifestoExportacao,
    recuperarManifestoExportacao,
} from "../src/lib/desktop/repositorio-manifestos-exportacao";
import { registrarSessaoExportacao, revogarSessaoExportacao } from "../src/lib/desktop/repositorio-sessoes-exportacao";
import { criarDescritorSessaoExportacao } from "../src/lib/desktop/sessao-exportacao";
import { prepararSnapshotManifestoExportacao } from "../src/lib/desktop/snapshot-manifesto-exportacao";
import type { ManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";

async function main() {
    const pasta = mkdtempSync(join(tmpdir(), "quality-manifestos-teste-"));
    const db = createClient({ url: `file:${join(pasta, "teste.sqlite")}` });
    try {
        await db.execute(SQL_CRIAR_TABELA_SESSOES_EXPORTACAO);
        await db.execute(SQL_CRIAR_TABELA_MANIFESTOS_EXPORTACAO);
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
        const descritor = criarDescritorSessaoExportacao(manifesto, agora);
        const registro = { descritor, usuarioId: "supervisora1", perfilNaCriacao: "SUPERVISORA" as const };
        const snapshot = prepararSnapshotManifestoExportacao(descritor, manifesto);
        await registrarSessaoExportacao(db, registro);
        await guardarManifestoExportacao(db, registro, snapshot, agora);
        assert.deepEqual(await recuperarManifestoExportacao(db, descritor.sessaoId, registro.usuarioId, agora), snapshot);
        console.log("OK: gravação e recuperação do manifesto.");

        assert.equal(await recuperarManifestoExportacao(db, descritor.sessaoId, "outro", agora), null);
        console.log("OK: isolamento por usuário.");

        assert.equal(await recuperarManifestoExportacao(db, descritor.sessaoId, registro.usuarioId, new Date(agora.getTime() + 30 * 60_000)), null);
        console.log("OK: expiração.");

        await assert.rejects(() => guardarManifestoExportacao(db, registro, snapshot, agora));
        console.log("OK: manifesto duplicado rejeitado.");

        await db.execute({ sql: "UPDATE desktop_export_manifests SET conteudo_json = ? WHERE sessao_id = ?", args: ["{}", descritor.sessaoId] });
        await assert.rejects(() => recuperarManifestoExportacao(db, descritor.sessaoId, registro.usuarioId, agora));
        console.log("OK: adulteração persistida detectada.");

        assert.equal(await revogarSessaoExportacao(db, descritor.sessaoId, registro.usuarioId, agora), true);
        assert.equal(await recuperarManifestoExportacao(db, descritor.sessaoId, registro.usuarioId, agora), null);
        console.log("OK: revogação impede recuperação.");
        console.log("OK: teste local sem Turso ou Blob.");
    } finally {
        try { await db.close(); } finally {
            try { rmSync(pasta, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
            catch (erro) {
                if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
                console.warn(`AVISO: limpeza temporária bloqueada pelo Windows: ${pasta}`);
            }
        }
    }
}
main().catch((erro) => { console.error(erro); process.exitCode = 1; });
