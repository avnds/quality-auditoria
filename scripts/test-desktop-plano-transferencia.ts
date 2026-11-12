import { strict as assert } from "node:assert";
import { criarPlanoTransferencia, transferenciaCompleta } from "../src/lib/desktop/plano-transferencia";
import type { InventarioBlob } from "../src/lib/desktop/inventario-blob";

const inventario: InventarioBlob = {
    totalEvidencias: 1,
    totalRelatorios: 1,
    arquivos: [
        { tipo: "evidencia", registroId: "e1", urlOriginal: "https://exemplo.invalid/e1", destinoRelativo: "evidencias/e1" },
        { tipo: "relatorio", registroId: "r1", urlOriginal: "https://exemplo.invalid/r1", destinoRelativo: "relatorios/r1" },
    ],
};

const plano = criarPlanoTransferencia(inventario);
assert.equal(transferenciaCompleta(plano), false);
console.log("OK: arquivos pendentes impedem a instalação.");

plano.arquivos[0].estado = "validado";
plano.arquivos[0].tamanhoBytes = 100;
plano.arquivos[0].sha256 = "a".repeat(64);
assert.equal(transferenciaCompleta(plano), false);
console.log("OK: validação parcial não libera a instalação.");

plano.arquivos[1].estado = "falhou";
assert.equal(transferenciaCompleta(plano), false);
console.log("OK: falha em relatório impede a instalação.");

plano.arquivos[1].estado = "validado";
plano.arquivos[1].tamanhoBytes = 200;
plano.arquivos[1].sha256 = "b".repeat(64);
assert.equal(transferenciaCompleta(plano), true);
console.log("OK: plano completo é elegível à conferência dos arquivos em disco.");

plano.arquivos[1].sha256 = "invalido";
assert.equal(transferenciaCompleta(plano), false);
console.log("OK: hash ausente ou inválido impede a instalação.");

console.log("OK: teste não acessou banco, rede ou arquivos de produção.");
