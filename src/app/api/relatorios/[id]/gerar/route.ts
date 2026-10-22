import { NextResponse } from "next/server";
import { del, get, put } from "@vercel/blob";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";
import {
    calcularResultados,
    type RespostaParaCalculo,
    type ResultadoAuditoria,
    type ResultadoPontuacao,
} from "@/lib/auditorias/calcular-resultados";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ id: string }>;
};

type ItemRelatorio = {
    id: string;
    texto: string;
    orientacao: string | null;
    ordem: number;
    item_vencimento: number | null;
    resposta: {
        resultado: ResultadoAuditoria | null;
        observacao: string | null;
        evidencias: {
            id: string;
            ordem: number;
            arquivo_uri: string;
        }[];
    } | null;
};

type SecaoRelatorio = {
    id: string;
    nome: string;
    descricao: string | null;
    ordem: number;
    itens: ItemRelatorio[];
};

type SetorRelatorio = {
    id: string;
    nome: string;
    checklist_nome: string;
    checklist_versao_numero: number;
    ordem: number;
    secoes: SecaoRelatorio[];
    resultados: ResultadoPontuacao;
};

type Cor = ReturnType<typeof rgb>;

const RESULTADOS_VALIDOS = new Set<ResultadoAuditoria>([
    "CONFORME",
    "PARCIALMENTE_CONFORME",
    "NAO_CONFORME",
    "NAO_APLICAVEL",
]);

const CORES = {
    azul: rgb(0.13, 0.21, 0.36),
    vermelho: rgb(0.76, 0.16, 0.18),
    cinza: rgb(0.35, 0.38, 0.42),
    claro: rgb(0.92, 0.93, 0.95),
    preto: rgb(0.12, 0.13, 0.15),
    branco: rgb(1, 1, 1),
};

function textoSeguro(valor: unknown): string {
    if (valor == null) return "Não informado";

    return String(valor)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[^\x09\x0A\x20-\xFF]/g, "?");
}

function formatarData(valor: unknown): string {
    if (valor == null || String(valor).trim() === "") {
        return "Não informada";
    }

    const data = new Date(String(valor));

    if (Number.isNaN(data.getTime())) {
        return String(valor);
    }

    return data.toLocaleString("pt-BR", {
        timeZone: "America/Fortaleza",
        dateStyle: "short",
        timeStyle: "short",
    });
}

function formatarPercentual(valor: number | null): string {
    if (valor === null || !Number.isFinite(valor)) {
        return "Não calculado";
    }

    return `${valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}%`;
}

function formatarResultado(
    resultado: ResultadoAuditoria | null
): string {
    switch (resultado) {
        case "CONFORME":
            return "Conforme";
        case "PARCIALMENTE_CONFORME":
            return "Parcialmente conforme";
        case "NAO_CONFORME":
            return "Nao conforme";
        case "NAO_APLICAVEL":
            return "Nao aplicavel";
        default:
            return "Pendente";
    }
}

