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

export async function GET(
    _request: Request,
    context: RouteContext
) {
    try {
        const resultado = await requirePermission("checklists.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const { id } = await context.params;

        const result = await db.execute({
            sql: `
                SELECT
                    c.id,
                    c.nome,
                    c.descricao,
                    c.ativo,
                    c.setor_id,
                    s.nome AS setor_nome
                FROM checklists c
                INNER JOIN setores s
                    ON s.id = c.setor_id
                WHERE c.id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Checklist não encontrado.",
                },
                { status: 404 }
            );
        }

        const checklist = result.rows[0];

        return NextResponse.json({
            success: true,
            checklist: {
                id: String(checklist.id),
                nome: String(checklist.nome),
                descricao:
                    checklist.descricao === null ||
                        checklist.descricao === undefined
                        ? null
                        : String(checklist.descricao),
                ativo: Number(checklist.ativo) === 1,
                setor_id: String(checklist.setor_id),
                setor_nome: String(checklist.setor_nome),
            },
        });
    } catch (error) {
        console.error("Erro ao consultar checklist:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar o checklist.",
            },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    context: RouteContext
) {
    try {
        const resultado = await requirePermission("checklists.editar");

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

        const { id } = await context.params;

        const body = await request.json();

        const nome =
            typeof body.nome === "string"
                ? body.nome.trim()
                : "";

        const descricao =
            typeof body.descricao === "string"
                ? body.descricao.trim()
                : "";

        const setorId =
            typeof body.setor_id === "string"
                ? body.setor_id.trim()
                : "";

        if (!nome) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O nome do checklist é obrigatório.",
                },
                { status: 400 }
            );
        }

        if (!setorId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O setor é obrigatório.",
                },
                { status: 400 }
            );
        }

        const checklistExistente = await db.execute({
            sql: `
                SELECT
                    id,
                    ativo
                FROM checklists
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (checklistExistente.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Checklist não encontrado.",
                },
                { status: 404 }
            );
        }

        const setor = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    ativo
                FROM setores
                WHERE id = ?
                LIMIT 1
            `,
            args: [setorId],
        });

        if (setor.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Setor não encontrado.",
                },
                { status: 404 }
            );
        }

        const setorEncontrado = setor.rows[0];

        if (Number(setorEncontrado.ativo) !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Não é possível associar o checklist a um setor inativo.",
                },
                { status: 400 }
            );
        }

        const duplicado = await db.execute({
            sql: `
                SELECT id
                FROM checklists
                WHERE setor_id = ?
                  AND LOWER(nome) = LOWER(?)
                  AND id <> ?
                LIMIT 1
            `,
            args: [setorId, nome, id],
        });

        if (duplicado.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Já existe um checklist com este nome neste setor.",
                },
                { status: 409 }
            );
        }

        await db.execute({
            sql: `
                UPDATE checklists
                SET
                    nome = ?,
                    descricao = ?,
                    setor_id = ?
                WHERE id = ?
            `,
            args: [
                nome,
                descricao || null,
                setorId,
                id,
            ],
        });

        return NextResponse.json({
            success: true,
            message: "Checklist atualizado com sucesso.",
            checklist: {
                id,
                nome,
                descricao: descricao || null,
                setor_id: setorId,
                setor_nome: String(setorEncontrado.nome),
            },
        });
    } catch (error) {
        console.error("Erro ao editar checklist:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível editar o checklist.",
            },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    context: RouteContext
) {
    try {
        const resultado = await requirePermission("checklists.desativar");

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

        const { id } = await context.params;

        const checklistAtual = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    descricao,
                    ativo,
                    setor_id
                FROM checklists
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (checklistAtual.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Checklist não encontrado.",
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
                UPDATE checklists
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
                ? "Checklist ativado com sucesso."
                : "Checklist inativado com sucesso.",
            checklist: {
                ...checklistAtual.rows[0],
                ativo: body.ativo ? 1 : 0,
            },
        });
    } catch (error) {
        console.error("Erro ao alterar status do checklist:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível alterar o status do checklist.",
            },
            { status: 500 }
        );
    }
}