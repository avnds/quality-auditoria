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

async function validarConsultor(usuarioId: string) {
    const resultado = await db.execute({
        sql: `
            SELECT
                id,
                nome,
                email,
                perfil,
                ativo
            FROM usuarios
            WHERE id = ?
            LIMIT 1
        `,
        args: [usuarioId],
    });

    if (resultado.rows.length === 0) {
        return null;
    }

    const usuario = resultado.rows[0];

    if (String(usuario.perfil) !== "CONSULTOR") {
        return null;
    }

    return usuario;
}

export async function GET(
    _request: Request,
    { params }: Params
) {
    try {
        const resultado = await requirePermission(
            "lojas.autorizar_consultor"
        );

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const { id: usuarioId } = await params;

        if (!usuarioId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "ID do usuário é obrigatório.",
                },
                { status: 400 }
            );
        }

        const consultor = await validarConsultor(usuarioId);

        if (!consultor) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Consultor não encontrado.",
                },
                { status: 404 }
            );
        }

        if (Number(consultor.ativo) !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O consultor está inativo.",
                },
                { status: 400 }
            );
        }

        const clientesResult = await db.execute({
            sql: `
                SELECT
                    c.id,
                    c.nome_fantasia AS nome,
                    CASE
                        WHEN uc.usuario_id IS NOT NULL THEN 1
                        ELSE 0
                    END AS autorizado
                FROM clientes c
                LEFT JOIN usuario_clientes uc
                    ON uc.cliente_id = c.id
                   AND uc.usuario_id = ?
                WHERE c.ativo = 1
                ORDER BY c.nome_fantasia
            `,
            args: [usuarioId],
        });

        const lojasResult = await db.execute({
            sql: `
                SELECT
                    l.id,
                    l.nome,
                    l.cliente_id,
                    c.nome_fantasia AS cliente_nome,
                    CASE
                        WHEN ul.usuario_id IS NOT NULL THEN 1
                        ELSE 0
                    END AS autorizado
                FROM lojas l
                INNER JOIN clientes c
                    ON c.id = l.cliente_id
                LEFT JOIN usuario_lojas ul
                    ON ul.loja_id = l.id
                   AND ul.usuario_id = ?
                WHERE l.ativo = 1
                  AND c.ativo = 1
                ORDER BY c.nome_fantasia
                , l.nome
            `,
            args: [usuarioId],
        });

        const clientes = clientesResult.rows.map((cliente) => ({
            id: String(cliente.id),
            nome: String(cliente.nome),
            autorizado: Number(cliente.autorizado) === 1,
        }));

        const lojas = lojasResult.rows.map((loja) => ({
            id: String(loja.id),
            nome: String(loja.nome),
            clienteId: String(loja.cliente_id),
            clienteNome: String(loja.cliente_nome),
            autorizado: Number(loja.autorizado) === 1,
        }));

        return NextResponse.json({
            success: true,
            consultor: {
                id: String(consultor.id),
                nome: String(consultor.nome),
                email: String(consultor.email),
            },
            clientes,
            lojas,
        });
    } catch (error) {
        console.error(
            "Erro ao consultar autorizações do consultor:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível consultar as autorizações do consultor.",
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
            "lojas.autorizar_consultor"
        );

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const { id: usuarioId } = await params;

        if (!usuarioId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "ID do usuário é obrigatório.",
                },
                { status: 400 }
            );
        }

        const consultor = await validarConsultor(usuarioId);

        if (!consultor) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Consultor não encontrado.",
                },
                { status: 404 }
            );
        }

        if (Number(consultor.ativo) !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O consultor está inativo.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        if (!Array.isArray(body.clienteIds)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O campo clienteIds deve ser uma lista.",
                },
                { status: 400 }
            );
        }

        if (!Array.isArray(body.lojaIds)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O campo lojaIds deve ser uma lista.",
                },
                { status: 400 }
            );
        }

        const clienteIds: string[] = [
            ...new Set(
                (body.clienteIds as unknown[]).filter(
                    (id): id is string =>
                        typeof id === "string" &&
                        id.trim().length > 0
                ).map((id) => id.trim())
            ),
        ];

        const lojaIds: string[] = [
            ...new Set(
                (body.lojaIds as unknown[]).filter(
                    (id): id is string =>
                        typeof id === "string" &&
                        id.trim().length > 0
                ).map((id) => id.trim())
            ),
        ];

        if (clienteIds.length > 0) {
            const placeholders = clienteIds
                .map(() => "?")
                .join(", ");

            const clientesValidos = await db.execute({
                sql: `
                    SELECT id
                    FROM clientes
                    WHERE ativo = 1
                      AND id IN (${placeholders})
                `,
                args: clienteIds,
            });

            const idsValidos = new Set(
                clientesValidos.rows.map((row) =>
                    String(row.id)
                )
            );

            if (clienteIds.some((id) => !idsValidos.has(id))) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Um ou mais clientes são inválidos ou estão inativos.",
                    },
                    { status: 400 }
                );
            }
        }

        if (lojaIds.length > 0) {
            const placeholders = lojaIds
                .map(() => "?")
                .join(", ");

            const lojasValidas = await db.execute({
                sql: `
                    SELECT l.id
                    FROM lojas l
                    INNER JOIN clientes c
                        ON c.id = l.cliente_id
                    WHERE l.ativo = 1
                      AND c.ativo = 1
                      AND l.id IN (${placeholders})
                `,
                args: lojaIds,
            });

            const idsValidos = new Set(
                lojasValidas.rows.map((row) =>
                    String(row.id)
                )
            );

            if (lojaIds.some((id) => !idsValidos.has(id))) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Uma ou mais lojas são inválidas ou estão inativas.",
                    },
                    { status: 400 }
                );
            }
        }

        const transaction = await db.transaction();

        try {
            await transaction.execute({
                sql: `
                    DELETE FROM usuario_clientes
                    WHERE usuario_id = ?
                `,
                args: [usuarioId],
            });

            await transaction.execute({
                sql: `
                    DELETE FROM usuario_lojas
                    WHERE usuario_id = ?
                `,
                args: [usuarioId],
            });

            for (const clienteId of clienteIds) {
                await transaction.execute({
                    sql: `
                        INSERT INTO usuario_clientes (
                            usuario_id,
                            cliente_id
                        )
                        VALUES (?, ?)
                    `,
                    args: [usuarioId, clienteId],
                });
            }

            for (const lojaId of lojaIds) {
                await transaction.execute({
                    sql: `
                        INSERT INTO usuario_lojas (
                            usuario_id,
                            loja_id
                        )
                        VALUES (?, ?)
                    `,
                    args: [usuarioId, lojaId],
                });
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return NextResponse.json({
            success: true,
            message: "Autorizações atualizadas com sucesso.",
        });
    } catch (error) {
        console.error(
            "Erro ao atualizar autorizações do consultor:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível atualizar as autorizações do consultor.",
            },
            { status: 500 }
        );
    }
}