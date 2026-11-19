"use client";
import { useState } from "react";
type Documento = { id: string; nome: string; ativo: number };
export default function CriarDocumentoCatalogo({ aoCriar }: { aoCriar: (documento: Documento) => void }) {
 const [aberto, setAberto] = useState(false);
 const [nome, setNome] = useState("");
 const [descricao, setDescricao] = useState("");
 const [tipo, setTipo] = useState<"VALIDADE" | "REVISAO">("VALIDADE");
 const [modalidade, setModalidade] = useState<"LOJA" | "COLABORADOR">("LOJA");
 const [meses, setMeses] = useState("");
 const [alerta, setAlerta] = useState("30");
 const [salvando, setSalvando] = useState(false);
 const [erro, setErro] = useState("");
 async function salvar() {
  if (!nome.trim() || nome.trim().length > 200 || (meses.trim() && (!Number.isInteger(Number(meses)) || Number(meses) < 1 || Number(meses) > 1200)) || !Number.isInteger(Number(alerta)) || Number(alerta) < 0 || Number(alerta) > 3650) { setErro("Confira nome, periodicidade e alerta."); return; }
  setSalvando(true); setErro("");
  try {
   const resposta = await fetch("/api/documentos/catalogo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: nome.trim(), descricao: descricao.trim() || null, tipo_controle: tipo, modalidade, periodicidade_meses: meses.trim() ? Number(meses) : null, alerta_dias: Number(alerta) }) });
   const json = await resposta.json();
   if (!resposta.ok || !json.success) throw new Error(json.message ?? "Não foi possível criar documento.");
   aoCriar(json.documento);
   setAberto(false); setNome(""); setDescricao(""); setMeses(""); setAlerta("30");
  } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao criar documento."); }
  finally { setSalvando(false); }
 }
 const campo = "mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900";
 return <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-slate-800">
  <button type="button" onClick={() => setAberto(!aberto)} className="rounded-lg border border-[#22365b] px-4 py-2 text-sm font-semibold text-[#22365b]">+ Criar novo documento no catálogo</button>
  {aberto && <div className="mt-4 grid gap-3 sm:grid-cols-2">
   <label className="text-sm font-medium">Nome *<input className={campo} maxLength={200} value={nome} onChange={e => setNome(e.target.value)} /></label>
   <label className="text-sm font-medium">Tipo de controle<select className={campo} value={tipo} onChange={e => setTipo(e.target.value as "VALIDADE" | "REVISAO")}><option value="VALIDADE">Validade</option><option value="REVISAO">Revisão</option></select></label>
   <label className="text-sm font-medium">Modalidade<select className={campo} value={modalidade} onChange={e => setModalidade(e.target.value as "LOJA" | "COLABORADOR")}><option value="LOJA">Por loja</option><option value="COLABORADOR">Por colaborador</option></select></label>
   <label className="text-sm font-medium">Periodicidade em meses (opcional)<input className={campo} type="number" min={1} max={1200} value={meses} onChange={e => setMeses(e.target.value)} /></label>
   <label className="text-sm font-medium">Alerta em dias *<input className={campo} type="number" min={0} max={3650} value={alerta} onChange={e => setAlerta(e.target.value)} /></label>
   <label className="text-sm font-medium sm:col-span-2">Descrição<textarea className={campo} maxLength={2000} rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} /></label>
   {erro && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{erro}</p>}
   <div className="sm:col-span-2"><button type="button" disabled={salvando || !nome.trim()} onClick={() => void salvar()} className="rounded-lg bg-[#22365b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando ? "Salvando..." : "Criar documento"}</button></div>
  </div>}
 </div>;
}
