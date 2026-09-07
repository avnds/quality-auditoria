import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resultado = await requirePermission("usuarios.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuarioAtual = resultado.usuario;
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "ID do usuário é obrigatório.",
                },
                { status: 400 }
            );
        }

        const resultadoUsuario = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    email,
                    perfil,
                    ativo,
                    criado_em,
                    atualizado_em
                FROM usuarios
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (resultadoUsuario.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Usuário não encontrado.",
                },
                { status: 404 }
            );
        }

        const usuarioAlvo = resultadoUsuario.rows[0];

        // MASTER pode visualizar qualquer usuário.
        // SUPERVISORA pode visualizar apenas CONSULTOR.
        if (
            usuarioAtual.perfil === "SUPERVISORA" &&
            String(usuarioAlvo.perfil) !== "CONSULTOR"
        ) {
            return forbiddenResponse();
        }

        return NextResponse.json({
            success: true,
            usuario: usuarioAlvo,
        });
    } catch (error) {
        console.error("Erro ao consultar usuário:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar o usuário.",
            },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resultado = await requirePermission("usuarios.consultor.editar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuarioAtual = resultado.usuario;
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "ID do usuário é obrigatório.",
                },
                { status: 400 }
            );
        }
        const resultadoUsuario = await db.execute({
            sql: `
        SELECT
            id,
            nome,
            email,
            perfil,
            ativo
        FROM usuarios
        WHERE id = ?
        LIMIT 1
    `,
            args: [id],
        });

        if (resultadoUsuario.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Usuário não encontrado.",
                },
                { status: 404 }
            );
        }

        const usuarioAlvo = resultadoUsuario.rows[0];
        if (usuarioAtual.id === String(usuarioAlvo.id)) {
            return forbiddenResponse();
        }

        if (String(usuarioAlvo.perfil) === "MASTER") {
            return forbiddenResponse();
        }
        if (
            usuarioAtual.perfil === "SUPERVISORA" &&
            String(usuarioAlvo.perfil) !== "CONSULTOR"
        ) {
            return forbiddenResponse();
        }

        const body = await request.json();

        const nome =
            typeof body.nome === "string"
                ? body.nome.trim()
                : undefined;

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : undefined;

        const perfil =
            typeof body.perfil === "string"
                ? body.perfil.trim().toUpperCase()
                : undefined;

        const ativo =
            typeof body.ativo === "boolean"
                ? body.ativo
                    ? 1
                    : 0
                : undefined;

        if (
            nome === undefined &&
            email === undefined &&
            perfil === undefined &&
            ativo === undefined
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Nenhum dado para alteração foi informado.",
                },
                { status: 400 }
            );
        }

        if (perfil !== undefined) {
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
                usuarioAtual.perfil !== "MASTER" &&
                perfil === "SUPERVISORA"
            ) {
                return forbiddenResponse();
            }
        }

        if (email !== undefined) {
            const emailExistente = await db.execute({
                sql: `
            SELECT id
            FROM usuarios
            WHERE email = ?
              AND id <> ?
            LIMIT 1
        `,
                args: [email, id],
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
        }

        const campos: string[] = [];
        const valores: (string | number)[] = [];

        if (nome !== undefined) {
            campos.push("nome = ?");
            valores.push(nome);
        }

        if (email !== undefined) {
            campos.push("email = ?");
            valores.push(email);
        }

        if (perfil !== undefined) {
            campos.push("perfil = ?");
            valores.push(perfil);
        }

        if (ativo !== undefined) {
            campos.push("ativo = ?");
            valores.push(ativo);
        }

        if (campos.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Nenhum dado válido para alteração foi informado.",
                },
                { status: 400 }
            );
        }

        campos.push("atualizado_em = CURRENT_TIMESTAMP");

        valores.push(id);

        await db.execute({
            sql: `
                UPDATE usuarios
                SET ${campos.join(", ")}
                WHERE id = ?
            `,
            args: valores,
        });

        const usuarioAtualizadoResult = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    email,
                    perfil,
                    ativo,
                    criado_em,
                    atualizado_em
                FROM usuarios
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });



        const usuarioAtualizado = usuarioAtualizadoResult.rows[0];

        return NextResponse.json({
            success: true,
            message: "Usuário atualizado com sucesso.",
            usuario: usuarioAtualizado,
        });


    } catch (error) {
        console.error("Erro ao editar usuário:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível editar o usuário.",
            },
            { status: 500 }
        );
    }
}