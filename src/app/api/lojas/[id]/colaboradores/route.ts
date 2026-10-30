import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type RouteContext = {
    params: Promise<{ id: string }>;
};

async function usuarioPodeAcessarLoja(
    lojaId: string,
    usuario: { id: string; perfil: string }
) {
    if (usuario.perfil === "MASTER" || usuario.perfil === "SUPERVISORA") {
        const result = await db.execute({
            sql: "SELECT id FROM lojas WHERE id = ? LIMIT 1",
            args: [lojaId],
        });
        return result.rows.length > 0;
    }

    const result = await db.execute({
        sql: `
            SELECT l.id
            FROM lojas l
            INNER JOIN usuario_lojas ul ON ul.loja_id = l.id
            WHERE l.id = ? AND ul.usuario_id = ?
            LIMIT 1
        `,
        args: [lojaId, usuario.id],
    });

    return result.rows.length > 0;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const auth = await requirePermission("colaboradores.visualizar");

        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const { id: lojaId } = await context.params;

        if (!(await usuarioPodeAcessarLoja(lojaId, auth.usuario))) {
            return forbiddenResponse();
        }

        const result = await db.execute({
            sql: `
                SELECT id, loja_id, nome, cargo, email, telefone, ativo,
                       criado_em, atualizado_em
                FROM colaboradores
                WHERE loja_id = ?
                ORDER BY ativo DESC, nome
            `,
            args: [lojaId],
        });

        return NextResponse.json({ success: true, colaboradores: result.rows });
    } catch (error) {
        console.error("Erro ao consultar colaboradores:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível consultar os colaboradores." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request, context: RouteContext) {
    try {
        const auth = await requirePermission("colaboradores.gerenciar");

        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const { id: lojaId } = await context.params;

        if (
            auth.usuario.perfil !== "MASTER" &&
            auth.usuario.perfil !== "SUPERVISORA"
        ) {
            return forbiddenResponse();
        }

        const loja = await db.execute({
            sql: "SELECT id FROM lojas WHERE id = ? LIMIT 1",
            args: [lojaId],
        });

        if (loja.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Loja não encontrada." },
                { status: 404 }
            );
        }

        const body = await request.json();
        const nome = typeof body.nome === "string" ? body.nome.trim() : "";
        const cargo = typeof body.cargo === "string" ? body.cargo.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim() : "";
        const telefone = typeof body.telefone === "string" ? body.telefone.trim() : "";

        if (!nome) {
            return NextResponse.json(
                { success: false, message: "O nome do colaborador é obrigatório." },
                { status: 400 }
            );
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json(
                { success: false, message: "Informe um e-mail válido." },
                { status: 400 }
            );
        }

        const colaboradorId = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO colaboradores (
                    id, loja_id, nome, cargo, email, telefone, ativo
                )
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `,
            args: [
                colaboradorId,
                lojaId,
                nome,
                cargo || null,
                email || null,
                telefone || null,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Colaborador cadastrado com sucesso.",
                colaborador: {
                    id: colaboradorId,
                    loja_id: lojaId,
                    nome,
                    cargo: cargo || null,
                    email: email || null,
                    telefone: telefone || null,
                    ativo: 1,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao cadastrar colaborador:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível cadastrar o colaborador." },
            { status: 500 }
        );
    }
}
