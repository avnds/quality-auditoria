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

async function buscarColaborador(id: string) {
    return db.execute({
        sql: `
            SELECT c.id, c.loja_id, c.nome, c.cargo, c.email, c.telefone, c.ativo
            FROM colaboradores c
            WHERE c.id = ?
            LIMIT 1
        `,
        args: [id],
    });
}

async function podeAcessarLoja(
    lojaId: string,
    usuario: { id: string; perfil: string }
) {
    if (usuario.perfil === "MASTER" || usuario.perfil === "SUPERVISORA") {
        return true;
    }

    const result = await db.execute({
        sql: `
            SELECT 1
            FROM usuario_lojas
            WHERE loja_id = ? AND usuario_id = ?
            LIMIT 1
        `,
        args: [lojaId, usuario.id],
    });

    return result.rows.length > 0;
}

export async function PUT(request: Request, context: RouteContext) {
    try {
        const auth = await requirePermission("colaboradores.gerenciar");

        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const { id } = await context.params;
        const existente = await buscarColaborador(id);

        if (existente.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Colaborador não encontrado." },
                { status: 404 }
            );
        }

        const colaborador = existente.rows[0];

        if (
            !(await podeAcessarLoja(String(colaborador.loja_id), auth.usuario)) ||
            (auth.usuario.perfil !== "MASTER" && auth.usuario.perfil !== "SUPERVISORA")
        ) {
            return forbiddenResponse();
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

        await db.execute({
            sql: `
                UPDATE colaboradores
                SET nome = ?, cargo = ?, email = ?, telefone = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [nome, cargo || null, email || null, telefone || null, id],
        });

        return NextResponse.json({
            success: true,
            message: "Colaborador atualizado com sucesso.",
        });
    } catch (error) {
        console.error("Erro ao editar colaborador:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível atualizar o colaborador." },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const auth = await requirePermission("colaboradores.gerenciar");

        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const { id } = await context.params;
        const existente = await buscarColaborador(id);

        if (existente.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Colaborador não encontrado." },
                { status: 404 }
            );
        }

        const colaborador = existente.rows[0];

        if (
            !(await podeAcessarLoja(String(colaborador.loja_id), auth.usuario)) ||
            (auth.usuario.perfil !== "MASTER" && auth.usuario.perfil !== "SUPERVISORA")
        ) {
            return forbiddenResponse();
        }

        const body = await request.json();
        const ativo =
            body.ativo === true || body.ativo === 1
                ? 1
                : body.ativo === false || body.ativo === 0
                    ? 0
                    : null;

        if (ativo === null) {
            return NextResponse.json(
                { success: false, message: "O status informado é inválido." },
                { status: 400 }
            );
        }

        await db.execute({
            sql: `
                UPDATE colaboradores
                SET ativo = ?, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [ativo, id],
        });

        return NextResponse.json({
            success: true,
            message: ativo ? "Colaborador ativado com sucesso." : "Colaborador inativado com sucesso.",
            ativo,
        });
    } catch (error) {
        console.error("Erro ao alterar status do colaborador:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível alterar o status do colaborador." },
            { status: 500 }
        );
    }
}
