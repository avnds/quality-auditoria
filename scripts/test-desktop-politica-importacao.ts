import { strict as assert } from "node:assert";
import {
    autorizarInicioImportacaoDesktop,
    validarOrigemBackupParaDesktop,
    type SolicitacaoImportacaoDesktop,
} from "../src/lib/desktop/politica-importacao";
import type { LogicalDatabaseBackup } from "../src/lib/db/backup";

const base: SolicitacaoImportacaoDesktop = {
    origem: "producao_direta",
    perfil: "SUPERVISORA",
    ambienteDestino: "production_offline",
    instalacaoExistente: false,
    substituicaoConfirmada: false,
    backupLocalVerificado: false,
};

assert.doesNotThrow(() => autorizarInicioImportacaoDesktop(base));
assert.doesNotThrow(() => autorizarInicioImportacaoDesktop({ ...base, origem: "pacote_backup" }));
console.log("OK: SUPERVISORA autorizada nas duas modalidades.");

assert.doesNotThrow(() => autorizarInicioImportacaoDesktop({ ...base, perfil: "MASTER" }));
assert.throws(() => autorizarInicioImportacaoDesktop({ ...base, perfil: "CONSULTOR" }), /sem autorização/);
console.log("OK: MASTER autorizado e CONSULTOR bloqueado.");

assert.throws(() => autorizarInicioImportacaoDesktop({
    ...base,
    ambienteDestino: "production" as "production_offline",
}), /destino/);
console.log("OK: destino online bloqueado.");

assert.throws(() => autorizarInicioImportacaoDesktop({
    ...base,
    instalacaoExistente: true,
}), /Substituição exige/);
assert.throws(() => autorizarInicioImportacaoDesktop({
    ...base,
    instalacaoExistente: true,
    substituicaoConfirmada: true,
}), /Substituição exige/);
assert.doesNotThrow(() => autorizarInicioImportacaoDesktop({
    ...base,
    instalacaoExistente: true,
    substituicaoConfirmada: true,
    backupLocalVerificado: true,
}));
console.log("OK: substituição exige confirmação e backup local verificado.");

const backup = {
    format: "quality-auditoria-logical-backup",
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    source: "production",
    schema: [],
    tables: [],
} satisfies LogicalDatabaseBackup;

assert.doesNotThrow(() => validarOrigemBackupParaDesktop(backup));
assert.doesNotThrow(() => validarOrigemBackupParaDesktop({ ...backup, source: "production_offline" }));
assert.throws(() => validarOrigemBackupParaDesktop({ ...backup, source: "development" }), /origem/);
console.log("OK: backups de produção online/offline aceitos; desenvolvimento rejeitado.");

console.log("OK: teste isolado sem banco, rede ou operações de escrita.");
