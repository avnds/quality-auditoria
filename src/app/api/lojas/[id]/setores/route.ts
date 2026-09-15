import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type Params = {
    params: Promise<{
        id: string;
    }>;
};

export async function GET(
    _request: Request,
    { params }: Params
) {
    try {
        const resultado = await requirePermission("setores.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultado.usuario;
        const { id: lojaId } = await params;

        // MASTER e SUPERVISORA podem consultar qualquer loja.
        // CONSULTOR somente pode consultar lojas autorizadas.
        if (
            usuario.perfil !== "MASTER" &&
            usuario.perfil !== "SUPERVISORA"
        ) {
            const acesso = await db.execute({
                sql: `
                    SELECT 1
                    FROM usuario_lojas
                    WHERE usuario_id = ?
                      AND loja_id = ?
                    LIMIT 1
                `,
                args: [usuario.id, lojaId],
            });

            if (acesso.rows.length === 0) {
                return forbiddenResponse();
            }
        }

        const loja = await db.execute({
            sql: `
                SELECT id
                FROM lojas
                WHERE id = ?
                LIMIT 1
            `,
            args: [lojaId],
        });

        if (loja.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Loja não encontrada.",
                },
                { status: 404 }
            );
        }

        const result = await db.execute({
            sql: `
                SELECT
                    s.id,
                    s.nome,
                    s.descricao,
                    s.ativo,
                    CASE
                        WHEN ls.loja_id IS NOT NULL
                         AND ls.ativo = 1
                        THEN 1
                        ELSE 0
                    END AS associado
                FROM setores s
                LEFT JOIN loja_setores ls
                    ON ls.setor_id = s.id
                   AND ls.loja_id = ?
                WHERE s.ativo = 1
                ORDER BY s.nome
            `,
            args: [lojaId],
        });

        const setores = result.rows.map((setor) => ({
            id: String(setor.id),
            nome: String(setor.nome),
            descricao:
                setor.descricao !== null
                    ? String(setor.descricao)
                    : null,
            ativo: Number(setor.ativo) === 1,
            associado: Number(setor.associado) === 1,
        }));

        return NextResponse.json({
            success: true,
            setores,
        });
    } catch (error) {
        console.error(
            "Erro ao consultar setores da loja:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível consultar os setores da loja.",
            },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    { params }: Params
) {
    try {
        const resultado = await requirePermission(
            "setores.associar_loja"
        );

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultado.usuario;

        if (
            usuario.perfil !== "MASTER" &&
            usuario.perfil !== "SUPERVISORA"
        ) {
            return forbiddenResponse();
        }

        const { id: lojaId } = await params;

        const loja = await db.execute({
            sql: `
                SELECT id
                FROM lojas
                WHERE id = ?
                LIMIT 1
            `,
            args: [lojaId],
        });

        if (loja.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Loja não encontrada.",
                },
                { status: 404 }
            );
        }

        const body = await request.json();

        if (!Array.isArray(body.setorIds)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "O campo setorIds deve ser uma lista.",
                },
                { status: 400 }
            );
        }

        const setorIds: string[] = [
            ...new Set(
                (body.setorIds as unknown[]).filter(
                    (id): id is string =>
                        typeof id === "string" &&
                        id.trim().length > 0
                )
            ),
        ];

        if (setorIds.length > 0) {
            const placeholders = setorIds
                .map(() => "?")
                .join(", ");

            const setoresValidos = await db.execute({
                sql: `
                    SELECT id
                    FROM setores
                    WHERE ativo = 1
                      AND id IN (${placeholders})
                `,
                args: setorIds,
            });

            const idsValidos = new Set(
                setoresValidos.rows.map((row) =>
                    String(row.id)
                )
            );

            const algumSetorInvalido = setorIds.some(
                (id) => !idsValidos.has(id)
            );

            if (algumSetorInvalido) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Um ou mais setores são inválidos ou estão inativos.",
                    },
                    { status: 400 }
                );
            }
        }

        await db.execute({
            sql: `
                UPDATE loja_setores
                SET ativo = 0
                WHERE loja_id = ?
            `,
            args: [lojaId],
        });

        for (const setorId of setorIds) {
            await db.execute({
                sql: `
                    INSERT INTO loja_setores (
                        loja_id,
                        setor_id,
                        ativo
                    )
                    VALUES (?, ?, 1)
                    ON CONFLICT (loja_id, setor_id)
                    DO UPDATE SET ativo = 1
                `,
                args: [lojaId, setorId],
            });
        }

        return NextResponse.json({
            success: true,
            message: "Setores da loja atualizados com sucesso.",
        });
    } catch (error) {
        console.error(
            "Erro ao atualizar setores da loja:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível atualizar os setores da loja.",
            },
            { status: 500 }
        );
    }
}