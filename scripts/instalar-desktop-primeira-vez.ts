import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { stdin } from "node:process";
import { obterCaminhosDesktop } from "../src/lib/desktop/storage";
import { criarAreaImportacaoDesktop, descartarAreaImportacaoDesktop } from "../src/lib/desktop/area-importacao";
import { prepararImportacaoCompletaStaging } from "../src/lib/desktop/preparar-importacao-completa";
import { ativarPrimeiraInstalacaoDesktop } from "../src/lib/desktop/ativar-primeira-instalacao";
import { verificarInstalacaoDesktop } from "../src/lib/desktop/instalacao";
import { validarBackupParaStaging } from "../src/lib/desktop/validar-backup-staging";
import type { FonteArquivoImportacao } from "../src/lib/desktop/preparar-importacao-completa";
import type { IntegridadeEsperada } from "../src/lib/desktop/conferir-integridade-esperada";

type Entrada = { origem: string; email: string; senha: string };

async function lerEntrada(): Promise<Entrada> {
    const partes: Buffer[] = [];
    for await (const parte of stdin) {
        partes.push(Buffer.from(parte));
        if (Buffer.concat(partes).length > 64_000) throw new Error("Entrada excessiva.");
    }
    const valor: unknown = JSON.parse(Buffer.concat(partes).toString("utf8"));
    if (!valor || typeof valor !== "object") throw new Error("Credenciais ausentes.");
    const v = valor as Record<string, unknown>;
    if (typeof v.origem !== "string" || typeof v.email !== "string" ||
        typeof v.senha !== "string" || !v.email || !v.senha) {
        throw new Error("Origem, e-mail e senha são obrigatórios.");
    }
    return { origem: v.origem, email: v.email, senha: v.senha };
}

function validarOrigem(valor: string): URL {
    const url = new URL(valor);
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== "https:" &&
         !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) ||
        (url.pathname !== "/" && url.pathname !== "")) {
        throw new Error("Origem inválida. Use HTTPS ou HTTP localhost para testes.");
    }
    return url;
}

async function executar() {
    if (process.platform !== "win32") throw new Error("Instalação disponível apenas no Windows.");
    if (process.env.QUALITY_RUNTIME !== "desktop") throw new Error("QUALITY_RUNTIME=desktop obrigatório.");
    const entrada = await lerEntrada();
    const origem = validarOrigem(entrada.origem);
    const caminhos = obterCaminhosDesktop();
    if (existsSync(join(caminhos.root, "instalacao.json")) ||
        existsSync(caminhos.databaseFile) ||
        existsSync(join(caminhos.root, "arquivos"))) {
        throw new Error("Instalação existente ou incompleta. Não será substituída.");
    }
    const controlador = new AbortController();
    const transporte = async (caminho: string, init: RequestInit = {}) => {
        const timeout = setTimeout(() => controlador.abort(), 120_000);
        try {
            const resposta = await fetch(new URL(caminho, origem), {
                ...init, redirect: "manual", signal: controlador.signal,
            });
            if (resposta.status >= 300 && resposta.status < 400) {
                throw new Error("Redirecionamento inesperado na origem.");
            }
            return resposta;
        } finally {
            clearTimeout(timeout);
        }
    };
    console.log("Autenticando na origem...");
    const login = await transporte("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: entrada.email, password: entrada.senha }),
    });
    if (!login.ok) throw new Error("Login recusado pela origem (HTTP " + login.status + ").");
    const usuario = await login.json() as { usuario?: { perfil?: string } };
    if (!["MASTER", "SUPERVISORA"].includes(usuario.usuario?.perfil ?? "")) {
        throw new Error("Somente MASTER ou SUPERVISORA podem instalar.");
    }
    const cookie = login.headers.get("set-cookie")?.match(/quality_session=([^;]+)/)?.[1];
    if (!cookie) throw new Error("Sessão de autenticação não recebida.");
    const autenticado = (caminho: string) => transporte(caminho, {
        headers: { Cookie: "quality_session=" + cookie },
    });
    console.log("Exportando banco do ambiente conectado...");
    const resposta = await autenticado("/api/desktop/exportacao/dados");
    if (!resposta.ok) throw new Error("Exportação indisponível (HTTP " + resposta.status + ").");
    const payload = await resposta.json() as { success?: boolean; backup?: unknown };
    if (payload.success !== true) throw new Error("Resposta de exportação inválida.");
    validarBackupParaStaging(payload.backup);
    const backup = payload.backup;
    const fonte: FonteArquivoImportacao = async ({ tipo, registroId, referenciaSha256 }) => {
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(registroId) || !/^[a-f0-9]{64}$/.test(referenciaSha256)) {
            throw new Error("Referência inválida.");
        }
        const sufixo = `${tipo}/${encodeURIComponent(registroId)}?referenciaSha256=${referenciaSha256}`;
        const respostaIntegridade = await autenticado("/api/desktop/exportacao/integridade/" + sufixo);
        if (!respostaIntegridade.ok) throw new Error("Integridade indisponível (HTTP " + respostaIntegridade.status + ").");
        const info = await respostaIntegridade.json() as Record<string, unknown>;
        if (info.success !== true || info.tipo !== tipo || info.registroId !== registroId ||
            info.referenciaSha256 !== referenciaSha256 || !Number.isSafeInteger(info.tamanhoBytes) ||
            (info.tamanhoBytes as number) <= 0 || typeof info.sha256 !== "string" ||
            !/^[a-f0-9]{64}$/.test(info.sha256)) throw new Error("Integridade inválida.");
        const integridade: IntegridadeEsperada = {
            tipo, registroId, tamanhoBytes: info.tamanhoBytes as number, sha256: info.sha256,
        };
        const arquivo = await autenticado("/api/desktop/exportacao/arquivo/" + sufixo);
        if (!arquivo.ok || !arquivo.body) throw new Error("Arquivo indisponível (HTTP " + arquivo.status + ").");
        return { stream: arquivo.body, integridade };
    };
    mkdirSync(caminhos.root, { recursive: true });
    const area = criarAreaImportacaoDesktop(caminhos.root);
    try {
        console.log("Restaurando banco e transferindo arquivos para área temporária...");
        const resultado = await prepararImportacaoCompletaStaging(area, backup, fonte);
        console.log("Validando e ativando primeira instalação...");
        await ativarPrimeiraInstalacaoDesktop(caminhos.root, area, resultado.manifesto,
            resultado.plano, resultado.integridades);
        if (!verificarInstalacaoDesktop().pronta) throw new Error("Instalação não foi confirmada.");
        console.log("Instalação offline concluída. Origem: " + backup.source);
    } finally {
        descartarAreaImportacaoDesktop(caminhos.root, area);
    }
}

executar().catch((erro: unknown) => {
    console.error("Falha na instalação:", erro instanceof Error ? erro.message : "Erro desconhecido.");
    process.exitCode = 1;
});