function criarDesenhista(
    pdf: PDFDocument,
    fonte: Awaited<ReturnType<PDFDocument["embedFont"]>>,
    fonteNegrito: Awaited<ReturnType<PDFDocument["embedFont"]>>
) {
    const larguraPagina = 595.28;
    const alturaPagina = 841.89;
    const margem = 42;
    const larguraUtil = larguraPagina - margem * 2;
    const limiteInferior = 45;

    let pagina = pdf.addPage([larguraPagina, alturaPagina]);
    let y = alturaPagina - margem;

    function novaPagina() {
        pagina = pdf.addPage([larguraPagina, alturaPagina]);
        y = alturaPagina - margem;
    }

    function garantirEspaco(alturaNecessaria: number) {
        if (y - alturaNecessaria < limiteInferior) {
            novaPagina();
        }
    }

    function escreverLinha(
        texto: string,
        opcoes?: {
            negrito?: boolean;
            tamanho?: number;
            cor?: Cor;
            recuo?: number;
        }
    ) {
        const tamanho = opcoes?.tamanho ?? 10;
        const recuo = opcoes?.recuo ?? 0;
        const fonteUsada = opcoes?.negrito ? fonteNegrito : fonte;
        const cor = opcoes?.cor ?? CORES.preto;
        const alturaLinha = tamanho + 5;
        const larguraMaxima = larguraUtil - recuo;

        const linhas: string[] = [];
        const paragrafo = textoSeguro(texto);

        for (const bloco of paragrafo.split("\n")) {
            if (!bloco) {
                linhas.push("");
                continue;
            }

            let linhaAtual = "";

            for (const palavra of bloco.split(/\s+/)) {
                const tentativa = linhaAtual
                    ? `${linhaAtual} ${palavra}`
                    : palavra;

                if (
                    linhaAtual &&
                    fonteUsada.widthOfTextAtSize(tentativa, tamanho) >
                    larguraMaxima
                ) {
                    linhas.push(linhaAtual);
                    linhaAtual = palavra;
                } else {
                    linhaAtual = tentativa;
                }
            }

            if (linhaAtual) linhas.push(linhaAtual);
        }

        for (const linha of linhas) {
            garantirEspaco(alturaLinha);

            if (linha) {
                pagina.drawText(linha, {
                    x: margem + recuo,
                    y: y - tamanho,
                    size: tamanho,
                    font: fonteUsada,
                    color: cor,
                    maxWidth: larguraMaxima,
                });
            }

            y -= alturaLinha;
        }
    }

    function espacamento(valor = 6) {
        y -= valor;
        garantirEspaco(0);
    }

    function titulo(texto: string) {
        espacamento(5);
        garantirEspaco(30);

        pagina.drawRectangle({
            x: margem,
            y: y - 21,
            width: larguraUtil,
            height: 25,
            color: CORES.azul,
        });

        pagina.drawText(textoSeguro(texto), {
            x: margem + 9,
            y: y - 14,
            size: 11,
            font: fonteNegrito,
            color: CORES.branco,
            maxWidth: larguraUtil - 18,
        });

        y -= 31;
    }

    function desenharImagem(
        imagem: Awaited<ReturnType<PDFDocument["embedJpg"]>>,
        legenda: string
    ) {
        const maxLargura = Math.min(larguraUtil - 10, 450);
        const maxAltura = 285;
        const dimensoes = imagem.scale(1);
        const escala = Math.min(
            maxLargura / dimensoes.width,
            maxAltura / dimensoes.height,
            1
        );

        const largura = dimensoes.width * escala;
        const altura = dimensoes.height * escala;
        const alturaTotal = altura + 32;

        garantirEspaco(alturaTotal);

        pagina.drawImage(imagem, {
            x: margem + (larguraUtil - largura) / 2,
            y: y - altura,
            width: largura,
            height: altura,
        });

        y -= altura + 5;
        escreverLinha(legenda, {
            tamanho: 8,
            cor: CORES.cinza,
            recuo: 5,
        });
        espacamento(10);
    }

    function rodapes() {
        const paginas = pdf.getPages();

        paginas.forEach((p, indice) => {
            p.drawLine({
                start: { x: margem, y: 30 },
                end: { x: larguraPagina - margem, y: 30 },
                thickness: 0.5,
                color: CORES.claro,
            });

            p.drawText(
                `Relatorio de auditoria | Pagina ${indice + 1} de ${paginas.length}`,
                {
                    x: margem,
                    y: 17,
                    size: 8,
                    font: fonte,
                    color: CORES.cinza,
                }
            );
        });
    }

    return {
        escreverLinha,
        espacamento,
        titulo,
        desenharImagem,
        rodapes,
        getPaginaAtual: () => pagina,
    };
}

