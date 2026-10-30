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
            sql: "SELECT id, numero, arquivo_uri FROM certificados WHERE treinamento_colaborador_id = ? LIMIT 1",
            args: [participanteId],
        });

        const certificadoExistente = existente.rows[0] ?? null;
        const certificadoId = certificadoExistente
            ? String(certificadoExistente.id)
            : randomUUID();
        const numero = certificadoExistente
            ? String(certificadoExistente.numero)
            : `QTY-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const arquivoAnteriorUri = certificadoExistente?.arquivo_uri == null
            ? null
            : String(certificadoExistente.arquivo_uri);
        const nome = textoPdf(participante.nome_colaborador_snapshot);
        const cargo = participante.cargo_snapshot == null
            ? ""
            : textoPdf(participante.cargo_snapshot);
        const titulo = textoPdf(participante.titulo);
        const loja = textoPdf(participante.loja_nome);
        const cliente = textoPdf(participante.cliente_nome);
        const ministrante = textoPdf(participante.ministrante);
        const dataOriginal = String(participante.data_realizacao ?? "");
        const dataMatch = dataOriginal.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
        const data = dataMatch
            ? `${dataMatch[3]}/${dataMatch[2]}/${dataMatch[1]}`
            : textoPdf(dataOriginal);
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

        // A4 horizontal (paisagem), com composição limpa e medalha institucional.
        const pagina = pdf.addPage([841.89, 595.28]);
        const largura = pagina.getWidth();
        const azul = rgb(34 / 255, 54 / 255, 91 / 255);
        const vermelho = rgb(194 / 255, 42 / 255, 46 / 255);
        const cinza = rgb(0.25, 0.29, 0.36);
        const branco = rgb(1, 1, 1);

        const centralizar = (texto: string, y: number, tamanho: number, font = fonte, cor = azul, centro = largura / 2, limite = largura - 120) => {
            let size = tamanho;
            while (size > 7 && font.widthOfTextAtSize(texto, size) > limite) size -= 0.5;
            const w = font.widthOfTextAtSize(texto, size);
            pagina.drawText(texto, { x: centro - w / 2, y, size, font, color: cor });
        };
        const textoLimitado = (texto: string, x: number, y: number, maxWidth: number, tamanho: number, font = fonte, cor = cinza) => {
            let size = tamanho;
            while (size > 7 && font.widthOfTextAtSize(texto, size) > maxWidth) size -= 0.5;
            pagina.drawText(texto, { x, y, size, font, color: cor, maxWidth });
        };

        pagina.drawRectangle({ x: 0, y: 0, width: largura, height: 595.28, color: branco });
        // Moldura dupla discreta; sem diagonais atravessando o conteúdo.
        pagina.drawRectangle({ x: 18, y: 18, width: largura - 36, height: 559.28, borderColor: azul, borderWidth: 5 });
        pagina.drawRectangle({ x: 27, y: 27, width: largura - 54, height: 541.28, borderColor: azul, borderWidth: 1 });
        // Moldura decorativa PNG transparente, nas cores da identidade Quality.
        try {
            const molduraBytes = await readFile(path.join(process.cwd(), "public", "moldura.png"));
            const moldura = await pdf.embedPng(molduraBytes);
            pagina.drawImage(moldura, {
                x: 18,
                y: 18,
                width: largura - 36,
                height: 559.28,
            });
        } catch (error) {
            console.warn("Não foi possível incorporar public/moldura.png no certificado:", error);
        }

        // Logotipo maior no topo esquerdo.
        try {
            const logoBytes = await readFile(path.join(process.cwd(), "public", "icone1.png"));
            const logo = await pdf.embedPng(logoBytes);
            const escala = Math.min(132 / logo.width, 66 / logo.height);
            // Alinha o centro vertical do logotipo ao centro da medalha.
            pagina.drawImage(logo, { x: 62, y: 405, width: logo.width * escala, height: logo.height * escala });
        } catch (error) {
            console.warn("Não foi possível incorporar o logotipo no certificado:", error);
            textoLimitado("QUALITY CONSULTORIA EM ALIMENTOS", 62, 518, 300, 15, negrito, azul);
        }

        // Medalha PNG transparente enviada para public/Medalha.png.
        try {
            const medalhaBytes = await readFile(path.join(process.cwd(), "public", "Medalha.png"));
            const medalha = await pdf.embedPng(medalhaBytes);
            const escala = Math.min(112 / medalha.width, 132 / medalha.height);
            pagina.drawImage(medalha, {
                x: 738 - (medalha.width * escala) / 2,
                y: 438 - (medalha.height * escala) / 2,
                width: medalha.width * escala,
                height: medalha.height * escala,
            });
        } catch (error) {
            console.warn("Não foi possível incorporar public/Medalha.png no certificado:", error);
        }

        centralizar("CERTIFICADO", 398, 36, negrito, azul, 430, 520);
        pagina.drawLine({ start: { x: 300, y: 384 }, end: { x: 560, y: 384 }, thickness: 1.8, color: vermelho });
        centralizar("CERTIFICAMOS QUE", 360, 12, negrito, azul, 430, 500);
        centralizar(nome, 319, 27, negrito, azul, 430, 650);
        if (cargo) centralizar(cargo, 300, 9, fonte, cinza, 430, 560);
        centralizar("PARTICIPOU DO TREINAMENTO", 272, 11, negrito, azul, 430, 540);
        centralizar(titulo, 242, 19, negrito, azul, 430, 690);
        centralizar(`REALIZADO EM ${data}`, 219, 10, fonte, cinza, 430, 500);

        // Quatro campos informativos com divisórias verticais regulares.
        pagina.drawLine({ start: { x: 72, y: 197 }, end: { x: 770, y: 197 }, thickness: 1, color: azul });
        const dados = [
            { x: 82, w: 164, label: "EMPRESA / LOJA", value: `${cliente} - ${loja}` },
            { x: 270, w: 125, label: "CARGA HORÁRIA", value: `${Math.floor(carga / 60)}h ${carga % 60}min` },
            { x: 425, w: 140, label: "MINISTRANTE", value: ministrante },
            { x: 595, w: 160, label: "Nº DO CERTIFICADO", value: numero },
        ];
        for (let i = 0; i < dados.length; i++) {
            const item = dados[i];
            if (i > 0) pagina.drawLine({ start: { x: item.x - 13, y: 112 }, end: { x: item.x - 13, y: 184 }, thickness: 0.8, color: azul });
            textoLimitado(item.label, item.x, 174, item.w, 8, negrito, azul);
            const linhas = quebrarTexto(item.value, 25).slice(0, 2);
            linhas.forEach((linha, indice) => textoLimitado(linha, item.x, 151 - indice * 13, item.w, 9, fonte, cinza));
        }

        if (conteudo.trim()) {
            const linhasConteudo = quebrarTexto(`CONTEÚDO: ${textoPdf(conteudo)}`, 105).slice(0, 2);
            linhasConteudo.forEach((linha, indice) => centralizar(linha, 91 - indice * 11, 7.5, fonte, cinza, 430, 680));
        }

        // Assinaturas: o nome fica imediatamente abaixo da linha correspondente.
        const linhaY = 76;
        pagina.drawLine({ start: { x: 145, y: linhaY }, end: { x: 390, y: linhaY }, thickness: 1.2, color: azul });
        pagina.drawLine({ start: { x: 452, y: linhaY }, end: { x: 697, y: linhaY }, thickness: 1.2, color: azul });
        centralizar(ministrante, 59, 9, negrito, azul, 267, 235);
        centralizar("RESPONSÁVEL PELO TREINAMENTO", 45, 7.5, fonte, cinza, 267, 235);
        centralizar(nome, 59, 9, negrito, azul, 574, 235);
        centralizar("PARTICIPANTE", 45, 7.5, fonte, cinza, 574, 235);

        const bytes = Buffer.from(await pdf.save());
        const caminho = `certificados/${lojaId}/${certificadoId}.pdf`;
        const arquivo = await put(caminho, bytes, {
            access: "private",
            addRandomSuffix: true,
            contentType: "application/pdf",
        });
        arquivoUri = arquivo.url;

        try {
            if (certificadoExistente) {
                await db.execute({
                    sql: `
                        UPDATE certificados
                        SET
                            nome_colaborador = ?,
                            cargo_colaborador = ?,
                            nome_loja = ?,
                            nome_cliente = ?,
                            titulo_treinamento = ?,
                            data_realizacao = ?,
                            carga_horaria_minutos = ?,
                            conteudo_programatico = ?,
                            ministrante = ?,
                            emitido_por = ?,
                            arquivo_uri = ?
                        WHERE id = ?
                          AND treinamento_colaborador_id = ?
                    `,
                    args: [
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
                        certificadoId,
                        participanteId,
                    ],
                });
            } else {
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
            }
        } catch (error) {
            await del(arquivoUri);
            arquivoUri = null;
            throw error;
        }

        // Só remove o PDF antigo depois que o novo foi salvo e registrado no banco.
        if (arquivoAnteriorUri && arquivoAnteriorUri !== arquivoUri) {
            try {
                await del(arquivoAnteriorUri);
            } catch (error) {
                console.error("Não foi possível excluir o PDF anterior do Blob:", error);
            }
        }

        return NextResponse.json(
            {
                success: true,
                message: certificadoExistente
                    ? "Certificado regenerado com sucesso."
                    : "Certificado emitido com sucesso.",
                certificado: {
                    id: certificadoId,
                    numero,
                    nomeColaborador: nome,
                    regenerado: Boolean(certificadoExistente),
                },
            },
            { status: certificadoExistente ? 200 : 201 }
        );
    } catch (error) {
        console.error("Erro ao emitir certificado:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível emitir o certificado." },
            { status: 500 }
        );
    }
}
