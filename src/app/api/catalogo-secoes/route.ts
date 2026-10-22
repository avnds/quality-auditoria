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
                    nome,
                    criado_em
                FROM catalogo_secoes
                ORDER BY nome COLLATE NOCASE
            `,
            args: [],
        });

        return NextResponse.json({
            success: true,
            secoes: resultado.rows,
        });
    } catch (error) {
        console.error(
            "Erro ao consultar catálogo de seções:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível consultar o catálogo de seções.",
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

        const nome =
            typeof body.nome === "string"
                ? body.nome.trim()
                : "";

        if (!nome) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O nome da seção é obrigatório.",
                },
                { status: 400 }
            );
        }

        const existente = await db.execute({
            sql: `
                SELECT id
                FROM catalogo_secoes
                WHERE LOWER(nome) = LOWER(?)
                LIMIT 1
            `,
            args: [nome],
        });

        if (existente.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Já existe uma seção com este nome no catálogo.",
                },
                { status: 409 }
            );
        }

        const id = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO catalogo_secoes (
                    id,
                    nome
                )
                VALUES (?, ?)
            `,
            args: [id, nome],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Seção adicionada ao catálogo com sucesso.",
                secao: {
                    id,
                    nome,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "Erro ao cadastrar seção no catálogo:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível cadastrar a seção no catálogo.",
            },
            { status: 500 }
        );
    }
}