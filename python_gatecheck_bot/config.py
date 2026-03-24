import os

# Discord Bot Token
# Replace with your actual token or use environment variables
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN', 'YOUR_DISCORD_TOKEN_HERE')

# EVE Online API Endpoints
ESI_BASE_URL = "https://esi.evetech.net/latest"
ZKILL_BASE_URL = "https://zkillboard.com/api"

# Headers for API requests to be a good citizen
USER_AGENT = "EVE Gatecheck Bot / 1.0 (Contact: YourContactInfo)"

# Headers for aiohttp
HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/json'
}
