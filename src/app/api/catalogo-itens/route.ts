import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

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

export async function GET() {
    try {
        const acesso = await validarAcesso();

        if (!acesso.autorizado) {
            return acesso.resposta;
        }

        const resultado = await db.execute({
            sql: `
                SELECT
                    id,
                    texto,
                    criado_em
                FROM catalogo_itens
                ORDER BY texto COLLATE NOCASE
            `,
            args: [],
        });

        return NextResponse.json({
            success: true,
            itens: resultado.rows,
        });
    } catch (error) {
        console.error(
            "Erro ao consultar catálogo de itens:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível consultar o catálogo de itens.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const acesso = await validarAcesso();

        if (!acesso.autorizado) {
            return acesso.resposta;
        }

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

        const existente = await db.execute({
            sql: `
                SELECT id
                FROM catalogo_itens
                WHERE LOWER(texto) = LOWER(?)
                LIMIT 1
            `,
            args: [texto],
        });

        if (existente.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Já existe um item com este texto no catálogo.",
                },
                { status: 409 }
            );
        }

        const id = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO catalogo_itens (
                    id,
                    texto
                )
                VALUES (?, ?)
            `,
            args: [id, texto],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Item adicionado ao catálogo com sucesso.",
                item: {
                    id,
                    texto,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "Erro ao cadastrar item no catálogo:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível cadastrar o item no catálogo.",
            },
            { status: 500 }
        );
    }
}