import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

export async function POST(
    _request: Request,
    context: RouteContext
) {
    try {
        const resultado = await requirePermission(
            "auditorias.finalizar"
        );

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultado.usuario;

        if (usuario.perfil !== "SUPERVISORA") {
            return forbiddenResponse();
        }

        const { id } = await context.params;

        const versaoResult = await db.execute({
            sql: `
                SELECT
                    av.id,
                    av.numero,
                    av.status
                FROM auditoria_versoes av
                WHERE av.auditoria_id = ?
                  AND av.numero = (
                      SELECT MAX(av2.numero)
                      FROM auditoria_versoes av2
                      WHERE av2.auditoria_id = av.auditoria_id
                  )
                LIMIT 1
            `,
            args: [id],
        });

        if (versaoResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Versão da auditoria não encontrada.",
                },
                { status: 404 }
            );
        }

        const versao = versaoResult.rows[0];

        if (String(versao.status) !== "ENVIADA") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Somente auditorias enviadas para validação podem ser finalizadas.",
                },
                { status: 409 }
            );
        }

        const agora = new Date().toISOString();

        await db.batch(
            [
                {
                    sql: `
                        UPDATE auditoria_versoes
                        SET
                            status = 'FINALIZADA',
                            finalizada_em = ?,
                            finalizada_por = ?
                        WHERE id = ?
                          AND status = 'ENVIADA'
                    `,
                    args: [
                        agora,
                        usuario.id,
                        versao.id,
                    ],
                },
                {
                    sql: `
                        INSERT INTO auditoria_historico (
                            id,
                            auditoria_id,
                            usuario_id,
                            acao,
                            detalhes
                        )
                        VALUES (?, ?, ?, 'FINALIZADA', ?)
                    `,
                    args: [
                        crypto.randomUUID(),
                        id,
                        usuario.id,
                        `Versão ${versao.numero} finalizada pela supervisora.`,
                    ],
                },
            ],
            "write"
        );

        return NextResponse.json({
            success: true,
            auditoriaId: id,
            versaoId: String(versao.id),
            numero: Number(versao.numero),
            status: "FINALIZADA",
        });
    } catch (error) {
        console.error(
            "Erro ao finalizar auditoria:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível finalizar a auditoria.",
            },
            { status: 500 }
        );
    }
}