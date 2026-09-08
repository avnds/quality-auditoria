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

export async function PUT(
    request: Request,
    { params }: Params
) {
    try {
        const resultado = await requirePermission("clientes.editar");

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

        const { id } = await params;
        const body = await request.json();

        const numero =
            typeof body.numero === "string"
                ? body.numero.trim()
                : "";

        const tipo =
            typeof body.tipo === "string"
                ? body.tipo.trim()
                : "";

        const principal = body.principal ? 1 : 0;

        if (!numero) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O número é obrigatório.",
                },
                { status: 400 }
            );
        }

        const telefone = await db.execute({
            sql: `
                SELECT id, loja_id
                FROM telefones
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (telefone.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Telefone não encontrado.",
                },
                { status: 404 }
            );
        }

        const lojaId = telefone.rows[0].loja_id;

        if (principal === 1) {
            await db.execute({
                sql: `
                    UPDATE telefones
                    SET principal = 0
                    WHERE loja_id = ?
                `,
                args: [lojaId],
            });
        }

        await db.execute({
            sql: `
                UPDATE telefones
                SET
                    numero = ?,
                    tipo = ?,
                    principal = ?
                WHERE id = ?
            `,
            args: [
                numero,
                tipo || null,
                principal,
                id,
            ],
        });

        return NextResponse.json({
            success: true,
            message: "Telefone atualizado com sucesso.",
        });
    } catch (error) {
        console.error("Erro ao atualizar telefone:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível atualizar o telefone.",
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: Params
) {
    try {
        const resultado = await requirePermission("clientes.editar");

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

        const { id } = await params;

        const telefone = await db.execute({
            sql: `
                SELECT id
                FROM telefones
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (telefone.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Telefone não encontrado.",
                },
                { status: 404 }
            );
        }

        await db.execute({
            sql: `
                DELETE FROM telefones
                WHERE id = ?
            `,
            args: [id],
        });

        return NextResponse.json({
            success: true,
            message: "Telefone removido com sucesso.",
        });
    } catch (error) {
        console.error("Erro ao remover telefone:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível remover o telefone.",
            },
            { status: 500 }
        );
    }
}