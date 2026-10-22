import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

async function validarAcesso() {
    const usuario = await getCurrentUser();

    if (!usuario) {
        return {
            autorizado: false as const,
            resposta: unauthorizedResponse(),
        };
    }

    if (
        usuario.perfil !== "MASTER" &&
        usuario.perfil !== "SUPERVISORA"
    ) {
        return {
            autorizado: false as const,
            resposta: forbiddenResponse(),
        };
    }

    return {
        autorizado: true as const,
        usuario,
    };
}

export async function PUT(
    request: Request,
    context: RouteContext
) {
    try {
        const acesso = await validarAcesso();

        if (!acesso.autorizado) {
            return acesso.resposta;
        }

        const { id } = await context.params;
        const body = await request.json();

        const nome =
            typeof body.nome === "string"
                ? body.nome.trim()
                : "";

        if (!nome) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O nome da seção é obrigatório.",
                },
                { status: 400 }
            );
        }

        const atual = await db.execute({
            sql: `
                SELECT id
                FROM catalogo_secoes
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (atual.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Seção do catálogo não encontrada.",
                },
                { status: 404 }
            );
        }

        const duplicada = await db.execute({
            sql: `
                SELECT id
                FROM catalogo_secoes
                WHERE LOWER(nome) = LOWER(?)
                  AND id <> ?
                LIMIT 1
            `,
            args: [nome, id],
        });

        if (duplicada.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Já existe outra seção com este nome no catálogo.",
                },
                { status: 409 }
            );
        }

        await db.execute({
            sql: `
                UPDATE catalogo_secoes
                SET nome = ?
                WHERE id = ?
            `,
            args: [nome, id],
        });

        return NextResponse.json({
            success: true,
            message: "Seção do catálogo atualizada com sucesso.",
            secao: {
                id,
                nome,
            },
        });
    } catch (error) {
        console.error(
            "Erro ao editar seção do catálogo:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível editar a seção do catálogo.",
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _request: Request,
    context: RouteContext
) {
    try {
        const acesso = await validarAcesso();

        if (!acesso.autorizado) {
            return acesso.resposta;
        }

        const { id } = await context.params;

        const atual = await db.execute({
            sql: `
                SELECT id
                FROM catalogo_secoes
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (atual.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Seção do catálogo não encontrada.",
                },
                { status: 404 }
            );
        }

        const vinculada = await db.execute({
            sql: `
                SELECT id
                FROM checklist_secoes
                WHERE catalogo_secao_id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (vinculada.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Esta seção está vinculada a um ou mais checklists e não pode ser excluída.",
                },
                { status: 409 }
            );
        }

        await db.execute({
            sql: `
                DELETE FROM catalogo_secoes
                WHERE id = ?
            `,
            args: [id],
        });

        return NextResponse.json({
            success: true,
            message: "Seção excluída do catálogo com sucesso.",
        });
    } catch (error) {
        console.error(
            "Erro ao excluir seção do catálogo:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível excluir a seção do catálogo.",
            },
            { status: 500 }
        );
    }
}