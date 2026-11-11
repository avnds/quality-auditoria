"use client";

import { useEffect, useState } from "react";

type Vinculo = { id: string; nome: string; ativo: number; periodicidade_meses: number | null; alerta_dias: number | null; periodicidade_padrao: number | null; alerta_padrao: number };
type Catalogo = { id: string; nome: string; ativo: number };
type Props = { lojaId: string; documentos: Vinculo[]; aoAtualizar: () => void };
function numeroOpcional(valor: string) { return valor.trim() ? Number(valor) : null; }

export default function GerenciarDocumentos({ lojaId, documentos, aoAtualizar }: Props) {
    const [catalogo, setCatalogo] = useState<Catalogo[]>([]);
    const [novo, setNovo] = useState("");
    const [editando, setEditando] = useState<string | null>(null);
    const [periodicidade, setPeriodicidade] = useState("");
    const [alerta, setAlerta] = useState("");
    const [ocupado, setOcupado] = useState(false);
    const [erro, setErro] = useState("");
    const [mensagem, setMensagem] = useState("");
    const base = `/api/documentos/lojas/${encodeURIComponent(lojaId)}`;

    useEffect(() => {
        let ativo = true;
        void fetch("/api/documentos/catalogo").then(async (resposta) => {
            const json = await resposta.json();
            if (!resposta.ok || !json.success) throw new Error(json.message ?? "Erro ao consultar catálogo.");
            if (ativo) setCatalogo(json.documentos);
        }).catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : "Erro ao carregar catálogo."); });
        return () => { ativo = false; };
    }, []);

    async function enviar(url: string, method: "POST" | "PATCH", body: object) {
        setOcupado(true); setErro(""); setMensagem("");
        try {
            const resposta = await fetch(url, {
                method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const json = await resposta.json();
            if (!resposta.ok || !json.success) throw new Error(json.message ?? "Não foi possível salvar.");
            setMensagem(json.message ?? "Alteração salva.");
            setEditando(null);
            aoAtualizar();
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao salvar.");
        } finally { setOcupado(false); }
    }

    function editar(doc: Vinculo) {
        setEditando(doc.id);
        setPeriodicidade(doc.periodicidade_meses === null ? "" : String(doc.periodicidade_meses));
        setAlerta(doc.alerta_dias === null ? "" : String(doc.alerta_dias));
    }

    const disponiveis = catalogo.filter((item) => Number(item.ativo) === 1 &&
        !documentos.some((doc) => doc.nome === item.nome));

    return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#22365b]">Gerenciar documentos da loja</h2>
        <p className="mt-1 text-sm text-slate-500">Vincule documentos e ajuste os prazos de acompanhamento. O histórico é preservado.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-56 flex-1 text-sm font-medium text-slate-700">Adicionar do catálogo
                <select value={novo} onChange={(e) => setNovo(e.target.value)} className="mt-1 w-full rounded-lg border p-2">
                    <option value="">Selecione um documento</option>
                    {disponiveis.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
            </label>
            <button type="button" disabled={!novo || ocupado} onClick={() => void enviar(base, "POST", { documento_id: novo })}
                className="rounded-lg bg-[#22365b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Vincular</button>
        </div>
        <div className="mt-5 space-y-2">
            {documentos.map((doc) => <div key={doc.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="font-semibold text-slate-800">{doc.nome}</p>
                        <p className="text-xs text-slate-500">{Number(doc.ativo) === 1 ? "Ativo" : "Inativo"} • Periodicidade: {doc.periodicidade_meses ?? doc.periodicidade_padrao ?? "não definida"} meses • Alerta: {doc.alerta_dias ?? doc.alerta_padrao} dias</p>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" disabled={ocupado} onClick={() => editando === doc.id ? setEditando(null) : editar(doc)}
                            className="rounded-lg border px-3 py-2 text-xs font-semibold">Configurar</button>
                        <button type="button" disabled={ocupado} onClick={() => {
                            if (Number(doc.ativo) === 1) {
                                const justificativa = window.prompt(`Justificativa para inativar ${doc.nome}:`);
                                if (!justificativa?.trim()) return;
                                void enviar(`${base}/${encodeURIComponent(doc.id)}`, "PATCH", { ativo: 0, justificativa: justificativa.trim() });
                            } else if (window.confirm(`Reativar ${doc.nome}? Será iniciado um novo ciclo de verificação.`)) {
                                void enviar(`${base}/${encodeURIComponent(doc.id)}`, "PATCH", { ativo: 1 });
                            }
                        }} className="rounded-lg border border-[#c22a2e] px-3 py-2 text-xs font-semibold text-[#c22a2e]">
                            {Number(doc.ativo) === 1 ? "Inativar" : "Reativar"}
                        </button>
                    </div>
                </div>
                {editando === doc.id && <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3">
                    <label className="text-xs text-slate-700">Periodicidade (meses)
                        <input type="number" min="1" max="1200" value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value)} placeholder="Padrão" className="mt-1 block w-40 rounded-lg border p-2" />
                    </label>
                    <label className="text-xs text-slate-700">Alerta (dias)
                        <input type="number" min="0" max="3650" value={alerta} onChange={(e) => setAlerta(e.target.value)} placeholder="Padrão" className="mt-1 block w-40 rounded-lg border p-2" />
                    </label>
                    <button type="button" disabled={ocupado} onClick={() => void enviar(`${base}/${encodeURIComponent(doc.id)}`, "PATCH", {
                        periodicidade_meses: numeroOpcional(periodicidade), alerta_dias: numeroOpcional(alerta),
                    })} className="rounded-lg bg-[#22365b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar</button>
                </div>}
            </div>)}
        </div>
        {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
        {mensagem && <p className="mt-3 text-sm text-emerald-700">{mensagem}</p>}
    </section>;
}
