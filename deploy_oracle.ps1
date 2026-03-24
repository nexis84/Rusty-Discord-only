# Fix SSH Key Permissions for Windows OpenSSH
$KeyPath = ".\keys\ssh-key-2026-03-22.key"
icacls $KeyPath /inheritance:r
icacls $KeyPath /grant:r "$($env:USERNAME):R"

$IP = "143.47.226.220"
$User = "ubuntu"

Write-Host "Copying .env file to server..."
scp -i $KeyPath -o StrictHostKeyChecking=no .\.env ${User}@${IP}:~/.env

Write-Host "Running remote setup..."
$RemoteCommand = @"
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2
git clone https://github.com/nexis84/rustybot-discord-twitch.git
cd rustybot-discord-twitch
mv ~/.env .env
npm install
pm2 start package.json --name 'rustybot' -- start
pm2 save
"@

ssh -i $KeyPath -o StrictHostKeyChecking=no ${User}@${IP} $RemoteCommand
Write-Host "Deployment complete!"
