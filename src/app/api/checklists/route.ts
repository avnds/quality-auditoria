import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export async function GET() {
    try {
        const resultado = await requirePermission("checklists.visualizar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const result = await db.execute({
            sql: `
                SELECT
                    c.id,
                    c.nome,
                    c.descricao,
                    c.ativo,
                    c.setor_id,
                    s.nome AS setor_nome
                FROM checklists c
                INNER JOIN setores s
                    ON s.id = c.setor_id
                ORDER BY
                    s.nome,
                    c.nome
            `,
            args: [],
        });

        return NextResponse.json({
            success: true,
            checklists: result.rows,
        });
    } catch (error) {
        console.error("Erro ao consultar checklists:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar os checklists.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const resultado = await requirePermission("checklists.criar");

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

        const setorId =
            typeof body.setor_id === "string"
                ? body.setor_id.trim()
                : "";

        if (!nome) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O nome do checklist é obrigatório.",
                },
                { status: 400 }
            );
        }

        if (!setorId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O setor é obrigatório.",
                },
                { status: 400 }
            );
        }

        const setor = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    ativo
                FROM setores
                WHERE id = ?
                LIMIT 1
            `,
            args: [setorId],
        });

        if (setor.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Setor não encontrado.",
                },
                { status: 404 }
            );
        }

        const setorEncontrado = setor.rows[0];

        if (Number(setorEncontrado.ativo) !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Não é possível criar checklist para um setor inativo.",
                },
                { status: 400 }
            );
        }

        const checklistExistente = await db.execute({
            sql: `
                SELECT id
                FROM checklists
                WHERE setor_id = ?
                  AND LOWER(nome) = LOWER(?)
                LIMIT 1
            `,
            args: [setorId, nome],
        });

        if (checklistExistente.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Já existe um checklist com este nome neste setor.",
                },
                { status: 409 }
            );
        }

        const id = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO checklists (
                    id,
                    setor_id,
                    nome,
                    descricao,
                    ativo
                )
                VALUES (?, ?, ?, ?, 1)
            `,
            args: [
                id,
                setorId,
                nome,
                descricao || null,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Checklist criado com sucesso.",
                checklist: {
                    id,
                    setor_id: setorId,
                    setor_nome: String(setorEncontrado.nome),
                    nome,
                    descricao: descricao || null,
                    ativo: 1,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao criar checklist:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível criar o checklist.",
            },
            { status: 500 }
        );
    }
}