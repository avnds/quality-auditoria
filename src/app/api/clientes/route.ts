import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export async function GET() {
    try {
        const resultado = await requirePermission("clientes.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultado.usuario;

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
                    ORDER BY nome_fantasia
                `,
                args: [],
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
                    WHERE uc.usuario_id = ?
                    ORDER BY c.nome_fantasia
                `,
                args: [usuario.id],
            });
        }

        return NextResponse.json({
            success: true,
            clientes: result.rows,
        });
    } catch (error) {
        console.error("Erro ao consultar clientes:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar os clientes.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const resultado = await requirePermission("clientes.criar");

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
                WHERE cnpj = ?
                LIMIT 1
            `,
            args: [cnpj],
        });

        if (clienteExistente.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Já existe um cliente com este CNPJ.",
                },
                { status: 409 }
            );
        }

        const id = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO clientes (
                    id,
                    razao_social,
                    nome_fantasia,
                    cnpj,
                    email,
                    ativo
                )
                VALUES (?, ?, ?, ?, ?, 1)
            `,
            args: [
                id,
                razaoSocial,
                nomeFantasia,
                cnpj,
                email || null,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Cliente criado com sucesso.",
                cliente: {
                    id,
                    razao_social: razaoSocial,
                    nome_fantasia: nomeFantasia,
                    cnpj,
                    email: email || null,
                    ativo: 1,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao criar cliente:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível criar o cliente.",
            },
            { status: 500 }
        );
    }
}