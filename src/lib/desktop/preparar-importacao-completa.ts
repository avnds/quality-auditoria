import type { LogicalDatabaseBackup } from "../db/backup";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";
import type { IntegridadeEsperada } from "./conferir-integridade-esperada";
import type { AreaImportacaoDesktop } from "./area-importacao";
import { restaurarBackupEmStaging } from "./restaurar-backup-staging";
import { conferirConjuntoImportado } from "./conferir-conjunto-importado";
import { inventariarArquivosBlob } from "./inventario-blob";
import { criarPlanoTransferencia, type PlanoTransferencia } from "./plano-transferencia";
import { transferirArquivoDoPlano } from "./executar-transferencia-plano";
import { validarBackupParaStaging } from "./validar-backup-staging";
import { prepararManifestoImportacaoDesktop } from "./manifesto-importacao";

export type FonteArquivoImportacao = (
    arquivo: { tipo: "evidencia" | "relatorio"; registroId: string; referenciaSha256: string }
) => Promise<{ stream: ReadableStream<Uint8Array>; integridade: IntegridadeEsperada }>;

/**
 * Importação isolada de ponta a ponta. A fonte de bytes deve ser autenticada
 * pelo chamador; este módulo não concede acesso à produção.
 * Não publica o banco nem grava marcador de instalação.
 */
export async function prepararImportacaoCompletaStaging(
    area: AreaImportacaoDesktop,
    backup: LogicalDatabaseBackup,
    fonte: FonteArquivoImportacao
): Promise<{
    bancoArquivo: string;
    manifesto: ManifestoImportacaoDesktop;
    plano: PlanoTransferencia;
    integridades: IntegridadeEsperada[];
}> {
    validarBackupParaStaging(backup);
    const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");
    const inventario = inventariarArquivosBlob(backup);
    const plano = criarPlanoTransferencia(inventario);
    const integridades: IntegridadeEsperada[] = [];

    const restauracao = await restaurarBackupEmStaging(area, backup);
    for (const referencia of manifesto.inventario.arquivos) {
        const { stream, integridade } = await fonte(referencia);
        if (integridade.tipo !== referencia.tipo ||
            integridade.registroId !== referencia.registroId) {
            throw new Error("A fonte retornou integridade de outro arquivo.");
        }
        await transferirArquivoDoPlano(
            plano, area.arquivos, referencia.tipo, referencia.registroId,
            stream, integridade
        );
        integridades.push(integridade);
    }

    if (!await conferirConjuntoImportado(area, manifesto, plano, integridades)) {
        throw new Error("A importação temporária não passou na conferência integral.");
    }
    return {
        bancoArquivo: restauracao.bancoArquivo,
        manifesto,
        plano,
        integridades,
    };
}
