import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;

        const permissao = await requirePermission("checklists.criar_versao");

        if (!permissao.autorizado) {
            return NextResponse.json(
                { message: "Você não tem permissão para criar versões." },
                { status: 403 }
            );
        }

        if (
            permissao.usuario.perfil !== "MASTER" &&
            permissao.usuario.perfil !== "SUPERVISORA"
        ) {
            return NextResponse.json(
                { message: "Você não tem permissão para criar versões." },
                { status: 403 }
            );
        }

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
                { message: "Checklist não encontrado." },
                { status: 404 }
            );
        }

        if (Number(checklist.rows[0].ativo) !== 1) {
            return NextResponse.json(
                {
                    message:
                        "Não é possível criar uma versão de um checklist inativo.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const descricaoInformada =
            typeof body.descricao === "string"
                ? body.descricao.trim()
                : "";

        const ultimaVersao = await db.execute({
            sql: `
                SELECT
                    id,
                    numero,
                    descricao
                FROM checklist_versoes
                WHERE checklist_id = ?
                ORDER BY numero DESC
                LIMIT 1
            `,
            args: [id],
        });

        const ultimaVersaoRow = ultimaVersao.rows[0];

        const proximoNumero =
            ultimaVersaoRow === undefined
                ? 1
                : Number(ultimaVersaoRow.numero) + 1;

        const versaoId = crypto.randomUUID();

        const descricao =
            descricaoInformada ||
            (ultimaVersaoRow?.descricao === null ||
                ultimaVersaoRow?.descricao === undefined
                ? null
                : String(ultimaVersaoRow.descricao));

        /*
         * Primeira versão:
         * cria apenas a versão, sem seções e itens.
         *
         * Próximas versões:
         * clona a última versão inteira.
         */
        if (ultimaVersaoRow === undefined) {
            await db.batch(
                [
                    {
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
                            descricao,
                        ],
                    },
                ],
                "write"
            );

            return NextResponse.json(
                {
                    message: "Versão criada com sucesso.",
                    versao: {
                        id: versaoId,
                        checklist_id: id,
                        numero: proximoNumero,
                        descricao,
                        publicada: false,
                    },
                    secoes_clonadas: 0,
                    itens_clonados: 0,
                },
                { status: 201 }
            );
        }

        /*
         * Busca todas as seções da última versão.
         */
        const secoesAnteriores = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    descricao,
                    ordem,
                    catalogo_secao_id
                FROM checklist_secoes
                WHERE checklist_versao_id = ?
                ORDER BY ordem ASC
            `,
            args: [String(ultimaVersaoRow.id)],
        });

        const statements: Array<{
            sql: string;
            args: (string | number | null)[];
        }> = [];

        /*
         * Primeiro cria a nova versão.
         */
        statements.push({
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
                descricao,
            ],
        });

        let secoesClonadas = 0;
        let itensClonados = 0;

        /*
         * Clona cada seção e todos os seus itens.
         */
        for (const secao of secoesAnteriores.rows) {
            const novaSecaoId = crypto.randomUUID();

            statements.push({
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
                    novaSecaoId,
                    versaoId,
                    String(secao.nome),
                    secao.descricao === null ||
                        secao.descricao === undefined
                        ? null
                        : String(secao.descricao),
                    Number(secao.ordem),
                    secao.catalogo_secao_id === null ||
                        secao.catalogo_secao_id === undefined
                        ? null
                        : String(secao.catalogo_secao_id),
                ],
            });

            secoesClonadas++;

            const itensAnteriores = await db.execute({
                sql: `
                    SELECT
                        texto,
                        orientacao,
                        ordem,
                        ativo,
                        catalogo_item_id
                    FROM checklist_itens
                    WHERE checklist_secao_id = ?
                    ORDER BY ordem ASC
                `,
                args: [String(secao.id)],
            });

            for (const item of itensAnteriores.rows) {
                const novoItemId = crypto.randomUUID();

                statements.push({
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
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        novoItemId,
                        novaSecaoId,
                        String(item.texto),
                        item.orientacao === null ||
                            item.orientacao === undefined
                            ? null
                            : String(item.orientacao),
                        Number(item.ordem),
                        Number(item.ativo),
                        item.catalogo_item_id === null ||
                            item.catalogo_item_id === undefined
                            ? null
                            : String(item.catalogo_item_id),
                    ],
                });

                itensClonados++;
            }
        }

        /*
         * Tudo é executado em uma única transação.
         * Se qualquer INSERT falhar, a nova versão e
         * seus registros clonados não ficam parcialmente criados.
         */
        await db.batch(statements, "write");

        return NextResponse.json(
            {
                message: "Versão criada e clonada com sucesso.",
                versao: {
                    id: versaoId,
                    checklist_id: id,
                    numero: proximoNumero,
                    descricao,
                    publicada: false,
                },
                secoes_clonadas: secoesClonadas,
                itens_clonados: itensClonados,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao criar versão do checklist:", error);

        return NextResponse.json(
            {
                message: "Não foi possível criar a versão do checklist.",
            },
            { status: 500 }
        );
    }
}
export async function PATCH(
    request: Request,
    context: RouteContext
) {
    try {
        const resultado = await requirePermission(
            "checklists.ativar_versao"
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

        const { id } = await context.params;

        const body = await request.json();

        const versaoId =
            typeof body.versaoId === "string"
                ? body.versaoId.trim()
                : "";

        const publicada =
            typeof body.publicada === "boolean"
                ? body.publicada
                : null;

        if (!versaoId || publicada === null) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Versão e status de publicação são obrigatórios.",
                },
                { status: 400 }
            );
        }

        const versaoResult = await db.execute({
            sql: `
                SELECT
                    id,
                    checklist_id,
                    numero,
                    publicada
                FROM checklist_versoes
                WHERE id = ?
                  AND checklist_id = ?
                LIMIT 1
            `,
            args: [versaoId, id],
        });

        if (versaoResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Versão do checklist não encontrada.",
                },
                { status: 404 }
            );
        }

        await db.execute({
            sql: `
                UPDATE checklist_versoes
                SET publicada = ?
                WHERE id = ?
                  AND checklist_id = ?
            `,
            args: [
                publicada ? 1 : 0,
                versaoId,
                id,
            ],
        });

        return NextResponse.json({
            success: true,
            message: publicada
                ? "Versão publicada com sucesso."
                : "Versão despublicada com sucesso.",
            versao: {
                id: versaoId,
                numero: Number(versaoResult.rows[0].numero),
                publicada,
            },
        });
    } catch (error) {
        console.error(
            "Erro ao alterar publicação da versão:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível alterar o status da versão.",
            },
            { status: 500 }
        );
    }
}