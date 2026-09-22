
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
        versaoId: string;
    }>;
};

async function validarVersao(
    checklistId: string,
    versaoId: string
) {
    const resultado = await db.execute({
        sql: `
            SELECT
                cv.id,
                cv.checklist_id,
                cv.numero,
                cv.descricao,
                cv.publicada,
                c.nome AS checklist_nome,
                c.ativo AS checklist_ativo
            FROM checklist_versoes cv
            INNER JOIN checklists c
                ON c.id = cv.checklist_id
            WHERE cv.id = ?
              AND cv.checklist_id = ?
            LIMIT 1
        `,
        args: [versaoId, checklistId],
    });

    if (resultado.rows.length === 0) {
        return null;
    }

    const row = resultado.rows[0];

    return {
        id: String(row.id),
        checklist_id: String(row.checklist_id),
        numero: Number(row.numero),
        descricao:
            row.descricao === null ||
            row.descricao === undefined
                ? null
                : String(row.descricao),
        publicada: Number(row.publicada) === 1,
        checklist_nome: String(row.checklist_nome),
        checklist_ativo: Number(row.checklist_ativo) === 1,
    };
}

export async function GET(
    _request: Request,
    context: RouteContext
) {
    try {
        const resultado = await requirePermission(
            "checklists.visualizar"
        );

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const { id, versaoId } = await context.params;

        const versao = await validarVersao(id, versaoId);

        if (!versao) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Versão do checklist não encontrada.",
                },
                { status: 404 }
            );
        }

        const resultadoSecoes = await db.execute({
            sql: `
                SELECT
                    id,
                    checklist_versao_id,
                    nome,
                    descricao,
                    ordem
                FROM checklist_secoes
                WHERE checklist_versao_id = ?
                ORDER BY ordem ASC
            `,
            args: [versaoId],
        });

        const secoes = resultadoSecoes.rows.map((row) => ({
            id: String(row.id),
            checklist_versao_id: String(
                row.checklist_versao_id
            ),
            nome: String(row.nome),
            descricao:
                row.descricao === null ||
                row.descricao === undefined
                    ? null
                    : String(row.descricao),
            ordem: Number(row.ordem),
        }));

        return NextResponse.json({
            success: true,
            checklist: {
                id: id,
                nome: versao.checklist_nome,
                ativo: versao.checklist_ativo,
            },
            versao,
            secoes,
        });
    } catch (error) {
        console.error(
            "Erro ao consultar seções do checklist:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível consultar as seções do checklist.",
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
        const resultado = await requirePermission(
            "checklists.editar"
        );

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

        const { id, versaoId } = await context.params;

        const versao = await validarVersao(id, versaoId);

        if (!versao) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Versão do checklist não encontrada.",
                },
                { status: 404 }
            );
        }

        if (!versao.checklist_ativo) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Não é possível criar uma seção em um checklist inativo.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const catalogoSecaoId =
            typeof body.catalogoSecaoId === "string"
                ? body.catalogoSecaoId.trim()
                : "";

        const nome =
            typeof body.nome === "string"
                ? body.nome.trim()
                : "";

        const descricao =
            typeof body.descricao === "string"
                ? body.descricao.trim()
                : "";

        let nomeFinal = nome;

        if (catalogoSecaoId) {
            const catalogoResult = await db.execute({
                sql: `
                    SELECT
                        id,
                        nome
                    FROM catalogo_secoes
                    WHERE id = ?
                    LIMIT 1
                `,
                args: [catalogoSecaoId],
            });

            if (catalogoResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Seção do catálogo não encontrada.",
                    },
                    { status: 404 }
                );
            }

            nomeFinal = String(catalogoResult.rows[0].nome);
        }

        if (!nomeFinal) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O nome da seção é obrigatório.",
                },
                { status: 400 }
            );
        }

        const ultimaSecao = await db.execute({
            sql: `
                SELECT
                    ordem
                FROM checklist_secoes
                WHERE checklist_versao_id = ?
                ORDER BY ordem DESC
                LIMIT 1
            `,
            args: [versaoId],
        });

        const proximaOrdem =
            ultimaSecao.rows.length > 0
                ? Number(ultimaSecao.rows[0].ordem) + 1
                : 1;

        const secaoId = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO checklist_secoes (
                    id,
                    checklist_versao_id,
                    nome,
                    descricao,
                    ordem,
                    catalogo_secao_id
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [
                secaoId,
                versaoId,
                nomeFinal,
                descricao || null,
                proximaOrdem,
                catalogoSecaoId || null,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Seção criada com sucesso.",
                secao: {
                    id: secaoId,
                    checklist_versao_id: versaoId,
                    nome: nomeFinal,
                    catalogo_secao_id:
                        catalogoSecaoId || null,
                    descricao: descricao || null,
                    ordem: proximaOrdem,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "Erro ao criar seção do checklist:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível criar a seção do checklist.",
            },
            { status: 500 }
        );
    }
}
