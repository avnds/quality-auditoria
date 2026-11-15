# Executar na raiz do repositorio com Node.js e dependencias instaladas.
# Este assistente NAO gera o instalador EXE nem modifica o banco de origem.
$ErrorActionPreference = "Stop"
if (-not (Test-Path ".\\package.json")) { throw "Execute na raiz do projeto Quality." }
$origem = Read-Host "URL do Quality conectado (ex.: http://localhost:3000 ou https://quality-auditoria.vercel.app)"
$email = Read-Host "E-mail MASTER ou SUPERVISORA"
$senhaSegura = Read-Host "Senha" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($senhaSegura)
try {
    $senha = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $payload = @{ origem = $origem; email = $email; senha = $senha } | ConvertTo-Json -Compress
    $env:QUALITY_RUNTIME = "desktop"
    $payload | npx tsx scripts/instalar-desktop-primeira-vez.ts
    if ($LASTEXITCODE -ne 0) { throw "Instalacao nao concluida. Verifique a mensagem acima." }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Remove-Variable senha,payload -ErrorAction SilentlyContinue
}
