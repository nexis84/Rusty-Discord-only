#!/usr/bin/env pwsh
<#
  Deploy RustyBot to GitHub
  
  Usage:
    .\deploy-to-github.ps1 -Owner "your-username" -Repo "rustybot-discord-twitch" -RenderApiKey "sk_live_..." -RenderServiceId "srv-xxxxx"
  
  Prerequisites:
    - GitHub CLI (gh) installed and authenticated: https://cli.github.com/
    - Git installed and configured
    - GitHub account with permission to create repos
#>

param(
    [string]$Owner = $(Read-Host "GitHub username"),
    [string]$Repo = $(Read-Host "Repository name (e.g., rustybot-discord-twitch)"),
    [string]$RenderApiKey,
    [string]$RenderServiceId,
    [bool]$Private = $true
)

Write-Host "🚀 Starting GitHub deployment for $Owner/$Repo" -ForegroundColor Cyan

# Check if gh CLI is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ GitHub CLI (gh) not found. Install from https://cli.github.com/" -ForegroundColor Red
    exit 1
}

# Initialize git repo if needed
if (-not (Test-Path .git)) {
    Write-Host "📦 Initializing git repository..." -ForegroundColor Yellow
    git init
    git config user.email "bot@example.com"
    git config user.name "RustyBot"
}

# Stage and commit
Write-Host "📝 Staging and committing files..." -ForegroundColor Yellow
git add --all
git commit -m "Initial commit: RustyBot Discord + Twitch integration" --allow-empty

# Rename branch to main
Write-Host "🔀 Setting main branch..." -ForegroundColor Yellow
git branch -M main

# Create GitHub repo
Write-Host "🔧 Creating GitHub repository..." -ForegroundColor Yellow
$repoUrl = "https://github.com/$Owner/$Repo.git"
$visibility = if ($Private) { "--private" } else { "--public" }

try {
    gh repo create "$Owner/$Repo" $visibility --confirm --source=. --remote=origin --push 2>&1 | Out-String | ForEach-Object { Write-Host $_ }
    Write-Host "✅ Repository created and code pushed to $repoUrl" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Repository may already exist or there was an error. Attempting direct push..." -ForegroundColor Yellow
    git remote remove origin 2>$null
    git remote add origin $repoUrl
    git push -u origin main
}

# Add GitHub Actions secrets
Write-Host "🔐 Adding GitHub Actions secrets..." -ForegroundColor Yellow

if ($RenderApiKey) {
    Write-Host "  → Setting RENDER_API_KEY..." -ForegroundColor Cyan
    gh secret set RENDER_API_KEY --body $RenderApiKey -R "$Owner/$Repo"
}

if ($RenderServiceId) {
    Write-Host "  → Setting RENDER_SERVICE_ID..." -ForegroundColor Cyan
    gh secret set RENDER_SERVICE_ID --body $RenderServiceId -R "$Owner/$Repo"
}

if (-not $RenderApiKey -or -not $RenderServiceId) {
    Write-Host "⚠️ Skipped Render secrets (not provided). You can add them later in GitHub Settings > Secrets." -ForegroundColor Yellow
}

# Final info
Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "📍 Repository: $repoUrl" -ForegroundColor Cyan
Write-Host "🔍 View on GitHub: https://github.com/$Owner/$Repo" -ForegroundColor Cyan
Write-Host "⚙️  GitHub Actions: https://github.com/$Owner/$Repo/actions" -ForegroundColor Cyan
Write-Host "`n💡 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Visit $repoUrl to verify push"
Write-Host "  2. Check GitHub Actions tab for CI workflow status"
Write-Host "  3. Connect Render service to GitHub (Render Dashboard > Service > Settings > GitHub)"
