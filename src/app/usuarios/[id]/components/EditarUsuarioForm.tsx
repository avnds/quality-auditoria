"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Usuario = {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    ativo: number;
};





type EditarUsuarioFormProps = {
    usuario: Usuario;
};

export default function EditarUsuarioForm({
    usuario,
}: EditarUsuarioFormProps) {

    const router = useRouter();
    const [nome, setNome] = useState(usuario.nome);
    const [email, setEmail] = useState(usuario.email);
    const [perfil, setPerfil] = useState(usuario.perfil);
    const [ativo, setAtivo] = useState(String(usuario.ativo));

    const [salvando, setSalvando] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [erro, setErro] = useState("");

    async function handleSubmit() {
        setSalvando(true);
        setMensagem("");
        setErro("");

        try {
            const response = await fetch(`/api/usuarios/${usuario.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nome,
                    email,
                    perfil,
                    ativo: Number(ativo),
                }),
            });

            const dados = await response.json();

            if (!response.ok) {
                setErro(dados.message ?? "Não foi possível salvar as alterações.");
                return;
            }

            setMensagem("Alterações salvas com sucesso.");

            router.refresh();
        } catch (error) {
            console.error("Erro ao salvar usuário:", error);
            setErro("Não foi possível salvar as alterações.");
        } finally {
            setSalvando(false);
        }
    }
    return (
        <div className="space-y-6">
            <div>
                <label
                    htmlFor="nome"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                >
                    Nome
                </label>

                <input
                    id="nome"
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                    placeholder="Nome do usuário"
                />
            </div>

            <div>
                <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                >
                    E-mail
                </label>

                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                    placeholder="E-mail do usuário"
                />
            </div>

            <div>
                <label
                    htmlFor="perfil"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                >
                    Perfil
                </label>

                <select
                    id="perfil"
                    value={perfil}
                    onChange={(event) => setPerfil(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                >
                    <option value="CONSULTOR">
                        Consultor
                    </option>

                    <option value="SUPERVISORA">
                        Supervisora
                    </option>
                </select>
            </div>

            <div>
                <label
                    htmlFor="status"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                >
                    Status
                </label>

                <select
                    id="status"
                    value={ativo}
                    onChange={(event) => setAtivo(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-1 focus:ring-[#12223f]"
                >
                    <option value="1">
                        Ativo
                    </option>

                    <option value="0">
                        Inativo
                    </option>
                </select>
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

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-6">
                <button
                    type="button"
                    className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                    Cancelar
                </button>

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={salvando}
                    className="rounded-lg bg-[#12223f] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {salvando ? "Salvando..." : "Salvar alterações"}
                </button>
            </div>
        </div>
    );
}