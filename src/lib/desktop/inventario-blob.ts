import type { LogicalDatabaseBackup } from "../db/backup";

export type ArquivoBlobInventariado = {
    tipo: "evidencia" | "relatorio";
    registroId: string;
    urlOriginal: string;
    destinoRelativo: string;
};

export type InventarioBlob = {
    arquivos: ArquivoBlobInventariado[];
    totalEvidencias: number;
    totalRelatorios: number;
};

/**
 * Inventário somente leitura. Não faz downloads, não consulta o Blob
 * e não altera o backup original.
 *
 * Todas as URLs inventariadas exigirão validação de origem e transferência
 * autenticada antes de qualquer acesso à rede.
 */
export function inventariarArquivosBlob(
    backup: LogicalDatabaseBackup
): InventarioBlob {
    if (backup.format !== "quality-auditoria-logical-backup" || backup.formatVersion !== 1) {
        throw new Error("Backup incompatível com o inventário de arquivos.");
    }

    const arquivos: ArquivoBlobInventariado[] = [];
    const destinos = new Set<string>();

    for (const [nomeTabela, tipo, pasta] of [
        ["evidencias", "evidencia", "evidencias"],
        ["relatorios", "relatorio", "relatorios"],
    ] as const) {
        const tabela = backup.tables.find((item) => item.name === nomeTabela);
        if (!tabela) {
            throw new Error(`O backup não contém a tabela obrigatória: ${nomeTabela}.`);
        }

        const idIndex = tabela.columns.indexOf("id");
        const uriIndex = tabela.columns.indexOf("arquivo_uri");
        if (idIndex < 0 || uriIndex < 0) {
            throw new Error(`A tabela ${nomeTabela} não contém id e arquivo_uri.`);
        }

        for (const row of tabela.rows) {
            const id = row[idIndex];
            const uri = row[uriIndex];
            if (uri === null || uri === "") continue;
            if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
                throw new Error(`Identificador inválido em ${nomeTabela}.`);
            }
            if (typeof uri !== "string" || uri.length > 4096) {
                throw new Error(`Endereço de arquivo inválido em ${nomeTabela}.`);
            }
            // Extensões finais serão determinadas a partir do conteúdo validado.
            const destinoRelativo = `${pasta}/${id}`;
            if (destinos.has(destinoRelativo)) {
                throw new Error(`Identificador de arquivo duplicado em ${nomeTabela}.`);
            }
            destinos.add(destinoRelativo);
            arquivos.push({ tipo, registroId: id, urlOriginal: uri, destinoRelativo });
        }
    }

    return {
        arquivos,
        totalEvidencias: arquivos.filter((item) => item.tipo === "evidencia").length,
        totalRelatorios: arquivos.filter((item) => item.tipo === "relatorio").length,
    };
}
