import type { Client, InValue } from "@libsql/client";

type BackupValue =
    | null
    | string
    | number
    | boolean
    | { $type: "bigint"; value: string }
    | { $type: "blob"; base64: string };

type BackupTable = {
    name: string;
    createSql: string;
    columns: string[];
    rows: BackupValue[][];
};

export type LogicalDatabaseBackup = {
    format: "quality-auditoria-logical-backup";
    formatVersion: 1;
    createdAt: string;
    source: "development" | "production";
    schema: Array<{
        type: string;
        name: string;
        tableName: string;
        sql: string;
    }>;
    tables: BackupTable[];
};

function encodeValue(value: unknown): BackupValue {
    if (value === null || value === undefined) return null;

    if (typeof value === "bigint") {
        return { $type: "bigint", value: value.toString() };
    }

    if (value instanceof Uint8Array) {
        return {
            $type: "blob",
            base64: Buffer.from(value).toString("base64"),
        };
    }

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return value;
    }

    throw new Error("O backup encontrou um tipo de dado não suportado.");
}

/**
 * Cria um backup lógico dentro de uma única transação de leitura.
 * Não executa comandos de escrita no banco de origem.
 */
export async function createLogicalDatabaseBackup(
    db: Client
): Promise<LogicalDatabaseBackup> {
    const transaction = await db.transaction("read");

    try {
        const schemaResult = await transaction.execute({
            sql: `
                SELECT type, name, tbl_name AS tableName, sql
                FROM sqlite_schema
                WHERE sql IS NOT NULL
                  AND name NOT LIKE 'sqlite_%'
                ORDER BY
                    CASE type
                        WHEN 'table' THEN 1
                        WHEN 'index' THEN 2
                        WHEN 'trigger' THEN 3
                        WHEN 'view' THEN 4
                        ELSE 5
                    END,
                    name
            `,
        });

        const schema = schemaResult.rows.map((row) => ({
            type: String(row.type),
            name: String(row.name),
            tableName: String(row.tableName),
            sql: String(row.sql),
        }));

        const tableDefinitions = schema.filter(
            (entry) => entry.type === "table"
        );

        const tables: BackupTable[] = [];

        for (const table of tableDefinitions) {
            const escapedName = table.name.replace(/"/g, '""');
            const result = await transaction.execute(
                `SELECT * FROM "${escapedName}"`
            );

            tables.push({
                name: table.name,
                createSql: table.sql,
                columns: result.columns,
                rows: result.rows.map((row) =>
                    result.columns.map((column) =>
                        encodeValue(row[column] as InValue)
                    )
                ),
            });
        }

        return {
            format: "quality-auditoria-logical-backup",
            formatVersion: 1,
            createdAt: new Date().toISOString(),
            source: process.env.NODE_ENV === "production" ? "production" : "development",
            schema,
            tables,
        };
    } finally {
        await transaction.close();
    }
}
