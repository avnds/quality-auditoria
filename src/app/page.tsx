
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
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
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
        <div className="mt-8">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}