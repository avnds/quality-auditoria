import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export async function GET(request: Request) {
    try {
        const resultado = await requirePermission("clientes.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultado.usuario;

        const { searchParams } = new URL(request.url);
        const clienteId = searchParams.get("cliente_id");

        if (!clienteId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O cliente é obrigatório.",
                },
                { status: 400 }
            );
        }

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
                    WHERE cliente_id = ?
                    ORDER BY nome
                `,
                args: [clienteId],
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
                    WHERE l.cliente_id = ?
                      AND ul.usuario_id = ?
                    ORDER BY l.nome
                `,
                args: [clienteId, usuario.id],
            });
        }

        return NextResponse.json({
            success: true,
            lojas: result.rows,
        });
    } catch (error) {
        console.error("Erro ao consultar lojas:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar as lojas.",
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

        const clienteId =
            typeof body.cliente_id === "string"
                ? body.cliente_id.trim()
                : "";

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

        if (!clienteId || !nome || !endereco || !cidade || !estado) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Cliente, nome, endereço, cidade e estado são obrigatórios.",
                },
                { status: 400 }
            );
        }

        const clienteExistente = await db.execute({
            sql: `
                SELECT id
                FROM clientes
                WHERE id = ?
                  AND ativo = 1
                LIMIT 1
            `,
            args: [clienteId],
        });

        if (clienteExistente.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Cliente não encontrado ou está inativo.",
                },
                { status: 404 }
            );
        }

        if (cnpj) {
            const lojaExistente = await db.execute({
                sql: `
                    SELECT id
                    FROM lojas
                    WHERE cnpj = ?
                    LIMIT 1
                `,
                args: [cnpj],
            });

            if (lojaExistente.rows.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Já existe uma loja com este CNPJ.",
                    },
                    { status: 409 }
                );
            }
        }

        const id = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO lojas (
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
                    ativo
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `,
            args: [
                id,
                clienteId,
                nome,
                cnpj || null,
                endereco,
                numero || null,
                complemento || null,
                bairro || null,
                cidade,
                estado,
                cep || null,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Loja criada com sucesso.",
                loja: {
                    id,
                    cliente_id: clienteId,
                    nome,
                    cnpj: cnpj || null,
                    endereco,
                    numero: numero || null,
                    complemento: complemento || null,
                    bairro: bairro || null,
                    cidade,
                    estado,
                    cep: cep || null,
                    ativo: 1,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao criar loja:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível criar a loja.",
            },
            { status: 500 }
        );
    }
}