import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { InValue } from "@libsql/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackupValue = null | string | number | boolean | { $type: "bigint"; value: string } | { $type: "blob"; base64: string };
type BackupTable = { name: string; createSql: string; columns: string[]; rows: BackupValue[][] };
type SchemaEntry = { type: string; name: string; tableName: string; sql: string };
type BackupFile = { format: "quality-auditoria-logical-backup"; formatVersion: 1; source: "development" | "production"; schema: SchemaEntry[]; tables: BackupTable[] };

function fail(message: string, status = 400) {
    return NextResponse.json({ success: false, message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeCreateStatement(sql: string, type: "table" | "index", name: string) {
    if (sql.length > 100_000 || sql.includes(";") || /--|\/\*/.test(sql)) return false;
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
    if (!isRecord(value) || value.format !== "quality-auditoria-logical-backup" || value.formatVersion !== 1 || !(value.source === "development" || value.source === "production") || !Array.isArray(value.schema) || !Array.isArray(value.tables) || value.tables.length === 0 || value.tables.length > 200 || value.schema.length > 2_000) {
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
    // A restrição deve considerar o banco real, não o ambiente da aplicação.
    let ambienteBanco: "development" | "production";
    try {
        ambienteBanco = identificarAmbienteBanco();
    } catch {
        return fail("Não foi possível identificar o banco conectado. Restauração bloqueada.", 403);
    }
    const usuario = await getCurrentUser();
    if (!usuario) return fail("Usuário não autenticado.", 401);
    if (usuario.perfil !== "MASTER") return fail("Somente o perfil MASTER pode restaurar bancos de dados.", 403);

    // A autorização é assinada pelo servidor e vinculada ao MASTER e ao banco de destino.
    // O download pode ser cancelado pelo navegador; por isso a confirmação humana continua necessária.
    const cookieStore = await cookies();
    const token = cookieStore.get("quality_restore_prepared")?.value;
    const secret = process.env.TURSO_AUTH_TOKEN;
    if (!token || !secret) {
        return fail("Baixe primeiro o backup de recuperação do banco de destino.", 403);
    }
    let authorized = false;
    try {
        const raw = Buffer.from(token, "base64url").toString("utf8");
        const lastColon = raw.lastIndexOf(":");
        const payload = raw.slice(0, lastColon);
        const signature = raw.slice(lastColon + 1);
        const fields = payload.split(":");
        const expected = createHmac("sha256", secret).update(payload).digest("hex");
        const signatureBuffer = Buffer.from(signature, "hex");
        const expectedBuffer = Buffer.from(expected, "hex");
        const issuedAt = Number(fields[2]);
        authorized = fields.length === 4
            && fields[0] === String(usuario.id)
            && fields[1] === ambienteBanco
            && Number.isSafeInteger(issuedAt)
            && issuedAt <= Date.now()
            && Date.now() - issuedAt <= 10 * 60 * 1000
            && signature.length === 64
            && signatureBuffer.length === expectedBuffer.length
            && timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch {
        authorized = false;
    }
    if (!authorized) {
        return fail("Autorização de recuperação inválida ou expirada. Baixe um novo backup.", 403);
    }

    let transaction: Awaited<ReturnType<typeof db.transaction>> | undefined;

    try {
        const form = await request.formData();
        const confirmacaoEsperada = ambienteBanco === "production" ? "RESTAURAR PRODUCAO" : "RESTAURAR DEV";
        if (form.get("confirmacao") !== confirmacaoEsperada) {
            return fail(`Digite exatamente "${confirmacaoEsperada}" para confirmar.`);
        }
        if (ambienteBanco === "production" && form.get("backup_recuperacao") !== "confirmado") {
            return fail("Confirme que existe um backup de recuperação da produção salvo fora do sistema.");
        }
        const file = form.get("arquivo");
        if (!(file instanceof File) || file.size === 0) return fail("Selecione um arquivo JSON de backup.");
        if (file.size > 25 * 1024 * 1024) return fail("O arquivo excede o limite de 25 MB.");

        let parsed: unknown;
        try { parsed = JSON.parse(await file.text()); } catch { return fail("O arquivo não contém JSON válido."); }
        const backup = validateBackup(parsed);

        // Mantém as chaves estrangeiras ativas: PRAGMA em db.execute() pode
        // usar outra conexão, diferente da transação remota do Turso.
        transaction = await db.transaction("write");
        await transaction.execute("PRAGMA defer_foreign_keys = ON");

        const currentTables = await transaction.execute("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
        const names = currentTables.rows.map((row) => String(row.name));
        for (const name of names) {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
                throw new Error("O banco atual contém um nome de objeto inesperado; restauração cancelada.");
            }
        }

        // Exclui tabelas filhas antes das tabelas referenciadas. Nunca
        // depende da ordem arbitrária retornada por sqlite_schema.
        const existing = new Set(names);
        const dependencies = new Map<string, Set<string>>();
        for (const name of names) {
            const foreignKeys = await transaction.execute('PRAGMA foreign_key_list("' + name + '")');
            const parents = new Set<string>();
            for (const key of foreignKeys.rows) {
                const parent = String(key.table);
                if (parent !== name && existing.has(parent)) parents.add(parent);
            }
            dependencies.set(name, parents);
        }
        const dropOrder: string[] = [];
        const pending = new Set(names);
        while (pending.size > 0) {
            const next = [...pending].find((name) =>
                ![...pending].some((other) => other !== name && dependencies.get(other)?.has(name))
            );
            if (!next) {
                throw new Error("Dependências circulares entre tabelas: restauração cancelada por segurança.");
            }
            dropOrder.push(next);
            pending.delete(next);
        }
        for (const name of dropOrder) {
            await transaction.execute('DROP TABLE IF EXISTS "' + name + '"');
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
        cookieStore.delete("quality_restore_prepared");
        return NextResponse.redirect(new URL("/backup-restauracao?restaurado=1", request.url), 303);
    } catch (error) {
        if (transaction) {
            try { await transaction.rollback(); } catch (rollbackError) { console.error("Erro ao reverter restauração lógica:", rollbackError); }
        }
        console.error("Erro na restauração lógica:", error);
        const message = error instanceof Error ? error.message : "Erro inesperado na restauração.";
        return fail(message, 400);
    } finally {
        if (transaction) {
            try { await transaction.close(); } catch (error) { console.error("Erro ao fechar transação de restauração:", error); }
        }
    }
}
