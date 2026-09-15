import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export async function GET() {
    try {
        const resultado = await requirePermission("setores.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const result = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    descricao,
                    ativo
                FROM setores
                ORDER BY nome
            `,
            args: [],
        });

        return NextResponse.json({
            success: true,
            setores: result.rows,
        });
    } catch (error) {
        console.error("Erro ao consultar setores:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar os setores.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const resultado = await requirePermission("setores.criar");

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
                LIMIT 1
            `,
            args: [nome],
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

        const id = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO setores (
                    id,
                    nome,
                    descricao,
                    ativo
                )
                VALUES (?, ?, ?, 1)
            `,
            args: [
                id,
                nome,
                descricao || null,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Setor criado com sucesso.",
                setor: {
                    id,
                    nome,
                    descricao: descricao || null,
                    ativo: 1,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao criar setor:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível criar o setor.",
            },
            { status: 500 }
        );
    }
}