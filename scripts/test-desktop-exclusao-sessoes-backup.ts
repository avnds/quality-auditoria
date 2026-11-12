import { strict as assert } from "node:assert";
import { createClient } from "@libsql/client";
import { createLogicalDatabaseBackup } from "../src/lib/db/backup";
import { NOME_TABELA_SESSOES_EXPORTACAO } from "../src/lib/desktop/schema-sessoes-exportacao";

async function main() {
    // Apenas identifica a origem no metadado do backup; o cliente fornecido
    // continua sendo SQLite em memória, sem conexão remota.
    const runtimeAnterior = process.env.QUALITY_RUNTIME;
    process.env.QUALITY_RUNTIME = "desktop";
    const db = createClient({ url: "file::memory:" });
    try {
        await db.execute("CREATE TABLE clientes_teste (id TEXT PRIMARY KEY, nome TEXT NOT NULL)");
        await db.execute("CREATE INDEX idx_clientes_teste_nome ON clientes_teste(nome)");
        await db.execute("INSERT INTO clientes_teste (id, nome) VALUES ('1', 'Cliente de teste')");
        await db.execute(`CREATE TABLE ${NOME_TABELA_SESSOES_EXPORTACAO} (sessao_id TEXT PRIMARY KEY, usuario_id TEXT)`);
        await db.execute(`CREATE INDEX idx_sessoes_teste_usuario ON ${NOME_TABELA_SESSOES_EXPORTACAO}(usuario_id)`);
        await db.execute(`INSERT INTO ${NOME_TABELA_SESSOES_EXPORTACAO} (sessao_id, usuario_id) VALUES ('s1', 'u1')`);

        const desktop = await createLogicalDatabaseBackup(db, {
            excluirTabelas: [NOME_TABELA_SESSOES_EXPORTACAO],
        });
        assert.equal(desktop.tables.some((t) => t.name === NOME_TABELA_SESSOES_EXPORTACAO), false);
        assert.equal(desktop.schema.some((item) =>
            item.name === NOME_TABELA_SESSOES_EXPORTACAO ||
            item.tableName === NOME_TABELA_SESSOES_EXPORTACAO
        ), false);
        console.log("OK: tabela de sessões e índices associados excluídos.");

        const clientes = desktop.tables.find((t) => t.name === "clientes_teste");
        assert.ok(clientes);
        assert.equal(clientes.rows.length, 1);
        assert.equal(clientes.rows[0][clientes.columns.indexOf("nome")], "Cliente de teste");
        assert.equal(desktop.schema.some((item) => item.name === "idx_clientes_teste_nome"), true);
        console.log("OK: dados e índice das demais tabelas preservados.");

        const tradicional = await createLogicalDatabaseBackup(db);
        assert.equal(tradicional.tables.some((t) => t.name === NOME_TABELA_SESSOES_EXPORTACAO), true);
        assert.equal(tradicional.schema.some((item) => item.name === "idx_sessoes_teste_usuario"), true);
        console.log("OK: backup tradicional sem exclusão permanece inalterado.");

        console.log("OK: teste em SQLite temporário, sem Turso ou Vercel Blob.");
    } finally {
        db.close();
        if (runtimeAnterior === undefined) delete process.env.QUALITY_RUNTIME;
        else process.env.QUALITY_RUNTIME = runtimeAnterior;
    }
}

main().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
});
