import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import db from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        const password =
            typeof body.password === "string"
                ? body.password
                : "";

        if (!email || !password) {
            return NextResponse.json(
                {
                    success: false,
                    message: "E-mail e senha são obrigatórios.",
                },
                { status: 400 }
            );
        }

        const result = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    email,
                    senha_hash,
                    perfil,
                    ativo
                FROM usuarios
                WHERE email = ?
                LIMIT 1
            `,
            args: [email],
        });

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "E-mail ou senha inválidos.",
                },
                { status: 401 }
            );
        }

        const usuario = result.rows[0];

        if (usuario.ativo !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Este usuário está inativo.",
                },
                { status: 403 }
            );
        }

        const senhaValida = await verifyPassword(
            password,
            String(usuario.senha_hash)
        );

        if (!senhaValida) {
            return NextResponse.json(
                {
                    success: false,
                    message: "E-mail ou senha inválidos.",
                },
                { status: 401 }
            );
        }

        const { token } = await createSession(String(usuario.id));

        const response = NextResponse.json({
            success: true,
            message: "Login realizado com sucesso.",
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil,
            },
        });

        response.cookies.set("quality_session", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        return response;
    } catch (error) {
        console.error("Erro no login:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível realizar o login.",
            },
            { status: 500 }
        );
    }
}