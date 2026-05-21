import asyncio
import hashlib
import logging
import os
import time
from datetime import datetime
from typing import List, Optional

import httpx
from dotenv import load_dotenv

from database import SessionLocal
from models import AviationPacket, RawIngest, ForensicLog
from utils import calculate_sha256, generate_forensic_hash, detector, check_physics
from websocket_manager import manager

load_dotenv()

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AviationCollector")

# FR24 Bounding Box: UAE (maxLat, minLat, minLon, maxLon)
FR24_URL = "https://data-cloud.flightradar24.com/zones/fcgi/feed.js?bounds=26.5,22.5,51.0,56.5&faa=1&satellite=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=1&estimated=1&maxage=14400&gliders=1&stats=1"

POLL_INTERVAL = 10

async def fetch_fr24_data(client: httpx.AsyncClient):
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }
    try:
        response = await client.get(FR24_URL, headers=headers, timeout=10.0)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching FR24 data: {e}")
        return None

def normalize_and_hash(fr24_id: str, state_vector: list, server_time: int) -> AviationPacket:
    icao24 = str(state_vector[0] or fr24_id)
    lat = state_vector[1]
    lon = state_vector[2]
    heading = state_vector[3]
    baro_alt_ft = state_vector[4] or 0.0
    velocity_kt = state_vector[5] or 0.0
    timestamp = state_vector[10] or server_time
    origin = state_vector[11] or "UNKNOWN"
    destination = state_vector[12] or "UNKNOWN"
    flight_number = state_vector[13]
    callsign = state_vector[16] or flight_number or icao24

    return AviationPacket(
        icao24=icao24,
        callsign=callsign.strip() if callsign else None,
        timestamp=timestamp,
        lat=lat,
        lon=lon,
        baro_alt=baro_alt_ft / 3.28084, # Convert ft to m
        geo_alt=baro_alt_ft / 3.28084,
        velocity=(velocity_kt * 1.852) / 3.6, # Convert kt to m/s
        heading=heading,
        origin=origin,
        destination=destination,
        source="FlightRadar24"
    )

def save_to_db(packets: List[AviationPacket]):
    db = SessionLocal()
    try:
        for p in packets:
            packet_dict = p.to_dict()
            
            # 1. Run Analysis
            ml_result = detector.predict(packet_dict)
            rule_issues = check_physics(packet_dict)
            
            # 2. Save Raw Entry
            hash_val = calculate_sha256(p)
            raw_entry = RawIngest(
                icao24=p.icao24,
                callsign=p.callsign,
                payload=packet_dict,
                sha256_hash=hash_val,
                source=p.source
            )
            db.add(raw_entry)

            # 3. Save to ForensicLog
            if ml_result.get("anomaly") or rule_issues:
                f_hash = generate_forensic_hash(p.icao24, p.lat, p.lon, p.timestamp)
                forensic_entry = ForensicLog(
                    icao24=p.icao24,
                    latitude=p.lat,
                    longitude=p.lon,
                    timestamp=datetime.fromtimestamp(p.timestamp),
                    description=" | ".join(rule_issues) if rule_issues else "ML Anomaly",
                    forensic_hash=f_hash,
                    mitre_technique="T1565.002"
                )
                db.add(forensic_entry)
                print(f"🚨 Incident Logged and Committed: {p.icao24}")

        db.commit()
    except Exception as e:
        print(f"❌ Database error: {e}")
        db.rollback()
    finally:
        db.close()

async def collector_task():
    logger.info("FR24 Collector task started")
    async with httpx.AsyncClient() as client:
        while True:
            start_time = datetime.now()
            data = await fetch_fr24_data(client)
            
            if data:
                server_time = int(datetime.utcnow().timestamp())
                normalized_packets = []
                
                for key, state in data.items():
                    if key in ["full_count", "version", "stats"] or not isinstance(state, list):
                        continue
                    try:
                        packet = normalize_and_hash(key, state, server_time)
                        normalized_packets.append(packet)
                    except Exception as e:
                        logger.error(f"Normalization error for state {key}: {e}")
                
                if normalized_packets:
                    save_to_db(normalized_packets)
                    logger.info(f"Ingested {len(normalized_packets)} packets from FR24")
                    
                    flight_ticks = []
                    for p in normalized_packets:
                        velocity_kmh = (p.velocity or 0) * 3.6
                        alt_ft = (p.baro_alt or 0) * 3.28084
                        flight_ticks.append({
                            "callsign": p.callsign or p.icao24,
                            "lat": p.lat or 0.0,
                            "lon": p.lon or 0.0,
                            "projected_lat": p.lat or 0.0,
                            "projected_lon": p.lon or 0.0,
                            "altitude": alt_ft,
                            "projected_altitude": alt_ft,
                            "heading": p.heading or 0.0,
                            "velocity": velocity_kmh,
                            "origin": p.origin or "UNKNOWN",
                            "destination": p.destination or "UNKNOWN",
                            "timestamp": p.timestamp * 1000
                        })
                    await manager.broadcast(flight_ticks)
            
            elapsed = (datetime.now() - start_time).total_seconds()
            sleep_time = max(0, POLL_INTERVAL - elapsed)
            await asyncio.sleep(sleep_time)
