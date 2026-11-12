import type { LogicalDatabaseBackup } from "../db/backup";

export type OrigemImportacaoDesktop = "producao_direta" | "pacote_backup";
export type PerfilImportador = "MASTER" | "SUPERVISORA" | "CONSULTOR";

export type SolicitacaoImportacaoDesktop = {
    origem: OrigemImportacaoDesktop;
    perfil: PerfilImportador;
    ambienteDestino: "production_offline";
    instalacaoExistente: boolean;
    substituicaoConfirmada: boolean;
    backupLocalVerificado: boolean;
};

/**
 * Política única das duas modalidades de importação.
 * Apenas decide se a operação pode começar; não conecta a bancos,
 * não baixa arquivos e não altera instalações existentes.
 */
export function autorizarInicioImportacaoDesktop(
    solicitacao: SolicitacaoImportacaoDesktop
): void {
    if (solicitacao.ambienteDestino !== "production_offline") {
        throw new Error("A importação Desktop só pode ter como destino a produção offline.");
    }
    if (solicitacao.perfil !== "MASTER" && solicitacao.perfil !== "SUPERVISORA") {
        throw new Error("Perfil sem autorização para importar dados no Desktop.");
    }
    if (solicitacao.origem !== "producao_direta" && solicitacao.origem !== "pacote_backup") {
        throw new Error("Modalidade de importação desconhecida.");
    }
    if (solicitacao.instalacaoExistente &&
        (!solicitacao.substituicaoConfirmada || !solicitacao.backupLocalVerificado)) {
        throw new Error("Substituição exige confirmação e backup local previamente verificado.");
    }
}

/** Backup lógico importado da produção deve ter origem identificada. */
export function validarOrigemBackupParaDesktop(backup: LogicalDatabaseBackup): void {
    if (backup.format !== "quality-auditoria-logical-backup" || backup.formatVersion !== 1) {
        throw new Error("Formato de backup incompatível.");
    }
    if (backup.source !== "production" && backup.source !== "production_offline") {
        throw new Error("Backup não pertence a uma origem de produção permitida.");
    }
}
