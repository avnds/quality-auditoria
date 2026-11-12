import { strict as assert } from "node:assert";
import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQL_CRIAR_TABELA_SESSOES_EXPORTACAO } from "../src/lib/desktop/schema-sessoes-exportacao";
import {
    registrarSessaoExportacao,
    consultarSessaoExportacao,
    revogarSessaoExportacao,
} from "../src/lib/desktop/repositorio-sessoes-exportacao";
import type { SessaoExportacaoAutorizada } from "../src/lib/desktop/autorizacao-sessao-exportacao";

async function main() {
    const pasta = mkdtempSync(join(tmpdir(), "quality-sessoes-teste-"));
    const db = createClient({ url: `file:${join(pasta, "sessoes.sqlite")}` });
    try {
        await db.execute(SQL_CRIAR_TABELA_SESSOES_EXPORTACAO);
        const agora = new Date("2026-11-12T15:00:00.000Z");
        const registro: SessaoExportacaoAutorizada = {
            usuarioId: "supervisora1",
            perfilNaCriacao: "SUPERVISORA",
            descritor: {
                formato: "quality-desktop-export-session",
                versao: 1,
                sessaoId: "123e4567-e89b-42d3-a456-426614174000",
                criadaEm: agora.toISOString(),
                expiraEm: new Date(agora.getTime() + 600_000).toISOString(),
                manifestoSha256: "a".repeat(64),
            },
        };
        await registrarSessaoExportacao(db, registro);
        const encontrada = await consultarSessaoExportacao(db, registro.descritor.sessaoId, registro.usuarioId, agora);
        assert.deepEqual(encontrada, registro);
        console.log("OK: registro e consulta preservam o vínculo e o manifesto hash.");

        assert.equal(await consultarSessaoExportacao(db, registro.descritor.sessaoId, "outroUsuario", agora), null);
        console.log("OK: outro usuário não acessa a sessão.");

        assert.equal(await consultarSessaoExportacao(db, registro.descritor.sessaoId, registro.usuarioId, new Date(agora.getTime() + 600_000)), null);
        console.log("OK: sessão expirada não é retornada.");

        await assert.rejects(() => registrarSessaoExportacao(db, registro));
        console.log("OK: identificador duplicado é rejeitado.");

        assert.equal(await revogarSessaoExportacao(db, registro.descritor.sessaoId, "outroUsuario", agora), false);
        assert.equal(await revogarSessaoExportacao(db, registro.descritor.sessaoId, registro.usuarioId, agora), true);
        assert.equal(await revogarSessaoExportacao(db, registro.descritor.sessaoId, registro.usuarioId, agora), false);
        assert.equal(await consultarSessaoExportacao(db, registro.descritor.sessaoId, registro.usuarioId, agora), null);
        console.log("OK: revogação exige proprietário e impede reutilização.");
    } finally {
        try {
            await db.close();
        } finally {
            try {
                rmSync(pasta, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
            } catch (erro) {
                if (!["EPERM", "EACCES", "EBUSY"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
                console.warn(`AVISO: limpeza temporária bloqueada pelo Windows: ${pasta}`);
            }
        }
    }
}
main().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
});
