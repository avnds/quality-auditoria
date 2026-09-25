import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionByToken } from "@/lib/auth/session";

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
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-10">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/icone1.png"
            alt="Quality Auditoria"
            width={200}
            height={200}
            priority
          />

          <div className="mt-8 flex flex-col items-center">
            <div className="text-5xl" aria-hidden="true">
              🚧
            </div>

            <p className="mt-4 text-xl font-semibold text-[#12223f]">
              Página em construção
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}