import asyncio
import gatecheck_logic
import logging

# Configure logging to see what's happening
logging.basicConfig(level=logging.INFO)

async def test_logic():
    client = gatecheck_logic.GatecheckClient()
    
    print("--- Testing ID Resolution ---")
    jita_id = await client.get_id_from_name("Jita")
    print(f"Jita ID: {jita_id}")
    
    tama_id = await client.get_id_from_name("Tama")
    print(f"Tama ID: {tama_id}")
    
    # Amarr ID
    amarr_id = await client.get_id_from_name("Amarr")
    print(f"Amarr ID: {amarr_id}")

    if not jita_id or not amarr_id:
        print("Failed to resolve systems.")
        await client.close()
        return

    print("\n--- Testing Route Calculation (Jita -> Amarr) ---")
    route = await client.get_route(jita_id, amarr_id)
    print(f"Route length: {len(route)} systems")
    print(f"Route IDs: {route}")
    
    # Check simple ID to name
    if route:
        first_sys = await client.get_name_from_id(route[0])
        print(f"First system in route: {first_sys}")

    print("\n--- Testing zKill Fetching (Tama 24h) ---")
    # Tama is usually active
    kills = await client.get_kills(tama_id, duration=86400)
    print(f"Fetched {len(kills)} kills for Tama")
    
    print("\n--- Testing Analysis ---")
    hazard = client.analyze_system(kills)
    print(f"Hazard Analysis for Tama: {hazard}")

    await client.close()

if __name__ == "__main__":
    asyncio.run(test_logic())
