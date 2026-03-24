# Oracle Cloud Infrastructure (OCI) Deployment Guide

This guide covers deploying RustyBot to an Oracle Cloud Always Free instance.

## 1. Create a Compute Instance
1. Log in to your Oracle Cloud Console.
2. Go to **Compute** -> **Instances** and click **Create Instance**.
3. **Name**: `rustybot-vm` (or your preference).
4. **Placement**: Leave as default.
5. **Image and Shape**:
   - **Image**: Choose **Ubuntu** (Canonical Ubuntu 22.04 or 24.04).
   - **Shape**: Click "Change Shape". Select **Ampere** (ARM) -> **VM.Standard.A1.Flex** (up to 4 OCPUs and 24GB RAM) or **AMD** -> **VM.Standard.E2.1.Micro**. Both have Always Free configurations.
     > **Note on "Out of Capacity" Errors**: If you get an error that Ampere A1 flex is out of capacity, this is very common! Try selecting a different Availability Domain (AD-2 or AD-3) under the Placement section. If all ADs are out of capacity for ARM, switch your shape to **AMD VM.Standard.E2.1.Micro** instead. It has less RAM (1GB) but is almost always available and is perfectly fine for running this bot!
6. **Networking**: Create a new Virtual Cloud Network (VCN) or use an existing one. Ensure it assigns a public IPv4 address.
7. **SSH Keys**: Choose **Generate a key pair for me** and **Save Private Key**. You will need this to connect!
8. Click **Create**.

## 2. Configure VCN Security (Open Ports)
If your bot uses a web server (like the health check on port 8080), you need to open the port:
1. Click on the attached subnet in your Instance details.
2. Click the Default Security List.
3. Add an Ingress Rule:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: TCP
   - Destination Port Range: `8080` (or whatever ports you need).

## 3. Connect to your Instance
Using SSH and the private key you downloaded:

**Windows (PowerShell) / Mac / Linux:**
```bash
ssh -i "path\to\your\privateKey.key" ubuntu@<YOUR_INSTANCE_PUBLIC_IP>
```

## 4. Environment Setup

Once connected, update the system and install prerequisites (Node.js, Git, PM2):

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20 represents LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs gettext-base

# Install global PM2 to keep the bot running 24/7
sudo npm install -g pm2
```

## 5. Clone the Bot and Install Dependencies

```bash
# Clone the repository (replace with your repo URL if it's private/forked)
git clone https://github.com/nexis84/rustybot-discord-twitch.git
cd rustybot-discord-twitch

# Install dependencies
npm install
```

## 6. Configure Environment Variables

```bash
# Copy the `.env.example` file
cp .env.example .env

# Edit .env and enter your bot tokens, database URLs, etc.
nano .env
```
*(Press `Ctrl+X`, then `Y`, then `Enter` to save in nano).*

## 7. Start the Bot using PM2

PM2 ensures the bot restarts if it crashes and starts on boot:

```bash
# Start the main Node entrypoint
pm2 start package.json --name "rustybot" -- start

# Save PM2 process list so it restores on server restart
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```
*(Run the command PM2 outputs at the end of the `pm2 startup` process).*

## 8. Viewing Logs and Managing the Bot

To see the bot's logs in real-time:
```bash
pm2 logs rustybot
```

To stop or restart the bot:
```bash
pm2 restart rustybot
pm2 stop rustybot
```

## Need Help?
If you're using Docker instead, you can follow the Docker installation steps for Ubuntu and use the provided `docker:build` and `docker:run` commands from `package.json`.
