import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: Request,
    context: RouteContext
) {
    try {
        const auth = await requirePermission("relatorios.baixar");

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

        const args: string[] = [id];
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
            args.push(usuario.id);
        }

        const result = await db.execute({
            sql: `
                SELECT
                    r.arquivo_uri,
                    r.gerado_em,
                    l.nome AS loja_nome
                FROM auditorias a
                INNER JOIN lojas l ON l.id = a.loja_id
                INNER JOIN auditoria_versoes av
                    ON av.auditoria_id = a.id
                INNER JOIN relatorios r
                    ON r.auditoria_versao_id = av.id
                WHERE a.id = ?
                  AND av.numero = (
                      SELECT MAX(av2.numero)
                      FROM auditoria_versoes av2
                      WHERE av2.auditoria_id = a.id
                  )
                  AND av.status = 'FINALIZADA'
                  AND r.arquivo_uri IS NOT NULL
                  ${filtroLoja}
                LIMIT 1
            `,
            args,
        });

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "PDF não encontrado para uma auditoria finalizada ou acesso não autorizado.",
                },
                { status: 404 }
            );
        }

        const registro = result.rows[0];
        const arquivoUri = String(registro.arquivo_uri);

        const arquivo = await get(arquivoUri, {
            access: "private",
        });

        if (!arquivo) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O arquivo PDF não está disponível.",
                },
                { status: 404 }
            );
        }

        const nomeLoja = String(registro.loja_nome)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80) || "loja";

        const dataGeracao = new Date(
            String(registro.gerado_em)
        );

        const dataFormatada = Number.isNaN(dataGeracao.getTime())
            ? "relatorio"
            : dataGeracao.toISOString().slice(0, 10);

        return new Response(arquivo.stream, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition":
                    `attachment; filename="relatorio-${nomeLoja}-${dataFormatada}.pdf"`,
                "Content-Length": String(arquivo.blob.size),
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        console.error("Erro ao baixar relatório PDF:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível baixar o relatório PDF.",
            },
            { status: 500 }
        );
    }
}