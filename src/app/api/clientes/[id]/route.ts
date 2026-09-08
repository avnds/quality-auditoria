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
        const resultado = await requirePermission("clientes.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultado.usuario;
        const { id } = await context.params;

        let result;

        if (
            usuario.perfil === "MASTER" ||
            usuario.perfil === "SUPERVISORA"
        ) {
            result = await db.execute({
                sql: `
                    SELECT
                        id,
                        razao_social,
                        nome_fantasia,
                        cnpj,
                        email,
                        ativo,
                        criado_em,
                        atualizado_em
                    FROM clientes
                    WHERE id = ?
                    LIMIT 1
                `,
                args: [id],
            });
        } else {
            result = await db.execute({
                sql: `
                    SELECT
                        c.id,
                        c.razao_social,
                        c.nome_fantasia,
                        c.cnpj,
                        c.email,
                        c.ativo,
                        c.criado_em,
                        c.atualizado_em
                    FROM clientes c
                    INNER JOIN usuario_clientes uc
                        ON uc.cliente_id = c.id
                    WHERE c.id = ?
                      AND uc.usuario_id = ?
                    LIMIT 1
                `,
                args: [id, usuario.id],
            });
        }

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Cliente não encontrado.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            cliente: result.rows[0],
        });
    } catch (error) {
        console.error("Erro ao consultar cliente:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar o cliente.",
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

        const { id } = await context.params;
        const body = await request.json();

        const razaoSocial =
            typeof body.razao_social === "string"
                ? body.razao_social.trim()
                : "";

        const nomeFantasia =
            typeof body.nome_fantasia === "string"
                ? body.nome_fantasia.trim()
                : "";

        const cnpj =
            typeof body.cnpj === "string"
                ? body.cnpj.trim()
                : "";

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        if (!razaoSocial || !nomeFantasia || !cnpj) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Razão social, nome fantasia e CNPJ são obrigatórios.",
                },
                { status: 400 }
            );
        }

        const clienteExistente = await db.execute({
            sql: `
                SELECT id
                FROM clientes
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (clienteExistente.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Cliente não encontrado.",
                },
                { status: 404 }
            );
        }

        const cnpjExistente = await db.execute({
            sql: `
                SELECT id
                FROM clientes
                WHERE cnpj = ?
                  AND id <> ?
                LIMIT 1
            `,
            args: [cnpj, id],
        });

        if (cnpjExistente.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Já existe outro cliente com este CNPJ.",
                },
                { status: 409 }
            );
        }

        await db.execute({
            sql: `
                UPDATE clientes
                SET
                    razao_social = ?,
                    nome_fantasia = ?,
                    cnpj = ?,
                    email = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [
                razaoSocial,
                nomeFantasia,
                cnpj,
                email || null,
                id,
            ],
        });

        return NextResponse.json({
            success: true,
            message: "Cliente atualizado com sucesso.",
            cliente: {
                id,
                razao_social: razaoSocial,
                nome_fantasia: nomeFantasia,
                cnpj,
                email: email || null,
            },
        });
    } catch (error) {
        console.error("Erro ao editar cliente:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível editar o cliente.",
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
        const resultado = await requirePermission("clientes.ativar");

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

        const ativo =
            body.ativo === 1 || body.ativo === true
                ? 1
                : body.ativo === 0 || body.ativo === false
                    ? 0
                    : null;

        if (ativo === null) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O status informado é inválido.",
                },
                { status: 400 }
            );
        }

        const clienteExistente = await db.execute({
            sql: `
                SELECT id
                FROM clientes
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (clienteExistente.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Cliente não encontrado.",
                },
                { status: 404 }
            );
        }

        await db.execute({
            sql: `
                UPDATE clientes
                SET
                    ativo = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [ativo, id],
        });

        return NextResponse.json({
            success: true,
            message:
                ativo === 1
                    ? "Cliente ativado com sucesso."
                    : "Cliente inativado com sucesso.",
            ativo,
        });
    } catch (error) {
        console.error("Erro ao alterar status do cliente:", error);

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível alterar o status do cliente.",
            },
            { status: 500 }
        );
    }
}