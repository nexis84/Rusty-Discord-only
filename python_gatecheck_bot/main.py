import discord
from discord.ext import commands
import os
import asyncio
import config

# Setup logging
import logging
logging.basicConfig(level=logging.INFO)

# Bot intents
intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix='/', intents=intents)

@bot.event
async def on_ready():
    # NOTE: We avoid global sync (bot.tree.sync()) because we use the same CLIENT_ID
    # as the Node.js bot. Node.js handles the global registration.
    # If we sync here, it will delete all other commands (market, build, etc.) 
    # from the Discord application.
    print('------')

# Error handler for app commands to ignore commands handled by Node.js
@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
    if isinstance(error, discord.app_commands.errors.CommandNotFound):
        # Silently ignore commands not found in this bot's tree
        return
    # Log other errors
    print(f"App Command Error: {error}")

async def load_extensions():
    # Load cogs
    for filename in os.listdir('./cogs'):
        if filename.endswith('.py'):
            await bot.load_extension(f'cogs.{filename[:-3]}')

async def main():
    async with bot:
        await load_extensions()
        await bot.start(config.DISCORD_TOKEN)

if __name__ == '__main__':
    # Create cogs directory if it doesn't exist
    if not os.path.exists('./cogs'):
        os.makedirs('./cogs')
    
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"Error starting bot: {e}")
