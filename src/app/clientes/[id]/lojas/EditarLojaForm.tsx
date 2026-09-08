"use client";

import { useEffect, useState } from "react";

type Loja = {
    id: string;
    cliente_id: string;
    nome: string;
    cnpj: string | null;
    endereco: string;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string;
    estado: string;
    cep: string | null;
};

type EditarLojaFormProps = {
    lojaId: string;
    onClose: () => void;
    onUpdated: () => void;
};

export default function EditarLojaForm({
    lojaId,
    onClose,
    onUpdated,
}: EditarLojaFormProps) {
    const [loja, setLoja] = useState<Loja | null>(null);

    const [nome, setNome] = useState("");
    const [cnpj, setCnpj] = useState("");
    const [endereco, setEndereco] = useState("");
    const [numero, setNumero] = useState("");
    const [complemento, setComplemento] = useState("");
    const [bairro, setBairro] = useState("");
    const [cidade, setCidade] = useState("");
    const [estado, setEstado] = useState("");
    const [cep, setCep] = useState("");

    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    useEffect(() => {
        async function carregarLoja() {
            try {
                const response = await fetch(`/api/lojas/${lojaId}`);
                const dados = await response.json();

                if (!response.ok) {
                    setErro(
                        dados.message ??
                            "Não foi possível carregar os dados da loja."
                    );
                    return;
                }

                const dadosLoja = dados.loja as Loja;

                setLoja(dadosLoja);
                setNome(dadosLoja.nome ?? "");
                setCnpj(dadosLoja.cnpj ?? "");
                setEndereco(dadosLoja.endereco ?? "");
                setNumero(dadosLoja.numero ?? "");
                setComplemento(dadosLoja.complemento ?? "");
                setBairro(dadosLoja.bairro ?? "");
                setCidade(dadosLoja.cidade ?? "");
                setEstado(dadosLoja.estado ?? "");
                setCep(dadosLoja.cep ?? "");
            } catch (error) {
                console.error("Erro ao carregar loja:", error);
                setErro(
                    "Não foi possível carregar os dados da loja."
                );
            } finally {
                setCarregando(false);
            }
        }

        carregarLoja();
    }, [lojaId]);

    async function handleSubmit() {
        setErro("");

        if (
            !nome.trim() ||
            !endereco.trim() ||
            !cidade.trim() ||
            !estado.trim()
        ) {
            setErro(
                "Nome, endereço, cidade e estado são obrigatórios."
            );
            return;
        }

        if (estado.trim().length !== 2) {
            setErro("Informe o estado usando a sigla com 2 letras.");
            return;
        }

        setSalvando(true);

        try {
            const response = await fetch(`/api/lojas/${lojaId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nome,
                    cnpj,
                    endereco,
                    numero,
                    complemento,
                    bairro,
                    cidade,
                    estado,
                    cep,
                }),
            });

            const dados = await response.json();

            if (!response.ok) {
                setErro(
                    dados.message ??
                        "Não foi possível atualizar a loja."
                );
                return;
            }

            onUpdated();
        } catch (error) {
            console.error("Erro ao atualizar loja:", error);
            setErro("Não foi possível atualizar a loja.");
        } finally {
            setSalvando(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-xl font-semibold text-[#12223f]">
                            Editar loja
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            Altere os dados do estabelecimento.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={salvando}
                        className="ml-4 text-2xl leading-none text-gray-400 transition hover:text-gray-700 disabled:opacity-50"
                        aria-label="Fechar"
                    >
                        ×
                    </button>
                </div>

                {carregando ? (
                    <div className="p-6 text-sm text-gray-500">
                        Carregando dados da loja...
                    </div>
                ) : (
                    <div className="space-y-5 p-5 sm:p-6">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                Nome da loja *
                            </label>
                            <input
                                type="text"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                disabled={salvando}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                CNPJ
                            </label>
                            <input
                                type="text"
                                value={cnpj}
                                onChange={(e) => setCnpj(e.target.value)}
                                disabled={salvando}
                                placeholder="00.000.000/0000-00"
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                Endereço *
                            </label>
                            <input
                                type="text"
                                value={endereco}
                                onChange={(e) => setEndereco(e.target.value)}
                                disabled={salvando}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-gray-700">
                                    Número
                                </label>
                                <input
                                    type="text"
                                    value={numero}
                                    onChange={(e) => setNumero(e.target.value)}
                                    disabled={salvando}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold text-gray-700">
                                    Complemento
                                </label>
                                <input
                                    type="text"
                                    value={complemento}
                                    onChange={(e) =>
                                        setComplemento(e.target.value)
                                    }
                                    disabled={salvando}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                Bairro
                            </label>
                            <input
                                type="text"
                                value={bairro}
                                onChange={(e) => setBairro(e.target.value)}
                                disabled={salvando}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-sm font-semibold text-gray-700">
                                    Cidade *
                                </label>
                                <input
                                    type="text"
                                    value={cidade}
                                    onChange={(e) => setCidade(e.target.value)}
                                    disabled={salvando}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold text-gray-700">
                                    Estado *
                                </label>
                                <input
                                    type="text"
                                    maxLength={2}
                                    value={estado}
                                    onChange={(e) =>
                                        setEstado(e.target.value.toUpperCase())
                                    }
                                    disabled={salvando}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3 uppercase outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                CEP
                            </label>
                            <input
                                type="text"
                                value={cep}
                                onChange={(e) => setCep(e.target.value)}
                                disabled={salvando}
                                placeholder="00000-000"
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                            />
                        </div>

                        {erro && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {erro}
                            </div>
                        )}

                        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={salvando}
                                className="w-full rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:w-auto"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={salvando}
                                className="w-full rounded-lg bg-[#12223f] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                                {salvando ? "Salvando..." : "Salvar alterações"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}