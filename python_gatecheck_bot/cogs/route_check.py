import discord
from discord.ext import commands
from discord import app_commands
import gatecheck_logic
import logging

logger = logging.getLogger('RouteCheckCog')

class RouteCheck(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.client = gatecheck_logic.GatecheckClient()

    async def cog_unload(self):
        await self.client.close()

    @app_commands.command(name="route", description="Check a route for hazards")
    @app_commands.describe(
        start="Starting solar system",
        end="Destination solar system",
        preference="Route preference (shortest, secure, insecure)"
    )
    @app_commands.choices(preference=[
        app_commands.Choice(name="Shortest", value="shortest"),
        app_commands.Choice(name="Secure", value="secure"),
        app_commands.Choice(name="Insecure", value="insecure")
    ])
    async def route(self, interaction: discord.Interaction, start: str, end: str, preference: str = "shortest"):
        await interaction.response.defer(thinking=True)

        try:
            print(f"[SEARCH] Route check: {start} -> {end} ({preference})", flush=True)
            # 1. Resolve System IDs
            start_id = await self.client.get_id_from_name(start)
            end_id = await self.client.get_id_from_name(end)

            if not start_id:
                await interaction.followup.send(f"Error: Could not find system '{start}'", ephemeral=True)
                return
            if not end_id:
                await interaction.followup.send(f"Error: Could not find system '{end}'", ephemeral=True)
                return

            # 2. Get Route
            route_ids = await self.client.get_route(start_id, end_id, preference)
            
            if not route_ids:
                await interaction.followup.send("Error: No route found or API error.", ephemeral=True)
                return

            # EVE Route includes start and end? ESI route usually returns list of IDs.
            # Usually it excludes the start system but includes the end system.
            # We want to check the full path traversed.
            
            # 3. Analyze Route
            # We need to fetch names and kills for each system.
            # This can be slow, so we should do it concurrently.
            
            summary_route = []
            dangerous_systems = []
            total_jumps = len(route_ids)
            
            # Limited concurrency to avoid rate limits? Or just full send?
            # zKill limit is tight. Let's do serial or small chunks if length is big.
            # For a normal route (10-20 jumps), serial might take 10-20s which is risky for Discord timeout (15 mins on defer? No, 15 mins is max interaction token life).
            # Defer gives us 15 minutes.
            
            # Let's process.
            for sys_id in route_ids:
                sys_name = await self.client.get_name_from_id(sys_id)
                kills = await self.client.get_kills(sys_id)
                hazard = self.client.analyze_system(kills)
                
                # Determine Emoji
                status = "🟢"
                if hazard['smartbomb'] or hazard['bubble']:
                    status = "🟣"
                    dangerous_systems.append(f"{sys_name} (Smartbomb/Bubble)")
                elif hazard['camp'] or hazard['total_kills'] >= 3:
                     status = "🔴"
                     dangerous_systems.append(f"{sys_name} (High Activity)")
                elif hazard['total_kills'] > 0:
                    status = "🟡"
                
                summary_route.append(f"{status} **{sys_name}**: {hazard['total_kills']} kills")

            # 4. Build Embed
            embed = discord.Embed(
                title=f"Route: {start} -> {end}",
                description=f"Preference: {preference.capitalize()}\nTotal Jumps: {total_jumps}",
                color=discord.Color.blue()
            )
            
            # If route is too long, we might hit 4096 char limit or field limits.
            # Let's chunk it.
            route_str = "\n".join(summary_route)
            if len(route_str) > 4000:
                route_str = route_str[:3997] + "..."
            
            embed.add_field(name="Route Inspection", value=route_str, inline=False)
            
            if dangerous_systems:
                embed.add_field(name="⚠️ Dangerous Systems", value="\n".join(dangerous_systems), inline=False)
                embed.color = discord.Color.red()
            else:
                embed.add_field(name="✅ Status", value="Route appears clear (Last hour)", inline=False)
                embed.color = discord.Color.green()

            await interaction.followup.send(embed=embed)

        except Exception as e:
            logger.error(f"Error in check command: {e}")
            await interaction.followup.send("An unexpected error occurred while processing the route.", ephemeral=True)

async def setup(bot):
    await bot.add_cog(RouteCheck(bot))
