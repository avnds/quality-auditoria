import { cpSync, existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AreaImportacaoDesktop } from "./area-importacao";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";
import type { PlanoTransferencia } from "./plano-transferencia";
import type { IntegridadeEsperada } from "./conferir-integridade-esperada";
import { verificarPreAtivacaoDesktop } from "./verificar-pre-ativacao";
import { adquirirBloqueioAtivacaoDesktop, liberarBloqueioAtivacaoDesktop } from "./bloqueio-ativacao";

/**
 * Ativa SOMENTE a primeira instalação. Não substitui instalações existentes.
 * Deve ser executada pelo instalador com a aplicação parada e sem conexões SQLite.
 * Banco e arquivos precisam ter sido preparados e conferidos previamente.
 */
export async function ativarPrimeiraInstalacaoDesktop(
    raizDados: string,
    area: AreaImportacaoDesktop,
    manifesto: ManifestoImportacaoDesktop,
    plano: PlanoTransferencia,
    integridades: readonly IntegridadeEsperada[]
): Promise<{ ativa: true; banco: string; arquivos: string }> {
    const raiz = resolve(raizDados);
    const bancoAtivo = join(raiz, "database", "quality.sqlite");
    const pastaArquivos = join(raiz, "arquivos");
    const marcador = join(raiz, "instalacao.json");
    const bancoStaging = join(area.banco, "quality.sqlite");
    const bloqueio = adquirirBloqueioAtivacaoDesktop(raiz);
    let iniciouPublicacao = false;
    try {
        if (existsSync(marcador) || existsSync(bancoAtivo) || existsSync(pastaArquivos)) {
            throw new Error("Já existem dados ativos ou publicação incompleta. Primeira instalação recusada.");
        }
        if (resolve(area.raiz) !== join(raiz, "importacoes", area.id)) {
            throw new Error("A área de importação não pertence à instalação.");
        }
        const validacao = await verificarPreAtivacaoDesktop(area, manifesto, plano, integridades);
        if (!validacao.aprovada) throw new Error(validacao.motivo);
        if (!existsSync(bancoStaging) || lstatSync(bancoStaging).isSymbolicLink()) {
            throw new Error("Banco temporário ausente.");
        }
        mkdirSync(join(raiz, "database"), { recursive: true });
        iniciouPublicacao = true;
        // Os arquivos são copiados, preservando a área staging para eventual diagnóstico.
        cpSync(area.arquivos, pastaArquivos, { recursive: true, errorOnExist: true, force: false });
        cpSync(bancoStaging, bancoAtivo, { errorOnExist: true, force: false });
        const temporario = join(raiz, "instalacao.json.part");
        writeFileSync(temporario, JSON.stringify({
            format: "quality-desktop-installation",
            version: 1,
            importedAt: new Date().toISOString(),
            importId: area.id,
            source: manifesto.origem,
        }, null, 2), { flag: "wx" });
        renameSync(temporario, marcador);
        return { ativa: true, banco: bancoAtivo, arquivos: pastaArquivos };
    } catch (erro) {
        // Limpeza somente de primeira instalação; nunca remove dados pré-existentes.
        // Em caso de queda abrupta, restos sem marcador bloqueiam nova ativação.
        if (iniciouPublicacao && !existsSync(marcador)) {
            if (existsSync(bancoAtivo)) rmSync(bancoAtivo, { force: true });
            if (existsSync(pastaArquivos)) rmSync(pastaArquivos, { recursive: true, force: true });
            const temporario = join(raiz, "instalacao.json.part");
            if (existsSync(temporario)) rmSync(temporario, { force: true });
        }
        throw erro;
    } finally {
        liberarBloqueioAtivacaoDesktop(bloqueio);
    }
}
