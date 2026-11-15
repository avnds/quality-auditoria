const fs = require("node:fs");
const path = require("node:path");
const raiz = path.resolve(__dirname, "..");
const origem = path.join(raiz, ".next", "standalone");
const destino = path.join(raiz, "dist-desktop", "quality-server");
if (!fs.existsSync(path.join(origem, "server.js"))) {
  throw new Error("Next standalone ausente. Execute npm run build:desktop.");
}
fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });
fs.cpSync(origem, destino, {
  recursive: true,
  filter: arquivo => {
    const relativo = path.relative(origem, arquivo);
    const nome = path.basename(arquivo);
    if (nome === ".env" || nome.startsWith(".env.")) return false;
    if (relativo.split(path.sep).includes(".git")) return false;
    return true;
  },
});
function conferirSemEnv(diretorio) {
  for (const item of fs.readdirSync(diretorio, { withFileTypes: true })) {
    if (item.name === ".env" || item.name.startsWith(".env.")) {
      throw new Error("Arquivo de ambiente proibido no pacote Desktop: " + item.name);
    }
    if (item.isDirectory()) conferirSemEnv(path.join(diretorio, item.name));
  }
}
conferirSemEnv(destino);
const staticDir = path.join(raiz, ".next", "static");
fs.cpSync(staticDir, path.join(destino, ".next", "static"), { recursive: true });
const publicDir = path.join(raiz, "public");
if (fs.existsSync(publicDir)) fs.cpSync(publicDir, path.join(destino, "public"), { recursive: true });
const esbuild = require("esbuild");
esbuild.buildSync({
  entryPoints: [path.join(raiz, "scripts", "instalar-desktop-primeira-vez.ts")],
  outfile: path.join(destino, "instalar-desktop.cjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  packages: "external",
  logLevel: "warning",
});
console.log("Pacote do servidor preparado em dist-desktop/quality-server");
