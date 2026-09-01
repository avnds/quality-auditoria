"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const router = useRouter();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setLoading(true);

        const formData = new FormData(event.currentTarget);

        const email = String(formData.get("email") ?? "");
        const password = String(formData.get("password") ?? "");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Não foi possível realizar o login.");
                return;
            }

            router.push("/");
        } catch {
            setError("Não foi possível conectar ao servidor.");
        } finally {
            setLoading(false);
        }
    }
    return (
        <main className="min-h-screen bg-white flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3">
                        <img
                            src="/icone1.png"
                            alt="Ícone Quality Auditoria"
                            className="h-15 w-15 object-contain"
                        />

                        <h1 className="text-4xl font-bold text-[#12223f] font-['Montserrat']">
                            Quality{" "}
                            <span className="text-[#12223f] font-['Pacifico']">
                                Auditoria
                            </span>
                        </h1>
                    </div>

                    <div className="mx-auto mt-3 h-1 w-30 rounded-full bg-[#c22a2e]" />

                    <p className="mt-4 text-gray-600">
                        Sistema de gestão de auditorias de qualidade
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                    <h2 className="text-2xl font-semibold text-[#12223f]">
                        Entrar
                    </h2>

                    <p className="mt-2 text-sm text-gray-500">
                        Acesse sua conta para continuar.
                    </p>

                    <form
                        onSubmit={handleSubmit}
                        className="mt-6 space-y-5"
                    >
                        {/* E-mail */}
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-medium text-gray-700"
                            >
                                E-mail
                            </label>

                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="seu@email.com"
                                autoComplete="email"
                                className="w-full rounded-lg border text-gray-900 border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10"
                            />
                        </div>

                        {/* Senha */}
                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-medium text-gray-700"
                            >
                                Senha
                            </label>

                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Digite sua senha"
                                    autoComplete="current-password"
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 text-gray-900 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10"
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword((previous) => !previous)
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-[#12223f]"
                                    aria-label={
                                        showPassword
                                            ? "Ocultar senha"
                                            : "Mostrar senha"
                                    }
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>
                        {error && (
                            <div
                                role="alert"
                                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                            >
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-lg bg-[#12223f] px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? "Entrando..." : "Entrar"}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}