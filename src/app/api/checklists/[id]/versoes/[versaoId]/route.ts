import {NextResponse} from "next/server";
import db from "@/lib/db";
import {requirePermission} from "@/lib/auth/require-permission";
type Context={params:Promise<{id:string;versaoId:string}>};
export async function PUT(request:Request,{params}:Context){
 const p=await requirePermission("checklists.editar");
 if(!p.autorizado||!["MASTER","SUPERVISORA"].includes(p.usuario.perfil))return NextResponse.json({message:"Sem permissão para editar versões."},{status:403});
 const {id,versaoId}=await params;
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({message:"Dados inválidos."},{status:400});}
 const descricao=(body as {descricao?:unknown})?.descricao;
 if(typeof descricao!=="string"||descricao.trim().length>500)return NextResponse.json({message:"Descrição inválida (máximo 500 caracteres)."},{status:400});
 try{
 const versao=await db.execute({sql:"SELECT cv.publicada,c.ativo FROM checklist_versoes cv JOIN checklists c ON c.id=cv.checklist_id WHERE cv.id=? AND cv.checklist_id=? LIMIT 1",args:[versaoId,id]});
 if(!versao.rows.length)return NextResponse.json({message:"Versão não encontrada."},{status:404});
 if(Number(versao.rows[0].publicada)===1)return NextResponse.json({message:"Versões publicadas não podem ser editadas. Crie uma nova versão."},{status:409});
 if(Number(versao.rows[0].ativo)!==1)return NextResponse.json({message:"Checklist inativo."},{status:409});
 const r=await db.execute({sql:"UPDATE checklist_versoes SET descricao=? WHERE id=? AND checklist_id=? AND publicada=0",args:[descricao.trim()||null,versaoId,id]});
 if(r.rowsAffected!==1)return NextResponse.json({message:"A versão foi alterada. Atualize a página."},{status:409});
 return NextResponse.json({success:true,message:"Versão atualizada."});
 }catch(e){console.error("Erro ao editar versão",e);return NextResponse.json({message:"Não foi possível editar a versão."},{status:500});}
}