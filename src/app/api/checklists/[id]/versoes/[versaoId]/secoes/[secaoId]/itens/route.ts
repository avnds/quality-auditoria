
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
        secaoId: string;
    }>;
};

async function validarSecao(
    checklistId: string,
    versaoId: string,
    secaoId: string
) {
    const resultado = await db.execute({
        sql: `
            SELECT
                cs.id,
                cs.checklist_versao_id,
                cs.nome AS secao_nome,
                cs.descricao AS secao_descricao,
                cs.ordem AS secao_ordem,
                cv.numero AS versao_numero,
                cv.publicada,
                c.id AS checklist_id,
                c.nome AS checklist_nome,
                c.ativo AS checklist_ativo
            FROM checklist_secoes cs
            INNER JOIN checklist_versoes cv
                ON cv.id = cs.checklist_versao_id
            INNER JOIN checklists c
                ON c.id = cv.checklist_id
            WHERE cs.id = ?
              AND cs.checklist_versao_id = ?
              AND cv.checklist_id = ?
            LIMIT 1
        `,
        args: [secaoId, versaoId, checklistId],
    });

    if (resultado.rows.length === 0) {
        return null;
    }

    const row = resultado.rows[0];

    return {
        id: String(row.id),
        checklist_versao_id: String(
            row.checklist_versao_id
        ),
        secao_nome: String(row.secao_nome),
        secao_descricao:
            row.secao_descricao === null ||
            row.secao_descricao === undefined
                ? null
                : String(row.secao_descricao),
        secao_ordem: Number(row.secao_ordem),
        versao_numero: Number(row.versao_numero),
        publicada: Number(row.publicada) === 1,
        checklist_id: String(row.checklist_id),
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

        const { id, versaoId, secaoId } =
            await context.params;

        const secao = await validarSecao(
            id,
            versaoId,
            secaoId
        );

        if (!secao) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Seção do checklist não encontrada.",
                },
                { status: 404 }
            );
        }

        const resultadoItens = await db.execute({
            sql: `
                SELECT
                    id,
                    checklist_secao_id,
                    texto,
                    orientacao,
                    ordem,
                    ativo
                FROM checklist_itens
                WHERE checklist_secao_id = ?
                ORDER BY ordem ASC
            `,
            args: [secaoId],
        });

        const maiorOrdemResult = await db.execute({
            sql: `
                SELECT
                    COALESCE(MAX(ordem), 0) AS maior_ordem
                FROM checklist_itens
                WHERE checklist_secao_id = ?
            `,
            args: [secaoId],
        });

        const maiorOrdem = Number(
            maiorOrdemResult.rows[0]?.maior_ordem ?? 0
        );

        const proximaOrdem = maiorOrdem + 1;

        const itens = resultadoItens.rows.map((row) => ({
            id: String(row.id),
            checklist_secao_id: String(
                row.checklist_secao_id
            ),
            texto: String(row.texto),
            orientacao:
                row.orientacao === null ||
                row.orientacao === undefined
                    ? null
                    : String(row.orientacao),
            ordem: Number(row.ordem),
            ativo: Number(row.ativo) === 1,
        }));

        return NextResponse.json({
            success: true,
            checklist: {
                id: secao.checklist_id,
                nome: secao.checklist_nome,
                ativo: secao.checklist_ativo,
            },
            versao: {
                id: versaoId,
                numero: secao.versao_numero,
                publicada: secao.publicada,
            },
            secao: {
                id: secao.id,
                nome: secao.secao_nome,
                descricao: secao.secao_descricao,
                ordem: secao.secao_ordem,
            },
            itens,
            proximaOrdem,
        });
    } catch (error) {
        console.error(
            "Erro ao consultar itens do checklist:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível consultar os itens do checklist.",
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

        const { id, versaoId, secaoId } =
            await context.params;

        const secao = await validarSecao(
            id,
            versaoId,
            secaoId
        );

        if (!secao) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Seção do checklist não encontrada.",
                },
                { status: 404 }
            );
        }

        if (!secao.checklist_ativo) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Não é possível criar um item em um checklist inativo.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const catalogoItemId =
            typeof body.catalogoItemId === "string"
                ? body.catalogoItemId.trim()
                : "";

        const texto =
            typeof body.texto === "string"
                ? body.texto.trim()
                : "";

        const orientacao =
            typeof body.orientacao === "string"
                ? body.orientacao.trim()
                : "";

        const ordem =
            typeof body.ordem === "number"
                ? body.ordem
                : Number(body.ordem);

        let textoFinal = texto;

        if (catalogoItemId) {
            const catalogoResult = await db.execute({
                sql: `
                    SELECT
                        id,
                        texto
                    FROM catalogo_itens
                    WHERE id = ?
                    LIMIT 1
                `,
                args: [catalogoItemId],
            });

            if (catalogoResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Item do catálogo não encontrado.",
                    },
                    { status: 404 }
                );
            }

            textoFinal = String(
                catalogoResult.rows[0].texto
            );
        }

        if (!textoFinal) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O texto do item é obrigatório.",
                },
                { status: 400 }
            );
        }

        if (!Number.isInteger(ordem) || ordem <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A ordem do item deve ser um número inteiro maior que zero.",
                },
                { status: 400 }
            );
        }

        const ordemExistente = await db.execute({
            sql: `
                SELECT
                    id
                FROM checklist_itens
                WHERE checklist_secao_id = ?
                  AND ordem = ?
                LIMIT 1
            `,
            args: [secaoId, ordem],
        });

        if (ordemExistente.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Já existe um item com essa ordem nesta seção.",
                },
                { status: 409 }
            );
        }

        const itemId = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO checklist_itens (
                    id,
                    checklist_secao_id,
                    texto,
                    orientacao,
                    ordem,
                    ativo,
                    catalogo_item_id
                )
                VALUES (?, ?, ?, ?, ?, 1, ?)
            `,
            args: [
                itemId,
                secaoId,
                textoFinal,
                orientacao || null,
                ordem,
                catalogoItemId || null,
            ],
        });

        return NextResponse.json(
            {
                success: true,
                message: "Item criado com sucesso.",
                item: {
                    id: itemId,
                    checklist_secao_id: secaoId,
                    texto: textoFinal,
                    orientacao: orientacao || null,
                    ordem,
                    ativo: true,
                    catalogo_item_id:
                        catalogoItemId || null,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "Erro ao criar item do checklist:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível criar o item do checklist.",
            },
            { status: 500 }
        );
    }
}