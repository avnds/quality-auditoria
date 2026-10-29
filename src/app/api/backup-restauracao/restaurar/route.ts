import { NextResponse } from "next/server";
import type { InValue } from "@libsql/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackupValue = null | string | number | boolean | { $type: "bigint"; value: string } | { $type: "blob"; base64: string };
type BackupTable = { name: string; createSql: string; columns: string[]; rows: BackupValue[][] };
type SchemaEntry = { type: string; name: string; tableName: string; sql: string };
type BackupFile = { format: "quality-auditoria-logical-backup"; formatVersion: 1; source: "development"; schema: SchemaEntry[]; tables: BackupTable[] };

function fail(message: string, status = 400) {
    return NextResponse.json({ success: false, message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeCreateStatement(sql: string, type: "table" | "index", name: string) {
    if (sql.length > 100_000 || sql.includes(";") || /\b(PRAGMA|ATTACH|DETACH|VACUUM|INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(sql)) return false;
    const prefix = type === "table"
        ? /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i
        : /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/i;
    if (!prefix.test(sql)) return false;
    const rest = sql.replace(prefix, "");
    const match = rest.match(/^(?:"((?:[^"]|"")+)"|([^\s(]+))/);
    const actualName = match?.[1]?.replace(/""/g, '"') ?? match?.[2]?.replace(/["'`\[\]]/g, "");
    return actualName === name;
}

function decodeValue(value: BackupValue): InValue {
    if (value === null || typeof value === "string" || typeof value === "number") {
        if (typeof value === "number" && !Number.isFinite(value)) throw new Error("O backup contém um número inválido.");
        return value;
    }
    if (typeof value === "boolean") return value ? 1 : 0;
    if (isRecord(value) && value.$type === "bigint" && typeof value.value === "string") {
        if (!/^-?\d+$/.test(value.value)) throw new Error("Valor bigint inválido no backup.");
        return BigInt(value.value);
    }
    if (isRecord(value) && value.$type === "blob" && typeof value.base64 === "string") {
        if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64)) throw new Error("Valor binário inválido no backup.");
        return new Uint8Array(Buffer.from(value.base64, "base64"));
    }
    throw new Error("O backup contém um tipo de dado inválido.");
}

function validateBackup(value: unknown): BackupFile {
    if (!isRecord(value) || value.format !== "quality-auditoria-logical-backup" || value.formatVersion !== 1 || value.source !== "development" || !Array.isArray(value.schema) || !Array.isArray(value.tables) || value.tables.length === 0 || value.tables.length > 200 || value.schema.length > 2_000) {
        throw new Error("Formato de backup inválido ou não compatível.");
    }

    const schema = value.schema as unknown[];
    const tables = value.tables as unknown[];
    const schemaNames = new Set<string>();
    const tableNames = new Set<string>();

    for (const raw of schema) {
        if (!isRecord(raw) || !["table", "index"].includes(String(raw.type)) || typeof raw.name !== "string" || typeof raw.tableName !== "string" || typeof raw.sql !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.name) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.tableName) || schemaNames.has(raw.name)) {
            throw new Error("O backup contém uma definição de estrutura inválida ou não suportada.");
        }
        schemaNames.add(raw.name);
        if (raw.type === "table") {
            if (!safeCreateStatement(raw.sql, "table", raw.name)) throw new Error("Uma definição de tabela do backup não passou na validação.");
            tableNames.add(raw.name);
        } else if (!safeCreateStatement(raw.sql, "index", raw.name)) {
            throw new Error("Uma definição de índice do backup não passou na validação.");
        }
    }

    if (tables.length !== tableNames.size) throw new Error("A quantidade de tabelas e os dados do backup não correspondem.");
    const seenTables = new Set<string>();

    for (const raw of tables) {
        if (!isRecord(raw) || typeof raw.name !== "string" || !tableNames.has(raw.name) || seenTables.has(raw.name) || typeof raw.createSql !== "string" || !Array.isArray(raw.columns) || !Array.isArray(raw.rows)) {
            throw new Error("Os dados de uma tabela do backup são inválidos.");
        }
        seenTables.add(raw.name);
        const schemaTable = schema.find((entry) => isRecord(entry) && entry.type === "table" && entry.name === raw.name);
        if (!isRecord(schemaTable) || raw.createSql !== schemaTable.sql || !safeCreateStatement(raw.createSql, "table", raw.name) || raw.columns.length === 0 || raw.columns.some((column) => typeof column !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) || new Set(raw.columns).size !== raw.columns.length) {
            throw new Error("A estrutura de uma tabela não corresponde aos dados do backup.");
        }
        for (const row of raw.rows) {
            if (!Array.isArray(row) || row.length !== raw.columns.length) throw new Error("Uma linha do backup tem quantidade de valores incompatível.");
        }
    }

    return value as unknown as BackupFile;
}

export async function POST(request: Request) {
    if (process.env.NODE_ENV === "production") return fail("A restauração está bloqueada neste ambiente.", 403);

    const usuario = await getCurrentUser();
    if (!usuario) return fail("Usuário não autenticado.", 401);
    if (usuario.perfil !== "MASTER") return fail("Somente o perfil MASTER pode restaurar o banco DEV.", 403);

    let transaction: Awaited<ReturnType<typeof db.transaction>> | undefined;
    let foreignKeysDisabled = false;

    try {
        const form = await request.formData();
        if (form.get("confirmacao") !== "RESTAURAR DEV") return fail('Digite exatamente "RESTAURAR DEV" para confirmar.');
        const file = form.get("arquivo");
        if (!(file instanceof File) || file.size === 0) return fail("Selecione um arquivo JSON de backup.");
        if (file.size > 25 * 1024 * 1024) return fail("O arquivo excede o limite de 25 MB.");

        let parsed: unknown;
        try { parsed = JSON.parse(await file.text()); } catch { return fail("O arquivo não contém JSON válido."); }
        const backup = validateBackup(parsed);

        await db.execute("PRAGMA foreign_keys = OFF");
        foreignKeysDisabled = true;
        transaction = await db.transaction("write");
        await transaction.execute("PRAGMA defer_foreign_keys = ON");

        const currentIndexes = await transaction.execute("SELECT name FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'");
        for (const row of currentIndexes.rows) {
            const name = String(row.name);
            await transaction.execute('DROP INDEX IF EXISTS "' + name.replace(/"/g, '""') + '"');
        }

        const currentTables = await transaction.execute("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
        for (const row of currentTables.rows) {
            const name = String(row.name);
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("O banco atual contém um nome de objeto inesperado; restauração cancelada.");
            await transaction.execute('DROP TABLE IF EXISTS "' + name.replace(/"/g, '""') + '"');
        }

        for (const table of backup.tables) await transaction.execute(table.createSql);

        for (const table of backup.tables) {
            const quotedTable = '"' + table.name.replace(/"/g, '""') + '"';
            const quotedColumns = table.columns.map((column) => '"' + column.replace(/"/g, '""') + '"').join(", ");
            const placeholders = table.columns.map(() => "?").join(", ");
            const sql = "INSERT INTO " + quotedTable + " (" + quotedColumns + ") VALUES (" + placeholders + ")";
            for (const row of table.rows) {
                await transaction.execute({ sql, args: row.map((value) => decodeValue(value as BackupValue)) });
            }
        }

        for (const entry of backup.schema.filter((item) => item.type === "index")) await transaction.execute(entry.sql);

        const foreignKeyCheck = await transaction.execute("PRAGMA foreign_key_check");
        if (foreignKeyCheck.rows.length > 0) throw new Error("A verificação de integridade encontrou referências inválidas. A transação foi cancelada.");

        for (const table of backup.tables) {
            const result = await transaction.execute({ sql: 'SELECT COUNT(*) AS total FROM "' + table.name.replace(/"/g, '""') + '"' });
            if (Number(result.rows[0]?.total ?? 0) !== table.rows.length) throw new Error("A conferência de quantidade de linhas falhou. A transação foi cancelada.");
        }

        await transaction.commit();
        return NextResponse.redirect(new URL("/backup-restauracao?restaurado=1", request.url), 303);
    } catch (error) {
        if (transaction) {
            try { await transaction.rollback(); } catch (rollbackError) { console.error("Erro ao reverter restauração lógica:", rollbackError); }
        }
        console.error("Erro na restauração lógica DEV:", error);
        const message = error instanceof Error ? error.message : "Erro inesperado na restauração.";
        return fail(message, 400);
    } finally {
        if (transaction) {
            try { await transaction.close(); } catch (error) { console.error("Erro ao fechar transação de restauração:", error); }
        }
        if (foreignKeysDisabled) {
            try { await db.execute("PRAGMA foreign_keys = ON"); } catch (error) { console.error("Erro ao reativar foreign_keys:", error); }
        }
    }
}
