export default function Home() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-[#12223f] font-['Montserrat']">
            Quality <span className="text-[#12223f] font-['Pacifico']">Auditoria</span>
          </h1>

          <div className="mx-auto mt-3 h-1 w-30
           rounded-full bg-[#c22a2e]" />
        </div>

        <p className="text-gray-600">
          Sistema de gestão de auditorias de qualidade
        </p>
      </div>
    </main>
  );
}