export async function POST(
    _request: Request,
    context: RouteContext
) {
    let novoArquivoUri: string | null = null;

    try {
        const auth = await requirePermission("relatorios.gerar");

        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const usuario = auth.usuario;
        const { id } = await context.params;

        if (!id || id.trim() === "") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Identificador da auditoria inválido.",
                },
                { status: 400 }
            );
        }

        const argsAuditoria: string[] = [id];
        let filtroLoja = "";

        if (
            usuario.perfil !== "MASTER" &&
            usuario.perfil !== "SUPERVISORA"
        ) {
            filtroLoja = `
                AND EXISTS (
                    SELECT 1
                    FROM usuario_lojas ul
                    WHERE ul.loja_id = a.loja_id
                      AND ul.usuario_id = ?
                )
            `;
            argsAuditoria.push(usuario.id);
        }

        const auditoriaResult = await db.execute({
            sql: `
                SELECT
                    a.id,
                    a.loja_id,
                    a.auditor_id,
                    a.gerente_loja_nome,
                    a.encarregado_nome,
                    a.gerente_setor_nome,
                    a.criada_em,
                    l.nome AS loja_nome,
                    c.nome_fantasia AS cliente_nome,
                    u.nome AS auditor_nome,
                    av.id AS auditoria_versao_id,
                    av.numero AS versao_numero,
                    av.status AS versao_status,
                    av.criada_em AS versao_criada_em
                FROM auditorias a
                INNER JOIN lojas l ON l.id = a.loja_id
                INNER JOIN clientes c ON c.id = l.cliente_id
                INNER JOIN usuarios u ON u.id = a.auditor_id
                INNER JOIN auditoria_versoes av
                    ON av.auditoria_id = a.id
                WHERE a.id = ?
                  AND av.numero = (
                      SELECT MAX(av2.numero)
                      FROM auditoria_versoes av2
                      WHERE av2.auditoria_id = a.id
                  )
                  AND av.status = 'FINALIZADA'
                  ${filtroLoja}
                LIMIT 1
            `,
            args: argsAuditoria,
        });

        if (auditoriaResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Auditoria finalizada não encontrada ou sem autorização para acessá-la.",
                },
                { status: 404 }
            );
        }

        const auditoria = auditoriaResult.rows[0];
        const versaoId = String(auditoria.auditoria_versao_id);

        const setoresResult = await db.execute({
            sql: `
                SELECT
                    aus.id AS auditoria_setor_id,
                    aus.setor_id,
                    s.nome AS setor_nome,
                    aus.checklist_versao_id,
                    cv.numero AS checklist_versao_numero,
                    c.nome AS checklist_nome,
                    aus.ordem
                FROM auditoria_setores aus
                INNER JOIN setores s ON s.id = aus.setor_id
                INNER JOIN checklist_versoes cv
                    ON cv.id = aus.checklist_versao_id
                INNER JOIN checklists c ON c.id = cv.checklist_id
                WHERE aus.auditoria_versao_id = ?
                ORDER BY aus.ordem
            `,
            args: [versaoId],
        });

        const setores: SetorRelatorio[] = [];
        const resultadosPorSetor: ResultadoPontuacao[] = [];

        for (const setor of setoresResult.rows) {
            const secoesResult = await db.execute({
                sql: `
                    SELECT id, nome, descricao, ordem
                    FROM checklist_secoes
                    WHERE checklist_versao_id = ?
                    ORDER BY ordem
                `,
                args: [String(setor.checklist_versao_id)],
            });

            const secoes: SecaoRelatorio[] = [];
            const respostasParaCalculo: RespostaParaCalculo[] = [];

            for (const secao of secoesResult.rows) {
                const itensResult = await db.execute({
                    sql: `
                        SELECT
                            ci.id,
                            ci.texto,
                            ci.orientacao,
                            ci.ordem,
                            ci.item_vencimento,
                            ar.id AS resposta_id,
                            ar.resultado,
                            ar.observacao
                        FROM checklist_itens ci
                        LEFT JOIN auditoria_respostas ar
                            ON ar.checklist_item_id = ci.id
                           AND ar.auditoria_setor_id = ?
                        WHERE ci.checklist_secao_id = ?
                          AND ci.ativo = 1
                        ORDER BY ci.ordem
                    `,
                    args: [
                        String(setor.auditoria_setor_id),
                        String(secao.id),
                    ],
                });

                const itens: ItemRelatorio[] = [];

                for (const item of itensResult.rows) {
                    const resultadoBruto =
                        item.resultado == null
                            ? null
                            : String(item.resultado);

                    const resultadoValido =
                        resultadoBruto !== null &&
                            RESULTADOS_VALIDOS.has(
                                resultadoBruto as ResultadoAuditoria
                            )
                            ? (resultadoBruto as ResultadoAuditoria)
                            : null;

                    respostasParaCalculo.push({
                        checklist_item_id: String(item.id),
                        resultado: resultadoValido,
                        item_vencimento:
                            item.item_vencimento == null
                                ? null
                                : Number(item.item_vencimento),
                    });

                    const evidencias: ItemRelatorio["resposta"] extends infer R
                        ? R extends { evidencias: infer E }
                        ? E
                        : never
                        : never = [];

                    const exigeEvidencias =
                        resultadoValido === "NAO_CONFORME" ||
                        resultadoValido === "PARCIALMENTE_CONFORME";

                    if (item.resposta_id != null && exigeEvidencias) {
                        const evidenciasResult = await db.execute({
                            sql: `
            SELECT id, ordem, arquivo_uri
            FROM evidencias
            WHERE resposta_id = ?
            ORDER BY ordem
        `,
                            args: [String(item.resposta_id)],
                        });

                        evidencias.push(
                            ...evidenciasResult.rows.map((e) => ({
                                id: String(e.id),
                                ordem: Number(e.ordem),
                                arquivo_uri: String(e.arquivo_uri),
                            }))
                        );
                    }

                    itens.push({
                        id: String(item.id),
                        texto: String(item.texto),
                        orientacao:
                            item.orientacao == null
                                ? null
                                : String(item.orientacao),
                        ordem: Number(item.ordem),
                        item_vencimento:
                            item.item_vencimento == null
                                ? null
                                : Number(item.item_vencimento),
                        resposta:
                            item.resposta_id == null
                                ? null
                                : {
                                    resultado: resultadoValido,
                                    observacao:
                                        resultadoValido === "NAO_CONFORME" ||
                                            resultadoValido === "PARCIALMENTE_CONFORME"
                                            ? item.observacao == null
                                                ? null
                                                : String(item.observacao)
                                            : null,
                                    evidencias,
                                },
                    });
                }

                secoes.push({
                    id: String(secao.id),
                    nome: String(secao.nome),
                    descricao:
                        secao.descricao == null
                            ? null
                            : String(secao.descricao),
                    ordem: Number(secao.ordem),
                    itens,
                });
            }

            const resultados = calcularResultados(respostasParaCalculo);
            resultadosPorSetor.push(resultados);

            setores.push({
                id: String(setor.auditoria_setor_id),
                nome: String(setor.setor_nome),
                checklist_nome: String(setor.checklist_nome),
                checklist_versao_numero: Number(
                    setor.checklist_versao_numero
                ),
                ordem: Number(setor.ordem),
                secoes,
                resultados,
            });
        }

        const resultadosGerais: ResultadoPontuacao = {
            totalItens: 0,
            totalRespondidos: 0,
            totalConformes: 0,
            totalParcialmenteConformes: 0,
            totalNaoConformes: 0,
            totalNaoAplicaveis: 0,
            totalPendentes: 0,
            pontosObtidos: 0,
            maximoAplicavel: 0,
            percentual: null,
            alertaAbaixoDe60: false,
        };

        let somaPonderada = 0;
        let denominador = 0;

        for (const resultado of resultadosPorSetor) {
            resultadosGerais.totalItens += resultado.totalItens;
            resultadosGerais.totalRespondidos += resultado.totalRespondidos;
            resultadosGerais.totalConformes += resultado.totalConformes;
            resultadosGerais.totalParcialmenteConformes +=
                resultado.totalParcialmenteConformes;
            resultadosGerais.totalNaoConformes += resultado.totalNaoConformes;
            resultadosGerais.totalNaoAplicaveis +=
                resultado.totalNaoAplicaveis;
            resultadosGerais.totalPendentes += resultado.totalPendentes;
            resultadosGerais.pontosObtidos += resultado.pontosObtidos;
            resultadosGerais.maximoAplicavel += resultado.maximoAplicavel;

            if (
                resultado.percentual !== null &&
                resultado.maximoAplicavel > 0
            ) {
                somaPonderada +=
                    resultado.percentual * resultado.maximoAplicavel;
                denominador += resultado.maximoAplicavel;
            }
        }

        if (denominador > 0) {
            resultadosGerais.percentual = somaPonderada / denominador;
            resultadosGerais.alertaAbaixoDe60 =
                resultadosGerais.percentual < 60;
        }

        const pdf = await PDFDocument.create();
        pdf.setTitle(
            `Relatorio de auditoria - ${textoSeguro(auditoria.loja_nome)}`
        );
        pdf.setSubject("Relatorio de auditoria de qualidade");
        pdf.setCreator("Quality Auditoria");

        const fonte = await pdf.embedFont(StandardFonts.Helvetica);
        const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);

        const desenho = criarDesenhista(pdf, fonte, fonteNegrito);

        desenho.escreverLinha("RELATORIO DE AUDITORIA", {
            tamanho: 19,
            negrito: true,
            cor: CORES.azul,
        });
        desenho.escreverLinha(
            `Versao da auditoria: ${Number(auditoria.versao_numero)}`,
            { tamanho: 10, cor: CORES.cinza }
        );
        desenho.espacamento(10);

        desenho.titulo("IDENTIFICACAO");
        desenho.escreverLinha(`Cliente: ${textoSeguro(auditoria.cliente_nome)}`);
        desenho.escreverLinha(`Loja: ${textoSeguro(auditoria.loja_nome)}`);
        desenho.escreverLinha(`Auditor: ${textoSeguro(auditoria.auditor_nome)}`);
        desenho.escreverLinha(
            `Gerente da Loja: ${textoSeguro(auditoria.gerente_loja_nome)}`
        );
        desenho.escreverLinha(
            `Encarregado do Setor: ${textoSeguro(auditoria.encarregado_nome)}`
        );
        desenho.escreverLinha(
            `Gerente do Setor: ${textoSeguro(auditoria.gerente_setor_nome)}`
        );
        desenho.escreverLinha(
            `Data da auditoria: ${formatarData(auditoria.criada_em)}`
        );
        desenho.escreverLinha(
            `Data da finalizacao: ${formatarData(auditoria.versao_criada_em)}`
        );

        desenho.titulo("RESULTADO GERAL");
        desenho.escreverLinha(
            `Pontuacao: ${formatarPercentual(resultadosGerais.percentual)}`,
            {
                tamanho: 16,
                negrito: true,
                cor:
                    resultadosGerais.percentual !== null &&
                        resultadosGerais.percentual < 60
                        ? CORES.vermelho
                        : CORES.azul,
            }
        );
        desenho.escreverLinha(
            `Pontos obtidos: ${resultadosGerais.pontosObtidos.toLocaleString("pt-BR")} de ${resultadosGerais.maximoAplicavel.toLocaleString("pt-BR")}`
        );
        desenho.escreverLinha(
            `Itens: ${resultadosGerais.totalItens} | Respondidos: ${resultadosGerais.totalRespondidos} | Pendentes: ${resultadosGerais.totalPendentes}`
        );
        desenho.escreverLinha(
            `Conformes: ${resultadosGerais.totalConformes} | Parciais: ${resultadosGerais.totalParcialmenteConformes} | Nao conformes: ${resultadosGerais.totalNaoConformes} | Nao aplicaveis: ${resultadosGerais.totalNaoAplicaveis}`
        );

        desenho.titulo("RESULTADOS POR SETOR");

        for (const setor of setores) {
            desenho.escreverLinha(setor.nome, {
                tamanho: 12,
                negrito: true,
                cor: CORES.azul,
            });
            desenho.escreverLinha(
                `Checklist: ${setor.checklist_nome} (versao ${setor.checklist_versao_numero})`
            );
            desenho.escreverLinha(
                `Pontuacao: ${formatarPercentual(setor.resultados.percentual)}`
            );
            desenho.escreverLinha(
                `Pontos: ${setor.resultados.pontosObtidos} de ${setor.resultados.maximoAplicavel}`
            );
            desenho.espacamento(5);
        }

        desenho.titulo("DETALHAMENTO DOS ITENS");

        for (const setor of setores) {
            desenho.escreverLinha(setor.nome, {
                tamanho: 13,
                negrito: true,
                cor: CORES.azul,
            });

            for (const secao of setor.secoes) {
                desenho.escreverLinha(secao.nome, {
                    tamanho: 11,
                    negrito: true,
                });

                if (secao.descricao) {
                    desenho.escreverLinha(secao.descricao, {
                        tamanho: 9,
                        cor: CORES.cinza,
                    });
                }

                for (const item of secao.itens) {
                    desenho.escreverLinha(
                        `${item.ordem}. ${item.texto}`,
                        { negrito: true, recuo: 8 }
                    );

                    desenho.escreverLinha(
                        `Resultado: ${formatarResultado(item.resposta?.resultado ?? null)}`,
                        {
                            recuo: 16,
                            cor:
                                item.resposta?.resultado === "NAO_CONFORME"
                                    ? CORES.vermelho
                                    : CORES.preto,
                        }
                    );

                    if (item.orientacao) {
                        desenho.escreverLinha(
                            `Orientacao: ${item.orientacao}`,
                            { tamanho: 9, recuo: 16, cor: CORES.cinza }
                        );
                    }

                    if (item.resposta?.observacao) {
                        desenho.escreverLinha(
                            `Observacao: ${item.resposta.observacao}`,
                            { recuo: 16 }
                        );
                    }

                    if (item.item_vencimento === 1) {
                        desenho.escreverLinha(
                            "Item sujeito a vencimento/criterio critico.",
                            { tamanho: 9, recuo: 16, cor: CORES.vermelho }
                        );
                    }

                    desenho.espacamento(5);

                    for (const evidencia of item.resposta?.evidencias ?? []) {
                        const blob = await get(evidencia.arquivo_uri, {
                            access: "private",
                        });

                        if (!blob) {
                            desenho.escreverLinha(
                                `Evidencia ${evidencia.ordem}: imagem indisponivel.`,
                                { tamanho: 9, recuo: 16, cor: CORES.vermelho }
                            );
                            continue;
                        }

                        try {
                            const bytes = Buffer.from(
                                await new Response(blob.stream).arrayBuffer()
                            );

                            let imagem:
                                | Awaited<ReturnType<typeof pdf.embedJpg>>
                                | Awaited<ReturnType<typeof pdf.embedPng>>;

                            const contentType =
                                blob.blob.contentType?.toLowerCase() ?? "";

                            if (
                                contentType.includes("jpeg") ||
                                contentType.includes("jpg")
                            ) {
                                imagem = await pdf.embedJpg(bytes);
                            } else if (contentType.includes("png")) {
                                imagem = await pdf.embedPng(bytes);
                            } else if (contentType.includes("webp")) {
                                const png = await sharp(bytes)
                                    .rotate()
                                    .png()
                                    .toBuffer();

                                imagem = await pdf.embedPng(png);
                            } else {
                                throw new Error(
                                    `Formato de evidencia nao suportado: ${contentType}`
                                );
                            }

                            desenho.desenharImagem(
                                imagem,
                                `Evidencia ${evidencia.ordem} - ${item.texto}`
                            );
                        } catch (error) {
                            console.error(
                                "Erro ao incorporar evidencia no PDF:",
                                evidencia.id,
                                error
                            );

                            desenho.escreverLinha(
                                `Evidencia ${evidencia.ordem}: nao foi possivel incorporar a imagem.`,
                                { tamanho: 9, recuo: 16, cor: CORES.vermelho }
                            );
                        }
                    }
                }

                desenho.espacamento(8);
            }
        }

        desenho.rodapes();

        const bytesPdf = await pdf.save();
        const caminho = `relatorios/${id}/${versaoId}/${Date.now()}.pdf`;

        const arquivo = await put(caminho, Buffer.from(bytesPdf), {
            access: "private",
            addRandomSuffix: true,
            contentType: "application/pdf",
        });

        novoArquivoUri = arquivo.url;

        const registroAnterior = await db.execute({
            sql: `
                SELECT arquivo_uri
                FROM relatorios
                WHERE auditoria_versao_id = ?
                LIMIT 1
            `,
            args: [versaoId],
        });

        const uriAnterior =
            registroAnterior.rows.length > 0 &&
                registroAnterior.rows[0].arquivo_uri != null
                ? String(registroAnterior.rows[0].arquivo_uri)
                : null;

        await db.execute({
            sql: `
                INSERT INTO relatorios (
                    id,
                    auditoria_versao_id,
                    arquivo_uri,
                    gerado_em,
                    gerado_por
                )
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
                ON CONFLICT(auditoria_versao_id) DO UPDATE SET
                    arquivo_uri = excluded.arquivo_uri,
                    gerado_em = CURRENT_TIMESTAMP,
                    gerado_por = excluded.gerado_por
            `,
            args: [
                randomUUID(),
                versaoId,
                arquivo.url,
                usuario.id,
            ],
        });

        if (uriAnterior && uriAnterior !== arquivo.url) {
            try {
                await del(uriAnterior);
            } catch (error) {
                console.error(
                    "Nao foi possivel excluir o PDF anterior:",
                    error
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: "Relatorio PDF gerado e registrado com sucesso.",
        });
    } catch (error) {
        if (novoArquivoUri) {
            try {
                await del(novoArquivoUri);
            } catch (erroExclusao) {
                console.error(
                    "Erro ao limpar PDF apos falha:",
                    erroExclusao
                );
            }
        }

        console.error("Erro ao gerar relatorio PDF:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Nao foi possivel gerar o relatorio PDF.",
            },
            { status: 500 }
        );
    }
}