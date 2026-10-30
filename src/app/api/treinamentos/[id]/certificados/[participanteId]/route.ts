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
        const pagina = pdf.addPage([595.28, 841.89]);
        const largura = pagina.getWidth();
        const azul = rgb(34 / 255, 54 / 255, 91 / 255);
        const vermelho = rgb(194 / 255, 42 / 255, 46 / 255);
        const cinza = rgb(0.32, 0.36, 0.42);

        pagina.drawRectangle({
            x: 28, y: 28, width: largura - 56, height: 785,
            borderColor: azul, borderWidth: 2,
        });
        pagina.drawRectangle({
            x: 36, y: 36, width: largura - 72, height: 769,
            borderColor: vermelho, borderWidth: 0.8,
        });

        try {
            const logoBytes = await readFile(
                path.join(process.cwd(), "public", "icone1.png")
            );
            const logo = await pdf.embedPng(logoBytes);
            const dimensoes = logo.scale(1);
            const escala = Math.min(100 / dimensoes.width, 65 / dimensoes.height, 1);
            pagina.drawImage(logo, {
                x: (largura - dimensoes.width * escala) / 2,
                y: 720,
                width: dimensoes.width * escala,
                height: dimensoes.height * escala,
            });
        } catch (error) {
            console.warn("Não foi possível incorporar o logotipo no certificado:", error);
        }

        pagina.drawText("QUALITY CONSULTORIA EM ALIMENTOS", {
            x: 70, y: 690, size: 12, font: negrito, color: azul,
            maxWidth: largura - 140,
        });
        pagina.drawText("CERTIFICADO DE PARTICIPACAO", {
            x: 70, y: 620, size: 23, font: negrito, color: azul,
            maxWidth: largura - 140,
        });

        pagina.drawText("Certificamos que", {
            x: 70, y: 560, size: 14, font: fonte, color: cinza,
        });
        pagina.drawText(nome, {
            x: 70, y: 515, size: 25, font: negrito, color: azul,
            maxWidth: largura - 140,
        });

        let y = 485;
        if (cargo) {
            pagina.drawText(cargo, {
                x: 70, y, size: 11, font: fonte, color: cinza,
                maxWidth: largura - 140,
            });
            y -= 32;
        } else {
            y -= 12;
        }

        const descricao = `participou do treinamento "${titulo}", realizado em ${data}, com carga horaria de ${Math.floor(carga / 60)} hora(s) e ${carga % 60} minuto(s).`;
        for (const linha of quebrarTexto(descricao, 78)) {
            pagina.drawText(linha, {
                x: 70, y, size: 12, font: fonte, color: cinza,
                maxWidth: largura - 140,
            });
            y -= 21;
        }

        y -= 18;
        pagina.drawText(`Empresa: ${cliente}`, {
            x: 70, y, size: 10, font: fonte, color: cinza,
            maxWidth: largura - 140,
        });
        y -= 18;
        pagina.drawText(`Estabelecimento: ${loja}`, {
            x: 70, y, size: 10, font: fonte, color: cinza,
            maxWidth: largura - 140,
        });
        y -= 18;
        pagina.drawText(`Ministrante: ${ministrante}`, {
            x: 70, y, size: 10, font: fonte, color: cinza,
            maxWidth: largura - 140,
        });

        if (conteudo.trim()) {
            y -= 34;
            pagina.drawText("CONTEUDO PROGRAMATICO", {
                x: 70, y, size: 10, font: negrito, color: azul,
            });
            y -= 18;
            for (const linha of quebrarTexto(textoPdf(conteudo), 85).slice(0, 5)) {
                pagina.drawText(linha, {
                    x: 70, y, size: 9, font: fonte, color: cinza,
                    maxWidth: largura - 140,
                });
                y -= 14;
            }
        }

        pagina.drawLine({
            start: { x: 190, y: 145 },
            end: { x: 405, y: 145 },
            thickness: 1,
            color: azul,
        });
        pagina.drawText(ministrante, {
            x: 100, y: 125, size: 10, font: negrito, color: azul,
            maxWidth: largura - 200,
        });
        pagina.drawText("Responsavel pelo treinamento", {
            x: 100, y: 108, size: 9, font: fonte, color: cinza,
            maxWidth: largura - 200,
        });
        pagina.drawText(`Certificado: ${numero}`, {
            x: 70, y: 65, size: 8, font: fonte, color: cinza,
        });

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
