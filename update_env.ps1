# Update .env file on Oracle Cloud server
# Usage: .\update_env.ps1

$KeyPath = ".\keys\ssh-key-2026-03-22.key"
$IP = "143.47.226.220"
$User = "ubuntu"
$RemotePath = "~/rustybot-discord-twitch"

# Check if local .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found locally" -ForegroundColor Red
    Write-Host "   Create .env by copying .env.template and filling in your credentials:" -ForegroundColor Yellow
    Write-Host "   Copy-Item .env.template .env" -ForegroundColor Cyan
    exit 1
}

Write-Host "📤 Uploading .env to Oracle server..." -ForegroundColor Yellow

# Fix SSH Key Permissions
icacls $KeyPath /inheritance:r | Out-Null
icacls $KeyPath /grant:r "$($env:USERNAME):R" | Out-Null

# Upload .env file
scp -i $KeyPath -o StrictHostKeyChecking=no .env ${User}@${IP}:${RemotePath}/.env

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ .env uploaded successfully" -ForegroundColor Green
    
    Write-Host "`n🔄 Restarting bot with new environment..." -ForegroundColor Yellow
    ssh -i $KeyPath -o StrictHostKeyChecking=no ${User}@${IP} @"
cd $RemotePath
pm2 restart rustybot --update-env
pm2 logs rustybot --lines 30 --nostream
"@
    
    Write-Host "`n✅ Bot restarted! Check logs above for status." -ForegroundColor Green
} else {
    Write-Host "❌ Failed to upload .env file" -ForegroundColor Red
    exit 1
}
