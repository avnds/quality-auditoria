import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionByToken } from "@/lib/auth/session";
import LogoutButton from "@/app/components/LogoutButton";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("quality_session")?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await getSessionByToken(token);

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
        {/* Cabeçalho */}
        <header className="mb-12 text-center">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-[#12223f] font-['Montserrat']">
              Quality{" "}
              <span className="text-[#12223f] font-['Pacifico']">
                Auditoria
              </span>
            </h1>

            <div className="mx-auto mt-3 h-1 w-30 rounded-full bg-[#c22a2e]" />
          </div>

          <p className="text-gray-600">
            Sistema de gestão de auditorias de qualidade
          </p>
        </header>

        {/* Navegação */}
        <section className="flex-1">
          <h2 className="mb-6 text-xl font-semibold text-[#12223f]">
            Acessos
          </h2>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Usuários */}
            <Link
              href="/usuarios"
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#12223f] hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#12223f] text-xl text-white">
                👥
              </div>

              <h3 className="text-lg font-semibold text-[#12223f]">
                Usuários
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                Gerencie usuários, perfis e acessos ao sistema.
              </p>

              <div className="mt-5 text-sm font-semibold text-[#c22a2e]">
                Acessar →
              </div>
            </Link>

            {/* Clientes */}
            <Link
              href="/clientes"
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#12223f] hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#12223f] text-xl text-white">
                🏢
              </div>

              <h3 className="text-lg font-semibold text-[#12223f]">
                Clientes
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                Gerencie clientes e suas informações cadastradas.
              </p>

              <div className="mt-5 text-sm font-semibold text-[#c22a2e]">
                Acessar →
              </div>
            </Link>
          </div>
        </section>

        {/* Rodapé */}
        <footer className="mt-12 flex justify-center">
          <LogoutButton />
        </footer>
      </div>
    </main>
  );
}