import type { LogicalDatabaseBackup } from "../db/backup";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";
import { conferirReferenciaSnapshot } from "./conferir-referencia-snapshot";
import { prepararManifestoImportacaoDesktop } from "./manifesto-importacao";

export type ArquivoVinculadoSessao = {
    tipo: "evidencia" | "relatorio";
    registroId: string;
    uriSnapshot: string;
    referenciaSha256: string;
    destinoRelativo: string;
};

/**
 * Resolve uma referência SOMENTE a partir do banco congelado da sessão.
 * Não consulta o registro atual de produção, nem aceita URI do cliente.
 * O chamador deve recuperar o snapshot por sessão autenticada e válida.
 * Isso fixa a referência, mas não torna os bytes do Blob imutáveis.
 */
export function localizarArquivoNoSnapshot(
    backup: LogicalDatabaseBackup,
    manifesto: ManifestoImportacaoDesktop,
    tipo: "evidencia" | "relatorio",
    registroId: string,
    referenciaSha256: string
): ArquivoVinculadoSessao | null {
    if ((tipo !== "evidencia" && tipo !== "relatorio") ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(registroId) ||
        !/^[a-f0-9]{64}$/.test(referenciaSha256)) return null;

    const esperado = prepararManifestoImportacaoDesktop(backup, "producao_direta");
    if (JSON.stringify(esperado) !== JSON.stringify(manifesto)) {
        throw new Error("Manifesto não corresponde ao banco congelado.");
    }
    const arquivo = manifesto.inventario.arquivos.find(
        item => item.tipo === tipo && item.registroId === registroId
    );
    if (!arquivo || arquivo.referenciaSha256 !== referenciaSha256) return null;

    const tabela = backup.tables.find(item => item.name === (tipo === "evidencia" ? "evidencias" : "relatorios"));
    if (!tabela) throw new Error("Tabela de arquivos ausente no snapshot.");
    const colunaId = tabela.columns.indexOf("id");
    const colunaUri = tabela.columns.indexOf("arquivo_uri");
    if (colunaId < 0 || colunaUri < 0) throw new Error("Colunas de arquivos ausentes no snapshot.");

    const linhas = tabela.rows.filter(linha => linha[colunaId] === registroId);
    if (linhas.length !== 1 || typeof linhas[0][colunaUri] !== "string") {
        throw new Error("Registro de arquivo ausente ou duplicado no snapshot.");
    }
    const uriSnapshot = linhas[0][colunaUri] as string;
    if (!conferirReferenciaSnapshot(uriSnapshot, referenciaSha256)) {
        throw new Error("Referência privada divergente do manifesto.");
    }
    return { tipo, registroId, uriSnapshot, referenciaSha256, destinoRelativo: arquivo.destinoRelativo };
}
