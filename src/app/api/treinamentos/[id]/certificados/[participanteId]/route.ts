import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";

import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ id: string; participanteId: string }>;
};

function textoPdf(valor: unknown): string {
    return String(valor ?? "Não informado")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, " ");
}

function quebrarTexto(texto: string, limite = 88): string[] {
    const palavras = texto.split(/\s+/);
    const linhas: string[] = [];
    let atual = "";

    for (const palavra of palavras) {
        const tentativa = atual ? `${atual} ${palavra}` : palavra;
        if (tentativa.length > limite && atual) {
            linhas.push(atual);
            atual = palavra;
        } else {
            atual = tentativa;
        }
    }

    if (atual) linhas.push(atual);
    return linhas;
}

async function podeAcessarLoja(
    lojaId: string,
    usuario: { id: string; perfil: string }
) {
    if (usuario.perfil === "MASTER" || usuario.perfil === "SUPERVISORA") {
        const result = await db.execute({
            sql: "SELECT id FROM lojas WHERE id = ? LIMIT 1",
            args: [lojaId],
        });
        return result.rows.length > 0;
    }

    const result = await db.execute({
        sql: `
            SELECT 1 FROM usuario_lojas
            WHERE loja_id = ? AND usuario_id = ? LIMIT 1
        `,
        args: [lojaId, usuario.id],
    });
    return result.rows.length > 0;
}

