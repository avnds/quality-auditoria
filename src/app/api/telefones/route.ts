import { NextResponse } from "next/server";
import crypto from "crypto";
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
        const lojaId = searchParams.get("loja_id");

        if (!lojaId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A loja é obrigatória.",
                },
                { status: 400 }
            );
        }

        const loja = await db.execute({
            sql: `
                SELECT id
                FROM lojas
                WHERE id = ?
                LIMIT 1
            `,
            args: [lojaId],
        });

        if (loja.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Loja não encontrada.",
                },
                { status: 404 }
            );
        }

        if (
            usuario.perfil !== "MASTER" &&
            usuario.perfil !== "SUPERVISORA"
        ) {
            const acesso = await db.execute({
                sql: `
                    SELECT 1
                    FROM usuario_lojas
                    WHERE usuario_id = ?
                      AND loja_id = ?
                    LIMIT 1
                `,
                args: [usuario.id, lojaId],
            });

            if (acesso.rows.length === 0) {
                return forbiddenResponse();
            }
        }

        const result = await db.execute({
            sql: `
                SELECT
                    id,
                    loja_id,
                    numero,
                    tipo,
                    principal,
                    criado_em
                FROM telefones
                WHERE loja_id = ?
                ORDER BY principal DESC, numero
            `,
            args: [lojaId],
        });

        return NextResponse.json({
            success: true,
            telefones: result.rows,
        });
    } catch (error) {
        console.error("Erro ao consultar telefones:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar os telefones.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
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

        const body = await request.json();

        const lojaId =
            typeof body.loja_id === "string"
                ? body.loja_id.trim()
                : "";

        const numero =
            typeof body.numero === "string"
                ? body.numero.trim()
                : "";

        const tipo =
            typeof body.tipo === "string"
                ? body.tipo.trim()
                : "";

        const principal = body.principal ? 1 : 0;

        if (!lojaId || !numero) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Loja e número são obrigatórios.",
                },
                { status: 400 }
            );
        }

        const loja = await db.execute({
            sql: `
                SELECT id
                FROM lojas
                WHERE id = ?
                LIMIT 1
            `,
            args: [lojaId],
        });

        if (loja.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Loja não encontrada.",
                },
                { status: 404 }
            );
        }

        const id = crypto.randomUUID();

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
                INSERT INTO telefones (
                    id,
                    loja_id,
                    numero,
                    tipo,
                    principal
                )
                VALUES (?, ?, ?, ?, ?)
            `,
            args: [
                id,
                lojaId,
                numero,
                tipo || null,
                principal,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Telefone criado com sucesso.",
                telefone: {
                    id,
                    loja_id: lojaId,
                    numero,
                    tipo: tipo || null,
                    principal,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao criar telefone:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível criar o telefone.",
            },
            { status: 500 }
        );
    }
}