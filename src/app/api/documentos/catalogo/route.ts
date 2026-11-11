import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export async function GET() {
    try {
        const acesso = await requirePermission("documentos.visualizar");

        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const resultado = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    descricao,
                    tipo_controle,
                    modalidade,
                    periodicidade_meses,
                    alerta_dias,
                    ativo,
                    criado_em,
                    atualizado_em
                FROM documentos_catalogo
                ORDER BY nome COLLATE NOCASE, id
            `,
            args: [],
        });

        return NextResponse.json({
            success: true,
            documentos: resultado.rows,
        });
    } catch (error) {
        console.error("Erro ao consultar catalogo documental:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar o catálogo documental.",
            },
            { status: 500 }
        );
    }
}
