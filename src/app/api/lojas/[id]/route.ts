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
                        cliente_id,
                        nome,
                        cnpj,
                        endereco,
                        numero,
                        complemento,
                        bairro,
                        cidade,
                        estado,
                        cep,
                        ativo,
                        criado_em,
                        atualizado_em
                    FROM lojas
                    WHERE id = ?
                    LIMIT 1
                `,
                args: [id],
            });
        } else {
            result = await db.execute({
                sql: `
                    SELECT
                        l.id,
                        l.cliente_id,
                        l.nome,
                        l.cnpj,
                        l.endereco,
                        l.numero,
                        l.complemento,
                        l.bairro,
                        l.cidade,
                        l.estado,
                        l.cep,
                        l.ativo,
                        l.criado_em,
                        l.atualizado_em
                    FROM lojas l
                    INNER JOIN usuario_lojas ul
                        ON ul.loja_id = l.id
                    WHERE l.id = ?
                      AND ul.usuario_id = ?
                    LIMIT 1
                `,
                args: [id, usuario.id],
            });
        }

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Loja não encontrada.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            loja: result.rows[0],
        });
    } catch (error) {
        console.error("Erro ao consultar loja:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar a loja.",
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

        const nome =
            typeof body.nome === "string"
                ? body.nome.trim()
                : "";

        const cnpj =
            typeof body.cnpj === "string"
                ? body.cnpj.trim()
                : "";

        const endereco =
            typeof body.endereco === "string"
                ? body.endereco.trim()
                : "";

        const numero =
            typeof body.numero === "string"
                ? body.numero.trim()
                : "";

        const complemento =
            typeof body.complemento === "string"
                ? body.complemento.trim()
                : "";

        const bairro =
            typeof body.bairro === "string"
                ? body.bairro.trim()
                : "";

        const cidade =
            typeof body.cidade === "string"
                ? body.cidade.trim()
                : "";

        const estado =
            typeof body.estado === "string"
                ? body.estado.trim().toUpperCase()
                : "";

        const cep =
            typeof body.cep === "string"
                ? body.cep.trim()
                : "";

        if (!nome || !endereco || !cidade || !estado) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nome, endereço, cidade e estado são obrigatórios.",
                },
                { status: 400 }
            );
        }

        const lojaExistente = await db.execute({
            sql: `
                SELECT id
                FROM lojas
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (lojaExistente.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Loja não encontrada.",
                },
                { status: 404 }
            );
        }

        if (cnpj) {
            const cnpjExistente = await db.execute({
                sql: `
                    SELECT id
                    FROM lojas
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
                        message:
                            "Já existe outra loja com este CNPJ.",
                    },
                    { status: 409 }
                );
            }
        }

        await db.execute({
            sql: `
                UPDATE lojas
                SET
                    nome = ?,
                    cnpj = ?,
                    endereco = ?,
                    numero = ?,
                    complemento = ?,
                    bairro = ?,
                    cidade = ?,
                    estado = ?,
                    cep = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [
                nome,
                cnpj || null,
                endereco,
                numero || null,
                complemento || null,
                bairro || null,
                cidade,
                estado,
                cep || null,
                id,
            ],
        });

        return NextResponse.json({
            success: true,
            message: "Loja atualizada com sucesso.",
            loja: {
                id,
                nome,
                cnpj: cnpj || null,
                endereco,
                numero: numero || null,
                complemento: complemento || null,
                bairro: bairro || null,
                cidade,
                estado,
                cep: cep || null,
            },
        });
    } catch (error) {
        console.error("Erro ao editar loja:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível editar a loja.",
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

        const lojaExistente = await db.execute({
            sql: `
                SELECT id
                FROM lojas
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (lojaExistente.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Loja não encontrada.",
                },
                { status: 404 }
            );
        }

        await db.execute({
            sql: `
                UPDATE lojas
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
                    ? "Loja ativada com sucesso."
                    : "Loja inativada com sucesso.",
            ativo,
        });
    } catch (error) {
        console.error("Erro ao alterar status da loja:", error);

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível alterar o status da loja.",
            },
            { status: 500 }
        );
    }
}