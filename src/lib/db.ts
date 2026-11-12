import { createClient } from "@libsql/client";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";
import { obterUrlBancoDesktop, prepararDiretoriosDesktop } from "@/lib/desktop/storage";

const ambiente = identificarAmbienteBanco();

const db = ambiente === "production_offline"
  ? createClient({
      // A conexão offline usa sempre o arquivo local do aplicativo.
      // Nenhuma variável TURSO_* pode redirecioná-la à nuvem.
      url: (() => {
        prepararDiretoriosDesktop();
        return obterUrlBancoDesktop();
      })(),
    })
  : createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

export default db;
