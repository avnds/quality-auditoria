import { existsSync, lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import type { AreaImportacaoDesktop } from "./area-importacao";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";
import type { PlanoTransferencia } from "./plano-transferencia";
import type { IntegridadeEsperada } from "./conferir-integridade-esperada";
import { conferirConjuntoImportado } from "./conferir-conjunto-importado";
import { conferirCoberturaIntegridadeManifesto } from "./conferir-cobertura-integridade";

/**
 * Última barreira somente leitura antes de uma eventual publicação.
 * O chamador deverá garantir exclusividade da área durante esta verificação
 * e durante a publicação, para evitar alteração dos arquivos entre as etapas.
 * NÃO cria marcador, não substitui a instalação e não faz backup.
 */
export async function verificarPreAtivacaoDesktop(
    area: AreaImportacaoDesktop,
    manifesto: ManifestoImportacaoDesktop,
    plano: PlanoTransferencia,
    integridades: readonly IntegridadeEsperada[]
): Promise<{ aprovada: boolean; motivo: string }> {
    if (!area || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(area.id)) {
        return { aprovada: false, motivo: "Área de importação inválida." };
    }
    const raiz = resolve(area.raiz);
    if (!existsSync(raiz) || lstatSync(raiz).isSymbolicLink() ||
        !lstatSync(raiz).isDirectory() || realpathSync(raiz) !== raiz ||
        resolve(area.arquivos) !== resolve(raiz, "arquivos") ||
        resolve(area.banco) !== resolve(raiz, "banco")) {
        return { aprovada: false, motivo: "Diretórios de staging inválidos." };
    }
    if (!conferirCoberturaIntegridadeManifesto(manifesto, integridades)) {
        return { aprovada: false, motivo: "Cobertura de integridade incompleta." };
    }
    try {
        if (!await conferirConjuntoImportado(area, manifesto, plano, integridades)) {
            return { aprovada: false, motivo: "Banco ou arquivos não passaram na conferência integral." };
        }
    } catch {
        return { aprovada: false, motivo: "Falha ao conferir banco ou arquivos." };
    }
    return { aprovada: true, motivo: "Conjunto validado; publicação ainda não autorizada." };
}
