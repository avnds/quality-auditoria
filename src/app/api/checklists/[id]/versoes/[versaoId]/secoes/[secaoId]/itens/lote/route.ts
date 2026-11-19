import {NextResponse} from "next/server";
import db from "@/lib/db";
import {requirePermission} from "@/lib/auth/require-permission";
type Context={params:Promise<{id:string;versaoId:string;secaoId:string}>};
export async function POST(request:Request,{params}:Context){
 const permissao=await requirePermission("checklists.editar");
 if(!permissao.autorizado||!["MASTER","SUPERVISORA"].includes(permissao.usuario.perfil))return NextResponse.json({message:"Sem permissão."},{status:403});
 const {id,versaoId,secaoId}=await params;
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({message:"Dados inválidos."},{status:400});}
 const ids=(body as {catalogoItemIds?:unknown})?.catalogoItemIds;
 if(!Array.isArray(ids)||ids.length<1||ids.length>100||ids.some(x=>typeof x!=="string"||!x.trim())||new Set(ids).size!==ids.length)return NextResponse.json({message:"Selecione de 1 a 100 itens distintos."},{status:400});
 let tx:Awaited<ReturnType<typeof db.transaction>>|null=null;
 try{
 tx=await db.transaction("write");
 const secao=await tx.execute({sql:`SELECT cv.publicada,c.ativo FROM checklist_secoes cs JOIN checklist_versoes cv ON cv.id=cs.checklist_versao_id JOIN checklists c ON c.id=cv.checklist_id WHERE cs.id=? AND cv.id=? AND c.id=? LIMIT 1`,args:[secaoId,versaoId,id]});
 if(!secao.rows.length){await tx.rollback();tx=null;return NextResponse.json({message:"Seção não encontrada."},{status:404});}
 if(Number(secao.rows[0].publicada)===1||Number(secao.rows[0].ativo)!==1){await tx.rollback();tx=null;return NextResponse.json({message:"A seção pertence a uma versão publicada ou checklist inativo."},{status:409});}
 const marcadores=ids.map(()=>"?").join(",");
 const catalogo=await tx.execute({sql:`SELECT id,texto FROM catalogo_itens WHERE id IN (${marcadores})`,args:ids});
 if(catalogo.rows.length!==ids.length){await tx.rollback();tx=null;return NextResponse.json({message:"Um ou mais itens não existem no catálogo."},{status:404});}
 const duplicados=await tx.execute({sql:`SELECT catalogo_item_id FROM checklist_itens WHERE checklist_secao_id=? AND catalogo_item_id IN (${marcadores}) LIMIT 1`,args:[secaoId,...ids]});
 if(duplicados.rows.length){await tx.rollback();tx=null;return NextResponse.json({message:"Um dos itens selecionados já está nesta seção. Atualize a página."},{status:409});}
 const ordemResult=await tx.execute({sql:"SELECT COALESCE(MAX(ordem),0) AS ultima FROM checklist_itens WHERE checklist_secao_id=?",args:[secaoId]});
 let ordem=Number(ordemResult.rows[0]?.ultima??0);
 const porId=new Map(catalogo.rows.map(r=>[String(r.id),String(r.texto)]));
 for(const itemId of ids){ordem++;await tx.execute({sql:"INSERT INTO checklist_itens (id,checklist_secao_id,texto,orientacao,ordem,ativo,catalogo_item_id,item_vencimento) VALUES (?,?,?,NULL,?,1,?,NULL)",args:[crypto.randomUUID(),secaoId,porId.get(itemId)!,ordem,itemId]});}
 await tx.commit();tx=null;return NextResponse.json({success:true,quantidade:ids.length},{status:201});
 }catch(e){if(tx)try{await tx.rollback();}catch{}console.error("Erro ao adicionar itens em lote",e);return NextResponse.json({message:"Não foi possível adicionar os itens."},{status:500});}
}