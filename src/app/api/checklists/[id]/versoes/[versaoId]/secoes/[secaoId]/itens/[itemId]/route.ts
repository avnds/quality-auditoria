import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

type Params = {
    params: Promise<{
        id: string;
        versaoId: string;
        secaoId: string;
        itemId: string;
    }>;
};

async function validarItem(
    checklistId: string,
    versaoId: string,
    secaoId: string,
    itemId: string
) {
    const resultado = await db.execute({
        sql: `
            SELECT
                ci.id,
                ci.checklist_secao_id,
                ci.texto,
                ci.orientacao,
                ci.ordem,
                ci.ativo,
                ci.item_vencimento,
                cs.nome AS secao_nome,
                cv.id AS versao_id,
                cv.publicada,
                cv.numero AS versao_numero,
                c.id AS checklist_id,
                c.nome AS checklist_nome,
                c.ativo AS checklist_ativo
            FROM checklist_itens ci
            INNER JOIN checklist_secoes cs
                ON cs.id = ci.checklist_secao_id
            INNER JOIN checklist_versoes cv
                ON cv.id = cs.checklist_versao_id
            INNER JOIN checklists c
                ON c.id = cv.checklist_id
            WHERE ci.id = ?
              AND cs.id = ?
              AND cv.id = ?
              AND c.id = ?
            LIMIT 1
        `,
        args: [itemId, secaoId, versaoId, checklistId],
    });

    if (resultado.rows.length === 0) {
        return null;
    }

    return resultado.rows[0];
}

