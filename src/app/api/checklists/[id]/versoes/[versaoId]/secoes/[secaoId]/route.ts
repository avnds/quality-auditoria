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
export async function PUT(request: NextRequest,{params}:RouteContext){try{
 const {id,versaoId,secaoId}=await params;
 const p=await requirePermission("checklists.editar");
 if(!p.autorizado||!["MASTER","SUPERVISORA"].includes(p.usuario.perfil))return NextResponse.json({message:"Sem permissão."},{status:403});
 const atual=await db.execute({sql:`SELECT cs.id,cv.publicada,c.ativo FROM checklist_secoes cs JOIN checklist_versoes cv ON cv.id=cs.checklist_versao_id JOIN checklists c ON c.id=cv.checklist_id WHERE cs.id=? AND cv.id=? AND c.id=? LIMIT 1`,args:[secaoId,versaoId,id]});
 if(!atual.rows.length)return NextResponse.json({message:"Seção não encontrada."},{status:404});
 if(Number(atual.rows[0].publicada)===1)return NextResponse.json({message:"Não é permitido editar seções de versões publicadas. Crie uma nova versão."},{status:409});
 if(Number(atual.rows[0].ativo)!==1)return NextResponse.json({message:"Checklist inativo."},{status:409});
 const body=await request.json();const nome=typeof body.nome==="string"?body.nome.trim():"";const descricao=typeof body.descricao==="string"?body.descricao.trim():"";
 if(!nome||nome.length>200||descricao.length>500)return NextResponse.json({message:"Nome obrigatório (até 200 caracteres) e descrição até 500 caracteres."},{status:400});
 const r=await db.execute({sql:"UPDATE checklist_secoes SET nome=?,descricao=? WHERE id=? AND checklist_versao_id=?",args:[nome,descricao||null,secaoId,versaoId]});
 if(r.rowsAffected!==1)return NextResponse.json({message:"Seção não encontrada."},{status:404});
 return NextResponse.json({success:true,message:"Seção atualizada."});
 }catch(e){console.error("Erro ao editar seção",e);return NextResponse.json({message:"Não foi possível editar a seção."},{status:500});}}
