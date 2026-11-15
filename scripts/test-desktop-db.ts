/**
 * Teste isolado da conexão SQLite para Quality Desktop.
 * Não lê .env.local, não usa Turso, não executa migrações e não altera dados.
 * Cria somente um banco de teste em uma pasta temporária do Windows.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { identificarAmbienteBanco } from "../src/lib/db/identificar-ambiente";
import { obterUrlBancoDesktop } from "../src/lib/desktop/storage";

async function main() {
    const dir = mkdtempSync(join(tmpdir(), "quality-desktop-test-"));
    const file = join(dir, "quality-test.sqlite");
    const previousRuntime = process.env.QUALITY_RUNTIME;
    const previousUrl = process.env.TURSO_DATABASE_URL;
    let db: ReturnType<typeof createClient> | undefined;

    try {
        process.env.QUALITY_RUNTIME = "desktop";
        process.env.TURSO_DATABASE_URL = pathToFileURL(file).href;

        if (identificarAmbienteBanco() !== "production_offline") {
            throw new Error("O ambiente local não foi identificado corretamente.");
        }

        // O aplicativo usará o caminho permanente, nunca a URL TURSO de teste.
        if (obterUrlBancoDesktop() === process.env.TURSO_DATABASE_URL) {
            throw new Error("O teste não está isolado do armazenamento permanente.");
        }

        // Exercitar SQLite com um arquivo temporário sem tocar no banco permanente.
        db = createClient({ url: pathToFileURL(file).href });
        const result = await db.execute("SELECT 1 AS ok");
        if (Number(result.rows[0]?.ok) !== 1) {
            throw new Error("O SQLite não respondeu corretamente.");
        }

        console.log("OK: ambiente production_offline identificado.");
        console.log("OK: conexão SQLite temporária funcionando.");
        console.log("OK: caminho permanente do Desktop configurado separadamente.");
        console.log("OK: nenhum banco Turso foi acessado.");
    } finally {
        if (db) await db.close();
        if (previousRuntime === undefined) delete process.env.QUALITY_RUNTIME;
        else process.env.QUALITY_RUNTIME = previousRuntime;
        if (previousUrl === undefined) delete process.env.TURSO_DATABASE_URL;
        else process.env.TURSO_DATABASE_URL = previousUrl;
        // O Windows pode manter handles do SQLite por alguns instantes.
        // Falha de limpeza não invalida o teste de conexão.
        try {
            rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        } catch (error) {
            console.warn("Aviso: pasta temporária não removida automaticamente:", dir);
            console.warn(error);
        }
    }
}

main().catch((error) => {
    console.error("Falha no teste isolado do Desktop:", error);
    process.exitCode = 1;
});
