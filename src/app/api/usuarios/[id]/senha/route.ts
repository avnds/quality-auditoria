import { NextResponse } from "next/server";
import db from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resultado = await requirePermission(
            "usuarios.consultor.editar"
        );

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

        // Ninguém pode alterar a própria senha por este endpoint.
        if (usuarioAtual.id === String(usuarioAlvo.id)) {
            return forbiddenResponse();
        }

        // A senha do MASTER não pode ser alterada por este endpoint.
        if (String(usuarioAlvo.perfil) === "MASTER") {
            return forbiddenResponse();
        }

        // SUPERVISORA só pode alterar senha de CONSULTOR.
        if (
            usuarioAtual.perfil === "SUPERVISORA" &&
            String(usuarioAlvo.perfil) !== "CONSULTOR"
        ) {
            return forbiddenResponse();
        }

        const body = await request.json();

        const senha =
            typeof body.senha === "string"
                ? body.senha
                : "";

        if (!senha) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A nova senha é obrigatória.",
                },
                { status: 400 }
            );
        }

        const senhaHash = await hashPassword(senha);

        await db.execute({
            sql: `
                UPDATE usuarios
                SET
                    senha_hash = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [senhaHash, id],
        });

        // Ao alterar a senha, todas as sessões anteriores
        // do usuário-alvo são encerradas.
        await db.execute({
            sql: `
                UPDATE sessoes
                SET encerrada_em = CURRENT_TIMESTAMP
                WHERE usuario_id = ?
                  AND encerrada_em IS NULL
            `,
            args: [id],
        });

        return NextResponse.json({
            success: true,
            message: "Senha atualizada com sucesso.",
        });
    } catch (error) {
        console.error("Erro ao alterar senha:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível alterar a senha.",
            },
            { status: 500 }
        );
    }
}