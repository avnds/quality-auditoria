"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleLogout() {
        setLoading(true);

        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Falha ao realizar logout.");
            }

            router.push("/login");
            router.refresh();
        } catch (error) {
            console.error("Erro ao sair:", error);
            setLoading(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className="rounded-lg bg-[#c22a2e] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {loading ? "Saindo..." : "Sair"}
        </button>
    );
}