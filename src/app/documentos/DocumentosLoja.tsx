"use client";

import { useEffect, useState } from "react";

type Documento = {
    id: string; nome: string; modalidade: "LOJA" | "COLABORADOR";
    tipo_controle: "VALIDADE" | "REVISAO"; ativo: number;
};
type Status = {
    documento_loja_id: string; instancia_id: string | null;
    colaborador_nome: string | null; status: string; dias_restantes: number | null;
    data_prazo: string | null; verificacao_id: string | null;
};
type Resumo = { total: number; verificados: number; exigem_atencao: number };
const rotulos: Record<string, string> = {
    NAO_VERIFICADO: "Não verificado", NAO_APRESENTADO: "Não apresentado",
    PRAZO_NAO_INFORMADO: "Prazo não informado", EM_DIA: "Em dia",
    PROXIMO_VENCIMENTO: "Próximo do vencimento", VENCE_HOJE: "Vence hoje",
    VENCIDO: "Vencido", PROXIMA_REVISAO: "Próximo da revisão",
    REVISAO_HOJE: "Revisão hoje", REVISAO_ATRASADA: "Revisão atrasada",
};
function StatusEtiqueta({ status }: { status: string }) {
    const cor = status === "EM_DIA"
        ? "bg-emerald-50 text-emerald-800"
        : status === "NAO_VERIFICADO" ? "bg-slate-100 text-slate-700"
        : "bg-amber-50 text-amber-900";
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cor}`}>
        {rotulos[status] ?? status}
    </span>;
}

export default function DocumentosLoja({ lojaId }: { lojaId: string }) {
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [status, setStatus] = useState<Status[]>([]);
    const [resumo, setResumo] = useState<Resumo | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        async function carregar() {
            setCarregando(true);
            setErro("");
            try {
                const [lista, situacao] = await Promise.all([
                    fetch(`/api/documentos/lojas/${encodeURIComponent(lojaId)}`, { signal: controller.signal }),
                    fetch(`/api/documentos/lojas/${encodeURIComponent(lojaId)}/status`, { signal: controller.signal }),
                ]);
                if (!lista.ok || !situacao.ok) throw new Error("Não foi possível consultar os documentos.");
                const dadosLista = await lista.json();
                const dadosStatus = await situacao.json();
                if (!dadosLista.success || !dadosStatus.success) throw new Error("Não foi possível carregar a documentação.");
                setDocumentos(dadosLista.documentos);
                setStatus(dadosStatus.documentos);
                setResumo(dadosStatus.resumo);
            } catch (error) {
                if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : "Erro ao carregar.");
            } finally {
                if (!controller.signal.aborted) setCarregando(false);
            }
        }
        void carregar();
        return () => controller.abort();
    }, [lojaId]);

    if (carregando) return <div className="rounded-xl bg-white p-8 text-slate-600">Carregando documentos...</div>;
    if (erro) return <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-red-700">{erro}</div>;

    return (
        <div className="space-y-6">
            {resumo && <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Documentos e ASOs</p><p className="mt-1 text-2xl font-bold text-[#22365b]">{resumo.total}</p></div>
                <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Verificados</p><p className="mt-1 text-2xl font-bold text-[#22365b]">{resumo.verificados}</p></div>
                <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Exigem atenção</p><p className="mt-1 text-2xl font-bold text-[#c22a2e]">{resumo.exigem_atencao}</p></div>
            </div>}
            {documentos.length === 0 ? (
                <div className="rounded-xl border bg-white p-8 text-slate-600">Nenhum documento vinculado a esta loja.</div>
            ) : (
                <div className="space-y-3">
                    {documentos.map((doc) => {
                        const registros = status.filter((item) => item.documento_loja_id === doc.id);
                        const loja = registros.find((item) => item.instancia_id === null);
                        return <section key={doc.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="font-semibold text-[#12223f]">{doc.nome}</h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {doc.modalidade === "COLABORADOR" ? "Individual por colaborador" : doc.tipo_controle === "REVISAO" ? "Controle por revisão" : "Controle por validade"}
                                        {Number(doc.ativo) !== 1 ? " • Vínculo inativo" : ""}
                                    </p>
                                </div>
                                {doc.modalidade === "LOJA" && Number(doc.ativo) === 1 && loja
                                    ? <StatusEtiqueta status={loja.status} />
                                    : null}
                            </div>
                            {doc.modalidade === "LOJA" && loja?.data_prazo && (
                                <p className="mt-3 text-sm text-slate-600">Prazo: {loja.data_prazo.split("-").reverse().join("/")}</p>
                            )}
                            {doc.modalidade === "COLABORADOR" && (
                                <div className="mt-4 space-y-2 border-t pt-3">
                                    {registros.length === 0
                                        ? <p className="text-sm text-slate-500">Nenhum ASO individual ativo cadastrado.</p>
                                        : registros.map((item) => (
                                            <div key={item.instancia_id ?? "loja"} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                                <span className="text-slate-700">{item.colaborador_nome ?? "Colaborador"}</span>
                                                <StatusEtiqueta status={item.status} />
                                            </div>
                                        ))}
                                </div>
                            )}
                        </section>;
                    })}
                </div>
            )}
        </div>
    );
}
