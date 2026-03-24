$KeyPath = ".\keys\ssh-key-2026-03-22.key"
$IP = "143.47.226.220"
$User = "ubuntu"

Write-Host "[*] Packaging bot files..."
tar -czf deploy.tar.gz --exclude=node_modules --exclude=.git .

Write-Host "[*] Uploading update to Oracle Cloud..."
scp -i $KeyPath -o StrictHostKeyChecking=no deploy.tar.gz ${User}@${IP}:~

Write-Host "[*] Extracting and restarting bot..."
$RemoteCommand = @"
cd rustybot-discord-twitch
tar -xzf ~/deploy.tar.gz -C .
npm install
pm2 restart rustybot
rm ~/deploy.tar.gz
"@

ssh -i $KeyPath -o StrictHostKeyChecking=no ${User}@${IP} $RemoteCommand

Write-Host "[*] Cleaning up local temporary files..."
Remove-Item deploy.tar.gz

Write-Host "[*] Update complete! The bot is now running the newest code."
