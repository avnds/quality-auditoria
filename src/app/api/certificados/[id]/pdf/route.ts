import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
    try {
        const auth = await requirePermission("certificados.baixar");
        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const { id } = await context.params;
        const args: string[] = [id];
        let filtroAcesso = "";

        if (auth.usuario.perfil !== "MASTER" && auth.usuario.perfil !== "SUPERVISORA") {
            filtroAcesso = `
                AND EXISTS (
                    SELECT 1 FROM usuario_lojas ul
                    WHERE ul.loja_id = t.loja_id
                      AND ul.usuario_id = ?
                )
            `;
            args.push(auth.usuario.id);
        }

        const result = await db.execute({
            sql: `
                SELECT cert.numero, cert.nome_colaborador, cert.arquivo_uri
                FROM certificados cert
                INNER JOIN treinamento_colaboradores tc
                    ON tc.id = cert.treinamento_colaborador_id
                INNER JOIN treinamentos t ON t.id = tc.treinamento_id
                WHERE cert.id = ?
                  AND cert.arquivo_uri IS NOT NULL
                  ${filtroAcesso}
                LIMIT 1
            `,
            args,
        });

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Certificado não encontrado ou acesso não autorizado." },
                { status: 404 }
            );
        }

        const row = result.rows[0];
        const arquivo = await get(String(row.arquivo_uri), { access: "private" });
        if (!arquivo) {
            return NextResponse.json(
                { success: false, message: "Arquivo do certificado indisponível." },
                { status: 404 }
            );
        }

        const nome = String(row.nome_colaborador)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 70) || "participante";

        return new Response(arquivo.stream, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="certificado-${nome}.pdf"`,
                "Content-Length": String(arquivo.blob.size),
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        console.error("Erro ao baixar certificado:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível baixar o certificado." },
            { status: 500 }
        );
    }
}
