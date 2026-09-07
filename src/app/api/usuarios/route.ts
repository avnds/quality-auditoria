import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";
import { hashPassword } from "@/lib/auth/password";
export async function GET() {
    try {
        const resultado = await requirePermission("usuarios.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultado.usuario;

        const sql =
            usuario.perfil === "MASTER"
                ? `
                    SELECT
                        id,
                        nome,
                        email,
                        perfil,
                        ativo,
                        criado_em,
                        atualizado_em
                    FROM usuarios
                    ORDER BY nome
                `
                : `
                    SELECT
                        id,
                        nome,
                        email,
                        perfil,
                        ativo,
                        criado_em,
                        atualizado_em
                    FROM usuarios
                    WHERE perfil = 'CONSULTOR'
                    ORDER BY nome
                `;

        const result = await db.execute(sql);

        return NextResponse.json({
            success: true,
            usuarios: result.rows,
        });
    } catch (error) {
        console.error("Erro ao consultar usuários:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar os usuários.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const resultado = await requirePermission("usuarios.consultor.criar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuarioCriador = resultado.usuario;

        if (
            usuarioCriador.perfil !== "MASTER" &&
            usuarioCriador.perfil !== "SUPERVISORA"
        ) {
            return forbiddenResponse();
        }


        const body = await request.json();

        const nome =
            typeof body.nome === "string"
                ? body.nome.trim()
                : "";

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        const senha =
            typeof body.senha === "string"
                ? body.senha
                : "";

        const perfil =
            typeof body.perfil === "string"
                ? body.perfil.trim().toUpperCase()
                : "";

        if (!nome || !email || !senha || !perfil) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Nome, e-mail, senha e perfil são obrigatórios.",
                },
                { status: 400 }
            );
        }

        if (!["CONSULTOR", "SUPERVISORA"].includes(perfil)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Perfil de usuário inválido.",
                },
                { status: 400 }
            );
        }

        if (
            perfil === "SUPERVISORA" &&
            usuarioCriador.perfil !== "MASTER"
        ) {
            return forbiddenResponse();
        }

        if (
            perfil === "SUPERVISORA" &&
            usuarioCriador.perfil !== "MASTER"
        ) {
            return forbiddenResponse();
        }

        const emailExistente = await db.execute({
            sql: `
                SELECT id
                FROM usuarios
                WHERE email = ?
                LIMIT 1
            `,
            args: [email],
        });

        if (emailExistente.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Já existe um usuário com este e-mail.",
                },
                { status: 409 }
            );
        }

        const senhaHash = await hashPassword(senha);
        const id = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO usuarios (
                    id,
                    nome,
                    email,
                    senha_hash,
                    perfil,
                    ativo
                )
                VALUES (?, ?, ?, ?, ?, 1)
            `,
            args: [
                id,
                nome,
                email,
                senhaHash,
                perfil,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Usuário criado com sucesso.",
                usuario: {
                    id,
                    nome,
                    email,
                    perfil,
                    ativo: 1,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao criar usuário:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível criar o usuário.",
            },
            { status: 500 }
        );
    }
}