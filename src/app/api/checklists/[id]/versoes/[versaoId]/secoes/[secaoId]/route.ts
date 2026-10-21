import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

type RouteContext = {
    params: Promise<{
        id: string;
        versaoId: string;
        secaoId: string;
    }>;
};

export async function DELETE(
    _request: NextRequest,
    { params }: RouteContext
) {
    let tx: Awaited<ReturnType<typeof db.transaction>> | null = null;

    try {
        const { id, versaoId, secaoId } = await params;

        const permissao = await requirePermission("checklists.editar");

        if (
            !permissao.autorizado ||
            (permissao.usuario.perfil !== "MASTER" &&
                permissao.usuario.perfil !== "SUPERVISORA")
        ) {
            return NextResponse.json(
                { message: "Você não tem permissão para excluir seções." },
                { status: 403 }
            );
        }

        const secao = await db.execute({
            sql: `
                SELECT
                    cs.id,
                    cs.nome,
                    cv.publicada,
                    c.ativo AS checklist_ativo
                FROM checklist_secoes cs
                INNER JOIN checklist_versoes cv
                    ON cv.id = cs.checklist_versao_id
                INNER JOIN checklists c
                    ON c.id = cv.checklist_id
                WHERE cs.id = ?
                  AND cv.id = ?
                  AND c.id = ?
                LIMIT 1
            `,
            args: [secaoId, versaoId, id],
        });

        if (secao.rows.length === 0) {
            return NextResponse.json(
                { message: "Seção não encontrada." },
                { status: 404 }
            );
        }

        const secaoAtual = secao.rows[0];

        if (Number(secaoAtual.checklist_ativo) !== 1) {
            return NextResponse.json(
                {
                    message:
                        "Não é possível excluir seções de um checklist inativo.",
                },
                { status: 400 }
            );
        }

        if (Number(secaoAtual.publicada) === 1) {
            return NextResponse.json(
                {
                    message:
                        "Não é possível excluir uma seção de uma versão publicada. Crie uma nova versão do checklist para fazer alterações.",
                },
                { status: 409 }
            );
        }

        const respostasVinculadas = await db.execute({
            sql: `
                SELECT ar.id
                FROM auditoria_respostas ar
                INNER JOIN checklist_itens ci
                    ON ci.id = ar.checklist_item_id
                WHERE ci.checklist_secao_id = ?
                LIMIT 1
            `,
            args: [secaoId],
        });

        if (respostasVinculadas.rows.length > 0) {
            return NextResponse.json(
                {
                    message:
                        "Esta seção não pode ser excluída porque possui itens vinculados a respostas de auditorias. Preserve o histórico e utilize uma nova versão do checklist.",
                },
                { status: 409 }
            );
        }

        tx = await db.transaction("write");

        await tx.execute({
            sql: `
                DELETE FROM checklist_itens
                WHERE checklist_secao_id = ?
            `,
            args: [secaoId],
        });

        const resultado = await tx.execute({
            sql: `
                DELETE FROM checklist_secoes
                WHERE id = ?
                  AND checklist_versao_id = ?
            `,
            args: [secaoId, versaoId],
        });

        if (Number(resultado.rowsAffected) === 0) {
            await tx.rollback();
            tx = null;

            return NextResponse.json(
                { message: "A seção não foi encontrada para exclusão." },
                { status: 404 }
            );
        }

        await tx.commit();
        tx = null;

        return NextResponse.json({
            message: "Seção e seus itens excluídos com sucesso.",
        });
    } catch (error) {
        if (tx) {
            try {
                await tx.rollback();
            } catch (erroRollback) {
                console.error(
                    "Erro ao reverter exclusão da seção:",
                    erroRollback
                );
            }
        }

        console.error("Erro ao excluir seção do checklist:", error);

        return NextResponse.json(
            {
                message:
                    "Não foi possível excluir a seção. Verifique se ela possui vínculos com outros registros.",
            },
            { status: 500 }
        );
    }
}