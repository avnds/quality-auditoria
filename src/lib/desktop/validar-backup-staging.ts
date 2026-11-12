import type { LogicalDatabaseBackup } from "../db/backup";

/**
 * Validação estrutural estrita antes de qualquer SQL em banco de staging.
 * SQL de esquema só deve vir de exportação autenticada; esta função
 * não transforma um backup arbitrário em SQL confiável.
 */
export function validarBackupParaStaging(
    valor: unknown
): asserts valor is LogicalDatabaseBackup {
    if (!valor || typeof valor !== "object") throw new Error("Backup ausente.");
    const b = valor as Partial<LogicalDatabaseBackup>;
    if (b.format !== "quality-auditoria-logical-backup" ||
        b.formatVersion !== 1 || b.source !== "production" ||
        !Array.isArray(b.schema) || !Array.isArray(b.tables) ||
        b.tables.length === 0 || b.tables.length > 200 || b.schema.length > 2000) {
        throw new Error("Backup de produção incompatível.");
    }
    const tabelas = new Map<string, string>();
    const nomes = new Set<string>();
    for (const item of b.schema) {
        if (!item || !["table", "index"].includes(item.type) ||
            !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.name) ||
            !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.tableName) ||
            typeof item.sql !== "string" || item.sql.length > 100_000 ||
            item.sql.includes(";") || /--|\/\*/.test(item.sql) ||
            nomes.has(item.name)) throw new Error("Esquema de backup inválido.");
        const prefixo = item.type === "table"
            ? /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i
            : /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/i;
        if (!prefixo.test(item.sql)) throw new Error("Comando SQL de esquema não autorizado.");
        const nomeSql = item.sql.replace(prefixo, "").match(/^(?:"((?:[^"]|"")+)"|([^\s(]+))/);
        const nome = nomeSql?.[1]?.replace(/""/g, '"') ??
            nomeSql?.[2]?.replace(/["'`\[\]]/g, "");
        if (nome !== item.name) throw new Error("Nome SQL incompatível.");
        nomes.add(item.name);
        if (item.type === "table") tabelas.set(item.name, item.sql);
    }
    if (b.tables.length !== tabelas.size) throw new Error("Tabelas ausentes no backup.");
    const vistos = new Set<string>();
    for (const tabela of b.tables) {
        if (!tabela || !tabelas.has(tabela.name) || vistos.has(tabela.name) ||
            tabela.createSql !== tabelas.get(tabela.name) ||
            !Array.isArray(tabela.columns) || !tabela.columns.length ||
            !Array.isArray(tabela.rows) ||
            tabela.columns.some(c => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(c)) ||
            new Set(tabela.columns).size !== tabela.columns.length ||
            tabela.rows.some(row => !Array.isArray(row) || row.length !== tabela.columns.length)) {
            throw new Error("Dados e esquema do backup incompatíveis.");
        }
        vistos.add(tabela.name);
    }
    for (const obrigatoria of ["evidencias", "relatorios"]) {
        const tabela = b.tables.find(t => t.name === obrigatoria);
        if (!tabela || !tabela.columns.includes("id") ||
            !tabela.columns.includes("arquivo_uri")) {
            throw new Error(`Tabela obrigatória ausente: ${obrigatoria}.`);
        }
    }
    if (tabelas.has("desktop_export_sessions") || tabelas.has("desktop_export_manifests")) {
        throw new Error("Backup contém tabelas internas de exportação.");
    }
}
