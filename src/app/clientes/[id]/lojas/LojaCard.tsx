"use client";

import EditarLojaButton from "./EditarLojaButton";
import AlterarStatusLojaButton from "./AlterarStatusLojaButton";
import TelefonesLoja from "./TelefonesLoja";

type LojaCardProps = {
    loja: {
        id: string;
        nome: string;
        cnpj: string | null;
        endereco: string;
        numero: string | null;
        complemento: string | null;
        bairro: string | null;
        cidade: string;
        estado: string;
        cep: string | null;
        ativo: number;
    };
    podeGerenciar: boolean;
};

export default function LojaCard({
    loja,
    podeGerenciar,
}: LojaCardProps) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex flex-col gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                        {loja.nome}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                        {loja.cidade}/{loja.estado}
                    </p>
                </div>

                <div className="text-sm text-slate-600">
                    <p>
                        <strong>Endereço:</strong>{" "}
                        {loja.endereco}
                        {loja.numero ? `, ${loja.numero}` : ""}
                    </p>

                    {loja.complemento && (
                        <p>
                            <strong>Complemento:</strong>{" "}
                            {loja.complemento}
                        </p>
                    )}

                    {loja.bairro && (
                        <p>
                            <strong>Bairro:</strong> {loja.bairro}
                        </p>
                    )}

                    {loja.cep && (
                        <p>
                            <strong>CEP:</strong> {loja.cep}
                        </p>
                    )}

                    {loja.cnpj && (
                        <p>
                            <strong>CNPJ:</strong> {loja.cnpj}
                        </p>
                    )}
                </div>

                <div>
                    <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            loja.ativo
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                    >
                        {loja.ativo ? "Ativa" : "Inativa"}
                    </span>
                </div>

                {podeGerenciar && (
                    <div className="flex flex-wrap gap-2">
                        <EditarLojaButton lojaId={loja.id} />

                        <AlterarStatusLojaButton
                            lojaId={loja.id}
                            ativo={Boolean(loja.ativo)}
                        />
                    </div>
                )}

                <TelefonesLoja
                    lojaId={loja.id}
                    podeGerenciar={podeGerenciar}
                />
            </div>
        </div>
    );
}