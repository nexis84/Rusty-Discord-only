# Google Analytics 4 Configuration for RustyBot
# Add these to your .env file

# Google Analytics 4 Settings
# Get these from: https://analytics.google.com/analytics/web/
# 1. Create a GA4 property
# 2. Go to Admin > Data Streams > Web > Measurement Details
# 3. Copy the Measurement ID (looks like G-XXXXXXXXXX)
GA_MEASUREMENT_ID=G-XXXXXXXXXX

# For the API Secret:
# 1. Go to Admin > Data Streams > Web > Measurement Protocol API secrets
# 2. Click "Create" to generate a new API secret
# 3. Copy the secret value
GA_API_SECRET=your_api_secret_here

# Example .env file entries:
# GA_MEASUREMENT_ID=G-ABC123DEF4
# GA_API_SECRET=xYz789AbC_dEf456GhI

# IMPORTANT: Keep these values secret and don't commit them to version control!