export async function POST(
    _request: Request,
    context: RouteContext
) {
    let arquivoUri: string | null = null;

    try {
        const auth = await requirePermission("certificados.gerar");
        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        if (
            auth.usuario.perfil !== "MASTER" &&
            auth.usuario.perfil !== "SUPERVISORA"
        ) {
            return forbiddenResponse();
        }

        const { id: treinamentoId, participanteId } = await context.params;
        if (!treinamentoId?.trim() || !participanteId?.trim()) {
            return NextResponse.json(
                { success: false, message: "Treinamento ou participante inválido." },
                { status: 400 }
            );
        }

        const participanteResult = await db.execute({
            sql: `
                SELECT
                    tc.id AS participante_id,
                    tc.nome_colaborador_snapshot,
                    tc.cargo_snapshot,
                    t.id AS treinamento_id,
                    t.titulo,
                    t.data_realizacao,
                    t.carga_horaria_minutos,
                    t.conteudo_programatico,
                    t.ministrante,
                    l.id AS loja_id,
                    l.nome AS loja_nome,
                    c.nome_fantasia AS cliente_nome
                FROM treinamento_colaboradores tc
                INNER JOIN treinamentos t ON t.id = tc.treinamento_id
                INNER JOIN lojas l ON l.id = t.loja_id
                INNER JOIN clientes c ON c.id = l.cliente_id
                WHERE t.id = ?
                  AND tc.id = ?
                LIMIT 1
            `,
            args: [treinamentoId, participanteId],
        });

        if (participanteResult.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Participante não encontrado neste treinamento." },
                { status: 404 }
            );
        }

        const participante = participanteResult.rows[0];
        const lojaId = String(participante.loja_id);

        if (!(await podeAcessarLoja(lojaId, auth.usuario))) {
            return forbiddenResponse();
        }

        const existente = await db.execute({
            sql: "SELECT id, numero FROM certificados WHERE treinamento_colaborador_id = ? LIMIT 1",
            args: [participanteId],
        });

        if (existente.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Já existe um certificado emitido para este participante.",
                    certificadoId: String(existente.rows[0].id),
                    numero: String(existente.rows[0].numero),
                },
                { status: 409 }
            );
        }

        const certificadoId = randomUUID();
        const numero = `QTY-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const nome = textoPdf(participante.nome_colaborador_snapshot);
        const cargo = participante.cargo_snapshot == null
            ? ""
            : textoPdf(participante.cargo_snapshot);
        const titulo = textoPdf(participante.titulo);
        const loja = textoPdf(participante.loja_nome);
        const cliente = textoPdf(participante.cliente_nome);
        const ministrante = textoPdf(participante.ministrante);
        const data = textoPdf(participante.data_realizacao);
        const carga = Number(participante.carga_horaria_minutos);
        const conteudo = participante.conteudo_programatico == null
            ? ""
            : String(participante.conteudo_programatico);

        const pdf = await PDFDocument.create();
        pdf.setTitle(`Certificado ${numero} - ${nome}`);
        pdf.setAuthor("Quality Consultoria em Alimentos");
        pdf.setCreator("Quality Auditoria");

        const fonte = await pdf.embedFont(StandardFonts.Helvetica);
        const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

        // A4 horizontal (paisagem), conforme o modelo de certificado.
        const pagina = pdf.addPage([841.89, 595.28]);
        const largura = pagina.getWidth();
        const altura = pagina.getHeight();
        const azul = rgb(34 / 255, 54 / 255, 91 / 255);
        const vermelho = rgb(194 / 255, 42 / 255, 46 / 255);
        const cinza = rgb(0.32, 0.36, 0.42);
        const dourado = rgb(0.72, 0.58, 0.32);
        const branco = rgb(1, 1, 1);

        const centralizar = (texto: string, y: number, tamanho: number, font = fonte, cor = azul) => {
            let size = tamanho;
            while (size > 7 && font.widthOfTextAtSize(texto, size) > largura - 150) size -= 0.5;
            const w = font.widthOfTextAtSize(texto, size);
            pagina.drawText(texto, { x: (largura - w) / 2, y, size, font, color: cor });
        };
        const textoLimitado = (texto: string, x: number, y: number, maxWidth: number, tamanho: number, font = fonte, cor = cinza) => {
            let size = tamanho;
            while (size > 7 && font.widthOfTextAtSize(texto, size) > maxWidth) size -= 0.5;
            pagina.drawText(texto, { x, y, size, font, color: cor, maxWidth });
        };

        pagina.drawRectangle({ x: 0, y: 0, width: largura, height: altura, color: branco });
        pagina.drawRectangle({ x: 20, y: 20, width: largura - 40, height: altura - 40, borderColor: azul, borderWidth: 4 });
        pagina.drawRectangle({ x: 29, y: 29, width: largura - 58, height: altura - 58, borderColor: vermelho, borderWidth: 1 });

        // Detalhes diagonais nos cantos, mantendo a paleta institucional.
        pagina.drawLine({ start: { x: 30, y: 485 }, end: { x: 145, y: 565 }, thickness: 17, color: azul });
        pagina.drawLine({ start: { x: 30, y: 507 }, end: { x: 112, y: 565 }, thickness: 5, color: vermelho });
        pagina.drawLine({ start: { x: 700, y: 30 }, end: { x: 815, y: 108 }, thickness: 17, color: azul });
        pagina.drawLine({ start: { x: 750, y: 30 }, end: { x: 815, y: 74 }, thickness: 5, color: vermelho });

        // Logotipo institucional.
        try {
            const logoBytes = await readFile(path.join(process.cwd(), "public", "icone1.png"));
            const logo = await pdf.embedPng(logoBytes);
            const d = logo.scale(1);
            const escala = Math.min(72 / d.width, 48 / d.height, 1);
            pagina.drawImage(logo, { x: 58, y: 490, width: d.width * escala, height: d.height * escala });
        } catch (error) {
            console.warn("Não foi possível incorporar o logotipo no certificado:", error);
        }

        textoLimitado("QUALITY CONSULTORIA EM ALIMENTOS", 145, 518, 330, 12, negrito, azul);
        centralizar("CERTIFICADO", 421, 34, negrito, azul);
        pagina.drawLine({ start: { x: 335, y: 409 }, end: { x: 507, y: 409 }, thickness: 2, color: vermelho });
        centralizar("Certificamos que", 382, 13, fonte, cinza);
        centralizar(nome, 338, 26, negrito, azul);
        if (cargo) centralizar(cargo, 316, 10, fonte, cinza);
        centralizar("participou do treinamento", 286, 12, fonte, cinza);
        centralizar(titulo, 258, 18, negrito, azul);
        centralizar(`realizado em ${data}`, 234, 11, fonte, cinza);

        // Dados complementares em uma faixa horizontal.
        pagina.drawLine({ start: { x: 75, y: 198 }, end: { x: 767, y: 198 }, thickness: 1, color: dourado });
        const dados = [
            { x: 92, w: 175, label: "EMPRESA / LOJA", value: `${cliente} - ${loja}` },
            { x: 292, w: 125, label: "CARGA HORÁRIA", value: `${Math.floor(carga / 60)}h ${carga % 60}min` },
            { x: 450, w: 125, label: "MINISTRANTE", value: ministrante },
            { x: 608, w: 150, label: "CERTIFICADO", value: numero },
        ];
        for (let i = 0; i < dados.length; i++) {
            const item = dados[i];
            if (i > 0) pagina.drawLine({ start: { x: item.x - 15, y: 112 }, end: { x: item.x - 15, y: 187 }, thickness: 0.8, color: dourado });
            textoLimitado(item.label, item.x, 174, item.w, 8, negrito, azul);
            for (const [linha, indice] of quebrarTexto(item.value, 27).slice(0, 2).map((v, idx) => [v, idx] as const)) {
                textoLimitado(linha, item.x, 151 - indice * 13, item.w, 9, fonte, cinza);
            }
        }

        if (conteudo.trim()) {
            textoLimitado(`CONTEÚDO PROGRAMÁTICO: ${textoPdf(conteudo)}`, 92, 91, 650, 8, fonte, cinza);
        }

        // Assinaturas lado a lado, como no modelo de referência.
        pagina.drawLine({ start: { x: 175, y: 65 }, end: { x: 390, y: 65 }, thickness: 1, color: azul });
        pagina.drawLine({ start: { x: 452, y: 65 }, end: { x: 667, y: 65 }, thickness: 1, color: azul });
        centralizar("RESPONSÁVEL PELO TREINAMENTO", 49, 8, negrito, azul);
        textoLimitado("PARTICIPANTE", 520, 49, 100, 8, negrito, azul);
        const bytes = Buffer.from(await pdf.save());
        const caminho = `certificados/${lojaId}/${certificadoId}.pdf`;
        const arquivo = await put(caminho, bytes, {
            access: "private",
            addRandomSuffix: true,
            contentType: "application/pdf",
        });
        arquivoUri = arquivo.url;

        try {
            await db.execute({
                sql: `
                    INSERT INTO certificados (
                        id,
                        treinamento_colaborador_id,
                        numero,
                        nome_colaborador,
                        cargo_colaborador,
                        nome_loja,
                        nome_cliente,
                        titulo_treinamento,
                        data_realizacao,
                        carga_horaria_minutos,
                        conteudo_programatico,
                        ministrante,
                        emitido_por,
                        arquivo_uri
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    certificadoId,
                    participanteId,
                    numero,
                    String(participante.nome_colaborador_snapshot),
                    participante.cargo_snapshot == null ? null : String(participante.cargo_snapshot),
                    String(participante.loja_nome),
                    String(participante.cliente_nome),
                    String(participante.titulo),
                    String(participante.data_realizacao),
                    carga,
                    participante.conteudo_programatico == null ? null : String(participante.conteudo_programatico),
                    String(participante.ministrante),
                    auth.usuario.id,
                    arquivoUri,
                ],
            });
        } catch (error) {
            await del(arquivoUri);
            arquivoUri = null;
            throw error;
        }

        return NextResponse.json(
            {
                success: true,
                message: "Certificado emitido com sucesso.",
                certificado: {
                    id: certificadoId,
                    numero,
                    nomeColaborador: nome,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao emitir certificado:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível emitir o certificado." },
            { status: 500 }
        );
    }
}
