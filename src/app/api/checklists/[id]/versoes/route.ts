import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

export async function GET(
    _request: Request,
    context: RouteContext
) {
    try {
        const resultado = await requirePermission("checklists.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const { id } = await context.params;

        const checklist = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    ativo
                FROM checklists
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (checklist.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Checklist não encontrado.",
                },
                { status: 404 }
            );
        }

        const resultadoVersoes = await db.execute({
            sql: `
                SELECT
                    id,
                    checklist_id,
                    numero,
                    descricao,
                    publicada,
                    criada_em
                FROM checklist_versoes
                WHERE checklist_id = ?
                ORDER BY numero DESC
            `,
            args: [id],
        });

        const versoes = resultadoVersoes.rows.map((row) => ({
            id: String(row.id),
            checklist_id: String(row.checklist_id),
            numero: Number(row.numero),
            descricao:
                row.descricao === null ||
                row.descricao === undefined
                    ? null
                    : String(row.descricao),
            publicada: Number(row.publicada) === 1,
            criada_em: String(row.criada_em),
        }));

        return NextResponse.json({
            success: true,
            checklist: {
                id: String(checklist.rows[0].id),
                nome: String(checklist.rows[0].nome),
                ativo: Number(checklist.rows[0].ativo) === 1,
            },
            versoes,
        });
    } catch (error) {
        console.error("Erro ao consultar versões do checklist:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar as versões do checklist.",
            },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    context: RouteContext
) {
    try {
        const resultado = await requirePermission("checklists.criar_versao");

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

        const { id } = await context.params;

        const checklist = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    ativo
                FROM checklists
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });

        if (checklist.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Checklist não encontrado.",
                },
                { status: 404 }
            );
        }

        if (Number(checklist.rows[0].ativo) !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Não é possível criar uma versão para um checklist inativo.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const descricao =
            typeof body.descricao === "string"
                ? body.descricao.trim()
                : "";

        const ultimaVersao = await db.execute({
            sql: `
                SELECT
                    numero
                FROM checklist_versoes
                WHERE checklist_id = ?
                ORDER BY numero DESC
                LIMIT 1
            `,
            args: [id],
        });

        const proximoNumero =
            ultimaVersao.rows.length > 0
                ? Number(ultimaVersao.rows[0].numero) + 1
                : 1;

        const versaoId = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO checklist_versoes (
                    id,
                    checklist_id,
                    numero,
                    descricao,
                    publicada
                )
                VALUES (?, ?, ?, ?, 0)
            `,
            args: [
                versaoId,
                id,
                proximoNumero,
                descricao || null,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: `Versão ${proximoNumero} criada com sucesso.`,
                versao: {
                    id: versaoId,
                    checklist_id: id,
                    numero: proximoNumero,
                    descricao: descricao || null,
                    publicada: false,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao criar versão do checklist:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível criar a versão do checklist.",
            },
            { status: 500 }
        );
    }
}