"use client";

import { useState } from "react";

type NovoUsuarioFormProps = {
    perfilAtual: string;
    onClose: () => void;
    onCreated: () => void;
};

export default function NovoUsuarioForm({
    perfilAtual,
    onClose,
    onCreated,
}: NovoUsuarioFormProps) {
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [perfil, setPerfil] = useState("CONSULTOR");

    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    const podeCriarSupervisora = perfilAtual === "MASTER";

    async function handleSubmit() {
        setErro("");

        if (!nome.trim() || !email.trim() || !senha) {
            setErro("Nome, e-mail e senha são obrigatórios.");
            return;
        }

        setSalvando(true);

        try {
            const response = await fetch("/api/usuarios", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nome,
                    email,
                    senha,
                    perfil,
                }),
            });

            const dados = await response.json();

            if (!response.ok) {
                setErro(
                    dados.message ??
                        "Não foi possível criar o usuário."
                );
                return;
            }

            onCreated();
        } catch (error) {
            console.error("Erro ao criar usuário:", error);
            setErro("Não foi possível criar o usuário.");
        } finally {
            setSalvando(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-xl font-semibold text-[#12223f]">
                            Novo usuário
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            Cadastre um novo usuário no sistema.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-4 text-2xl leading-none text-gray-400 transition hover:text-gray-700"
                        aria-label="Fechar"
                    >
                        ×
                    </button>
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                    <div>
                        <label
                            htmlFor="novo-usuario-nome"
                            className="mb-2 block text-sm font-semibold text-gray-700"
                        >
                            Nome
                        </label>

                        <input
                            id="novo-usuario-nome"
                            type="text"
                            value={nome}
                            onChange={(event) =>
                                setNome(event.target.value)
                            }
                            placeholder="Nome completo"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="novo-usuario-email"
                            className="mb-2 block text-sm font-semibold text-gray-700"
                        >
                            E-mail
                        </label>

                        <input
                            id="novo-usuario-email"
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            placeholder="usuario@exemplo.com"
                            className="w-full min-w-0 rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="novo-usuario-senha"
                            className="mb-2 block text-sm font-semibold text-gray-700"
                        >
                            Senha
                        </label>

                        <input
                            id="novo-usuario-senha"
                            type="password"
                            value={senha}
                            onChange={(event) =>
                                setSenha(event.target.value)
                            }
                            placeholder="Digite a senha"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="novo-usuario-perfil"
                            className="mb-2 block text-sm font-semibold text-gray-700"
                        >
                            Perfil
                        </label>

                        <select
                            id="novo-usuario-perfil"
                            value={perfil}
                            onChange={(event) =>
                                setPerfil(event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                        >
                            <option value="CONSULTOR">
                                Consultor
                            </option>

                            {podeCriarSupervisora && (
                                <option value="SUPERVISORA">
                                    Supervisora
                                </option>
                            )}
                        </select>
                    </div>

                    {erro && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
                            {salvando
                                ? "Salvando..."
                                : "Criar usuário"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}