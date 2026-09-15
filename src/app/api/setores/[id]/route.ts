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

        const { id } = await params;

        const result = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    descricao,
                    ativo
                FROM setores
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Setor não encontrado.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            setor: result.rows[0],
        });
    } catch (error) {
        console.error("Erro ao consultar setor:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar o setor.",
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
        const resultado = await requirePermission("setores.editar");

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

        const setorAtual = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    descricao,
                    ativo
                FROM setores
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (setorAtual.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Setor não encontrado.",
                },
                { status: 404 }
            );
        }

        const body = await request.json();

        const nome =
            typeof body.nome === "string"
                ? body.nome.trim()
                : "";

        const descricao =
            typeof body.descricao === "string"
                ? body.descricao.trim()
                : "";

        if (!nome) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O nome do setor é obrigatório.",
                },
                { status: 400 }
            );
        }

        const setorExistente = await db.execute({
            sql: `
                SELECT id
                FROM setores
                WHERE LOWER(nome) = LOWER(?)
                  AND id <> ?
                LIMIT 1
            `,
            args: [nome, id],
        });

        if (setorExistente.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Já existe um setor com este nome.",
                },
                { status: 409 }
            );
        }

        await db.execute({
            sql: `
                UPDATE setores
                SET
                    nome = ?,
                    descricao = ?
                WHERE id = ?
            `,
            args: [
                nome,
                descricao || null,
                id,
            ],
        });

        return NextResponse.json({
            success: true,
            message: "Setor atualizado com sucesso.",
            setor: {
                id,
                nome,
                descricao: descricao || null,
            },
        });
    } catch (error) {
        console.error("Erro ao editar setor:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível editar o setor.",
            },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    { params }: Params
) {
    try {
        const resultado = await requirePermission("setores.ativar");

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

        const setorAtual = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    descricao,
                    ativo
                FROM setores
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (setorAtual.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Setor não encontrado.",
                },
                { status: 404 }
            );
        }

        const body = await request.json();

        if (typeof body.ativo !== "boolean") {
            return NextResponse.json(
                {
                    success: false,
                    message: "O campo ativo deve ser booleano.",
                },
                { status: 400 }
            );
        }

        await db.execute({
            sql: `
                UPDATE setores
                SET ativo = ?
                WHERE id = ?
            `,
            args: [
                body.ativo ? 1 : 0,
                id,
            ],
        });

        return NextResponse.json({
            success: true,
            message: body.ativo
                ? "Setor ativado com sucesso."
                : "Setor inativado com sucesso.",
            setor: {
                ...setorAtual.rows[0],
                ativo: body.ativo ? 1 : 0,
            },
        });
    } catch (error) {
        console.error("Erro ao alterar status do setor:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível alterar o status do setor.",
            },
            { status: 500 }
        );
    }
}