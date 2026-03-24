# Deploying this project to GitHub

This project is ready to be pushed to a GitHub repository. Below are step-by-step PowerShell commands to create a new repository locally, push it to GitHub, and enable a basic CI workflow.

1) Create a repo on GitHub
- Visit https://github.com/new and create a repository name (for example `rustybot-discord-twitch`). Keep it private or public as you prefer.

2) Locally: initialize git, add remote, push
Open PowerShell in the project root and run (replace values):

```powershell
# Configure these values
$GITHUB_USER = 'your-github-username'
$REPO_NAME = 'rustybot-discord-twitch'
$GIT_REMOTE = "https://github.com/$GITHUB_USER/$REPO_NAME.git"

# Initialize repo (if not already a git repo)
if (-not (Test-Path .git)) { git init }

git add --all
git commit -m "Initial commit: RustyBot Discord + Twitch"

git branch -M main

# Add remote and push
git remote add origin $GIT_REMOTE
# If you use HTTPS and want a prompt, run the push and enter your credentials
git push -u origin main
```

3) Add GitHub Actions secrets (optional but recommended)
- In your GitHub repository, go to `Settings > Secrets and variables > Actions`. Add the following secrets if you want the action to trigger Render deploys:
  - `RENDER_API_KEY` — a Render API key (account or service key) with permission to trigger deploys and update env vars
  - `RENDER_SERVICE_ID` — the service id for your Render service (e.g., `srv-xxxxx`)

4) Files added by this change
- `.github/workflows/ci.yml` — runs CI on push/pull and (optionally) triggers a Render deploy when secrets are configured
- `README-GITHUB-DEPLOY.md` — this file (instructions)

5) Notes
- The CI file triggers only if pushed to GitHub. To deploy automatically to Render from GitHub, set up Render to use your GitHub repository (Render docs) or provide `RENDER_API_KEY` + `RENDER_SERVICE_ID` as secrets and the workflow will POST a deploy to Render's API.

If you'd like, I can:
- Create a more advanced workflow that builds a Docker image and pushes to a registry, or
- Add a GitHub Pages or Release publishing workflow.