export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { id, versaoId, secaoId, itemId } = await params;

        const permissao = await requirePermission("checklists.editar");

        if (!permissao.autorizado) {
            return NextResponse.json(
                { message: "Você não tem permissão para editar itens." },
                { status: 403 }
            );
        }

        if (
            permissao.usuario.perfil !== "MASTER" &&
            permissao.usuario.perfil !== "SUPERVISORA"
        ) {
            return NextResponse.json(
                { message: "Você não tem permissão para editar itens." },
                { status: 403 }
            );
        }

        const itemAtual = await validarItem(
            id,
            versaoId,
            secaoId,
            itemId
        );

        if (!itemAtual) {
            return NextResponse.json(
                { message: "Item não encontrado." },
                { status: 404 }
            );
        }

        if (Number(itemAtual.checklist_ativo) !== 1) {
            return NextResponse.json(
                {
                    message:
                        "Não é possível editar um item de um checklist inativo.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const texto =
            typeof body.texto === "string"
                ? body.texto.trim()
                : "";

        const orientacao =
            typeof body.orientacao === "string"
                ? body.orientacao.trim()
                : "";

        const itemVencimento =
            body.item_vencimento === undefined
                ? Number(itemAtual.item_vencimento) === 1
                    ? 1
                    : Number(itemAtual.item_vencimento) === 0
                        ? 0
                        : null
                : body.item_vencimento === null
                    ? null
                    : body.item_vencimento === true ||
                        body.item_vencimento === 1
                        ? 1
                        : body.item_vencimento === false ||
                            body.item_vencimento === 0
                            ? 0
                            : null;

        if (
            body.item_vencimento !== undefined &&
            body.item_vencimento !== null &&
            ![true, false, 0, 1].includes(body.item_vencimento)
        ) {
            return NextResponse.json(
                {
                    message: "O campo item_vencimento deve ser verdadeiro ou falso.",
                },
                { status: 400 }
            );
        }

        const ordem =
            typeof body.ordem === "number"
                ? body.ordem
                : Number(body.ordem);

        if (!texto) {
            return NextResponse.json(
                { message: "O texto do item é obrigatório." },
                { status: 400 }
            );
        }

        if (!Number.isInteger(ordem) || ordem <= 0) {
            return NextResponse.json(
                {
                    message:
                        "A ordem do item deve ser um número inteiro maior que zero.",
                },
                { status: 400 }
            );
        }

        const duplicado = await db.execute({
            sql: `
                SELECT id
                FROM checklist_itens
                WHERE checklist_secao_id = ?
                  AND ordem = ?
                  AND id <> ?
                LIMIT 1
            `,
            args: [secaoId, ordem, itemId],
        });

        if (duplicado.rows.length > 0) {
            return NextResponse.json(
                {
                    message:
                        "Já existe um item com essa ordem nesta seção.",
                },
                { status: 409 }
            );
        }

        await db.execute({
            sql: `
        UPDATE checklist_itens
        SET
            texto = ?,
            orientacao = ?,
            ordem = ?,
            item_vencimento = ?
        WHERE id = ?
          AND checklist_secao_id = ?
    `,
            args: [
                texto,
                orientacao || null,
                ordem,
                itemVencimento,
                itemId,
                secaoId,
            ],
        });

        const atualizado = await validarItem(
            id,
            versaoId,
            secaoId,
            itemId
        );

        return NextResponse.json({
            message: "Item atualizado com sucesso.",
            item: {
                id: String(atualizado?.id),
                texto: String(atualizado?.texto),
                orientacao:
                    atualizado?.orientacao === null ||
                        atualizado?.orientacao === undefined
                        ? null
                        : String(atualizado.orientacao),
                ordem: Number(atualizado?.ordem),
                ativo: Number(atualizado?.ativo) === 1,
                item_vencimento:
                    atualizado?.item_vencimento === null ||
                        atualizado?.item_vencimento === undefined
                        ? null
                        : Number(atualizado.item_vencimento),
            },
        });
    } catch (error) {
        console.error("Erro ao editar item do checklist:", error);

        return NextResponse.json(
            {
                message: "Não foi possível editar o item do checklist.",
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: Params
) {
    try {
        const { id, versaoId, secaoId, itemId } = await params;

        const permissao = await requirePermission("checklists.editar");

        if (!permissao.autorizado) {
            return NextResponse.json(
                { message: "Você não tem permissão para excluir itens." },
                { status: 403 }
            );
        }

        if (
            permissao.usuario.perfil !== "MASTER" &&
            permissao.usuario.perfil !== "SUPERVISORA"
        ) {
            return NextResponse.json(
                { message: "Você não tem permissão para excluir itens." },
                { status: 403 }
            );
        }

        const itemAtual = await validarItem(
            id,
            versaoId,
            secaoId,
            itemId
        );

        if (!itemAtual) {
            return NextResponse.json(
                { message: "Item não encontrado." },
                { status: 404 }
            );
        }

        if (Number(itemAtual.checklist_ativo) !== 1) {
            return NextResponse.json(
                {
                    message:
                        "Não é possível excluir itens de um checklist inativo.",
                },
                { status: 400 }
            );
        }

        if (Number(itemAtual.publicada) === 1) {
            return NextResponse.json(
                {
                    message:
                        "Não é possível excluir itens de uma versão publicada. Crie uma nova versão do checklist para fazer alterações.",
                },
                { status: 409 }
            );
        }

        const respostasVinculadas = await db.execute({
            sql: `
                SELECT id
                FROM auditoria_respostas
                WHERE checklist_item_id = ?
                LIMIT 1
            `,
            args: [itemId],
        });

        if (respostasVinculadas.rows.length > 0) {
            return NextResponse.json(
                {
                    message:
                        "Este item não pode ser excluído porque está vinculado a respostas de auditorias. Preserve o histórico e utilize uma nova versão do checklist.",
                },
                { status: 409 }
            );
        }

        const resultado = await db.execute({
            sql: `
                DELETE FROM checklist_itens
                WHERE id = ?
                  AND checklist_secao_id = ?
            `,
            args: [itemId, secaoId],
        });

        if (Number(resultado.rowsAffected) === 0) {
            return NextResponse.json(
                { message: "O item não foi encontrado para exclusão." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            message: "Item excluído com sucesso.",
        });
    } catch (error) {
        console.error("Erro ao excluir item do checklist:", error);

        return NextResponse.json(
            {
                message:
                    "Não foi possível excluir o item. Verifique se ele possui vínculos com auditorias.",
            },
            { status: 500 }
        );
    }
}