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

        const texto =
            typeof body.texto === "string"
                ? body.texto.trim()
                : "";

        if (!texto) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O texto do item é obrigatório.",
                },
                { status: 400 }
            );
        }

        const atual = await db.execute({
            sql: `
                SELECT id
                FROM catalogo_itens
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (atual.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Item do catálogo não encontrado.",
                },
                { status: 404 }
            );
        }

        const duplicado = await db.execute({
            sql: `
                SELECT id
                FROM catalogo_itens
                WHERE LOWER(texto) = LOWER(?)
                  AND id <> ?
                LIMIT 1
            `,
            args: [texto, id],
        });

        if (duplicado.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Já existe outro item com este texto no catálogo.",
                },
                { status: 409 }
            );
        }

        await db.execute({
            sql: `
                UPDATE catalogo_itens
                SET texto = ?
                WHERE id = ?
            `,
            args: [texto, id],
        });

        return NextResponse.json({
            success: true,
            message: "Item do catálogo atualizado com sucesso.",
            item: {
                id,
                texto,
            },
        });
    } catch (error) {
        console.error(
            "Erro ao editar item do catálogo:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível editar o item do catálogo.",
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
                FROM catalogo_itens
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (atual.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Item do catálogo não encontrado.",
                },
                { status: 404 }
            );
        }

        const vinculado = await db.execute({
            sql: `
                SELECT id
                FROM checklist_itens
                WHERE catalogo_item_id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (vinculado.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Este item está vinculado a um ou mais checklists e não pode ser excluído.",
                },
                { status: 409 }
            );
        }

        await db.execute({
            sql: `
                DELETE FROM catalogo_itens
                WHERE id = ?
            `,
            args: [id],
        });

        return NextResponse.json({
            success: true,
            message: "Item excluído do catálogo com sucesso.",
        });
    } catch (error) {
        console.error(
            "Erro ao excluir item do catálogo:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível excluir o item do catálogo.",
            },
            { status: 500 }
        );
    }
}