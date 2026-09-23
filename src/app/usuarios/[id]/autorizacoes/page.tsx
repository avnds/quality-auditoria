"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Consultor = {
    id: string;
    nome: string;
    email: string;
};

type Cliente = {
    id: string;
    nome: string;
    autorizado: boolean;
};

type Loja = {
    id: string;
    nome: string;
    clienteId: string;
    clienteNome: string;
    autorizado: boolean;
};

export default function AutorizacoesConsultorPage() {
    const params = useParams();
    const router = useRouter();

    const id = String(params.id);

    const [consultor, setConsultor] = useState<Consultor | null>(null);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [lojas, setLojas] = useState<Loja[]>([]);

    const [clientesSelecionados, setClientesSelecionados] = useState<
        string[]
    >([]);

    const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);

    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");

    useEffect(() => {
        async function carregar() {
            try {
                setCarregando(true);
                setErro("");

                const response = await fetch(
                    `/api/usuarios/${id}/autorizacoes`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Não foi possível carregar as autorizações."
                    );
                }

                setConsultor(data.consultor);
                setClientes(data.clientes);
                setLojas(data.lojas);

                setClientesSelecionados(
                    data.clientes
                        .filter((cliente: Cliente) => cliente.autorizado)
                        .map((cliente: Cliente) => cliente.id)
                );

                setLojasSelecionadas(
                    data.lojas
                        .filter((loja: Loja) => loja.autorizado)
                        .map((loja: Loja) => loja.id)
                );
            } catch (error) {
                setErro(
                    error instanceof Error
                        ? error.message
                        : "Erro ao carregar autorizações."
                );
            } finally {
                setCarregando(false);
            }
        }

        carregar();
    }, [id]);

    function alternarCliente(clienteId: string) {
        const clienteJaSelecionado =
            clientesSelecionados.includes(clienteId);

        if (clienteJaSelecionado) {
            setClientesSelecionados((atual) =>
                atual.filter((id) => id !== clienteId)
            );

            setLojasSelecionadas((atual) =>
                atual.filter((lojaId) => {
                    const loja = lojas.find(
                        (item) => item.id === lojaId
                    );

                    return loja?.clienteId !== clienteId;
                })
            );

            return;
        }

        setClientesSelecionados((atual) => [
            ...atual,
            clienteId,
        ]);
    }

    function alternarLoja(lojaId: string) {
        const loja = lojas.find((item) => item.id === lojaId);

        if (!loja) {
            return;
        }

        const lojaJaSelecionada = lojasSelecionadas.includes(lojaId);

        if (lojaJaSelecionada) {
            setLojasSelecionadas((atual) =>
                atual.filter((id) => id !== lojaId)
            );

            return;
        }

        setLojasSelecionadas((atual) => [...atual, lojaId]);

        setClientesSelecionados((atual) =>
            atual.includes(loja.clienteId)
                ? atual
                : [...atual, loja.clienteId]
        );
    }

    async function salvar() {
        try {
            setSalvando(true);
            setErro("");
            setSucesso("");

            const response = await fetch(
                `/api/usuarios/${id}/autorizacoes`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        clienteIds: clientesSelecionados,
                        lojaIds: lojasSelecionadas,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Não foi possível salvar as autorizações."
                );
            }

            setSucesso(
                data.message || "Autorizações atualizadas com sucesso."
            );

            router.push("/usuarios");
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao salvar autorizações."
            );
        } finally {
            setSalvando(false);
        }
    }

    if (carregando) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-8">
                <div className="mx-auto max-w-5xl">
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                        <p className="text-sm text-gray-600">
                            Carregando autorizações...
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-8">
            <div className="mx-auto max-w-5xl space-y-6">
                <div>
                    <button
                        type="button"
                        onClick={() => router.push("/usuarios")}
                        className="mb-4 text-sm font-semibold text-[#12223f] hover:underline"
                    >
                        ← Voltar para Usuários
                    </button>

                    <h1 className="text-2xl font-bold text-[#12223f]">
                        Autorizações do Consultor
                    </h1>

                    <p className="mt-1 text-sm text-gray-600">
                        Defina quais clientes e lojas este consultor poderá
                        acessar.
                    </p>
                </div>

                {erro && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {erro}
                    </div>
                )}

                {sucesso && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                        {sucesso}
                    </div>
                )}

                {consultor && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-[#12223f]">
                            {consultor.nome}
                        </h2>

                        <p className="mt-1 text-sm text-gray-600">
                            {consultor.email}
                        </p>
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-200 px-6 py-5">
                            <h2 className="text-lg font-semibold text-[#12223f]">
                                Clientes autorizados
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Selecione os clientes que o consultor poderá
                                acessar.
                            </p>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {clientes.length === 0 ? (
                                <div className="px-6 py-8 text-sm text-gray-500">
                                    Nenhum cliente ativo cadastrado.
                                </div>
                            ) : (
                                clientes.map((cliente) => (
                                    <label
                                        key={cliente.id}
                                        className="flex cursor-pointer items-center gap-3 px-6 py-4 hover:bg-gray-50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={clientesSelecionados.includes(
                                                cliente.id
                                            )}
                                            onChange={() =>
                                                alternarCliente(cliente.id)
                                            }
                                            className="h-4 w-4 rounded border-gray-300 accent-[#12223f]"
                                        />

                                        <span className="text-sm font-medium text-gray-800">
                                            {cliente.nome}
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-200 px-6 py-5">
                            <h2 className="text-lg font-semibold text-[#12223f]">
                                Lojas autorizadas
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Autorizar uma loja também autoriza automaticamente o cliente
                                correspondente. Autorizar um cliente não autoriza suas lojas.
                            </p>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {lojas.length === 0 ? (
                                <div className="px-6 py-8 text-sm text-gray-500">
                                    Nenhuma loja ativa cadastrada.
                                </div>
                            ) : (
                                lojas.map((loja) => (
                                    <label
                                        key={loja.id}
                                        className="flex cursor-pointer items-start gap-3 px-6 py-4 hover:bg-gray-50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={lojasSelecionadas.includes(
                                                loja.id
                                            )}
                                            onChange={() =>
                                                alternarLoja(loja.id)
                                            }
                                            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#12223f]"
                                        />

                                        <div>
                                            <p className="text-sm font-medium text-gray-800">
                                                {loja.nome}
                                            </p>

                                            <p className="mt-0.5 text-xs text-gray-500">
                                                {loja.clienteNome}
                                            </p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => router.push("/usuarios")}
                        disabled={salvando}
                        className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={salvar}
                        disabled={salvando}
                        className="rounded-xl bg-[#c22a2e] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {salvando
                            ? "Salvando..."
                            : "Salvar autorizações"}
                    </button>
                </div>
            </div>
        </main>
    );
}