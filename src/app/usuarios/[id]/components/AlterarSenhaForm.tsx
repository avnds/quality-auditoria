"use client";

import { useState } from "react";

type AlterarSenhaFormProps = {
    usuarioId: string;
};

export default function AlterarSenhaForm({
    usuarioId,
}: AlterarSenhaFormProps) {
    const [aberto, setAberto] = useState(false);
    const [senha, setSenha] = useState("");
    const [confirmacao, setConfirmacao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [erro, setErro] = useState("");

    async function handleSubmit() {
        setMensagem("");
        setErro("");

        if (!senha) {
            setErro("A nova senha é obrigatória.");
            return;
        }

        if (senha !== confirmacao) {
            setErro("As senhas não coincidem.");
            return;
        }

        setSalvando(true);

        try {
            const response = await fetch(
                `/api/usuarios/${usuarioId}/senha`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        senha,
                    }),
                }
            );

            const dados = await response.json();

            if (!response.ok) {
                setErro(
                    dados.message ??
                    "Não foi possível alterar a senha."
                );
                return;
            }

            setMensagem("Senha alterada com sucesso.");
            setSenha("");
            setConfirmacao("");
        } catch (error) {
            console.error("Erro ao alterar senha:", error);
            setErro("Não foi possível alterar a senha.");
        } finally {
            setSalvando(false);
        }
    }

    return (
        <div className="mt-4">
            {!aberto ? (
                <button
                    type="button"
                    onClick={() => setAberto(true)}
                    className="rounded-lg border border-[#c22a2e] px-5 py-3 font-semibold text-[#c22a2e] transition hover:bg-red-50"
                >
                    Alterar senha
                </button>
            ) : (
                <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <div>
                        <label
                            htmlFor="nova-senha"
                            className="mb-2 block text-sm font-semibold text-gray-700"
                        >
                            Nova senha
                        </label>

                        <input
                            id="nova-senha"
                            type="password"
                            value={senha}
                            onChange={(event) =>
                                setSenha(event.target.value)
                            }
                            placeholder="Digite a nova senha"
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="confirmar-senha"
                            className="mb-2 block text-sm font-semibold text-gray-700"
                        >
                            Confirmar nova senha
                        </label>

                        <input
                            id="confirmar-senha"
                            type="password"
                            value={confirmacao}
                            onChange={(event) =>
                                setConfirmacao(event.target.value)
                            }
                            placeholder="Digite novamente a nova senha"
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                        />
                    </div>
                    {mensagem && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                            {mensagem}
                        </div>
                    )}

                    {erro && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {erro}
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setAberto(false);
                                setSenha("");
                                setConfirmacao("");
                            }}
                            className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 transition hover:bg-white"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={salvando}
                            className="rounded-lg bg-[#c22a2e] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {salvando ? "Salvando..." : "Salvar nova senha"}
                        </button>
                    </div>
                </div>
            )}

            <input type="hidden" value={usuarioId} readOnly />
        </div>
    );
}