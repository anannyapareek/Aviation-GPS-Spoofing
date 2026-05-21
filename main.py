import asyncio
from datetime import datetime
from typing import List
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc
from contextlib import asynccontextmanager
import numpy as np
from sklearn.ensemble import IsolationForest

from database import engine, get_db, init_db
from models import RawIngest, HashedPacketResponse, AviationPacket, ForensicLog
from collector import collector_task
from utils import calculate_sha256, decode_hex, generate_forensic_hash, detector, check_physics, map_to_mitre
from websocket_manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Keep your existing initialization
    try:
        init_db()
        
        # Your existing training data
        training_data = [
            [250, 10000, 5],
            [230, 11000, 2],
            [260, 9000, -3],
            [240, 10500, 1],
        ]
        
        detector.train(training_data)
        print("ML model trained.")

        # --- NEW: Sandbox Test Block Starts ---
        print("🚀 Forcing a Sandbox Test Incident...")
        from database import SessionLocal # Ensure this import is correct for your project
        from datetime import datetime
        
        db = SessionLocal()
        try:
            test_packet = {
                "icao24": "SPOOF_TEST",
                "lat": 25.2,
                "lon": 55.3,
                "velocity": 5000, # Triggers physics rule
                "timestamp": int(datetime.now().timestamp())
            }
            
            # Generate the SHA-256 Seal
            f_hash = generate_forensic_hash(
                flight_id=test_packet["icao24"],
                latitude=test_packet["lat"],
                longitude=test_packet["lon"],
                timestamp=test_packet["timestamp"]
            )
            
            # Save to your forensic table
            forensic_entry = ForensicLog(
                icao24=test_packet["icao24"],
                latitude=test_packet["lat"],
                longitude=test_packet["lon"],
                timestamp=datetime.fromtimestamp(test_packet["timestamp"]),
                mitre_technique="T1565.002",
                description="Simulated Sandbox Spoof: High Velocity",
                forensic_hash=f_hash
            )
            db.add(forensic_entry)
            db.commit()
            print(f"✅ Sandbox Incident Created: {f_hash[:16]}...")
        finally:
            db.close()
        # --- End of Test Block ---

        print("Database initialized successfully.")
    except Exception as e:
        print(f"Database initialization info: {e}")
    
    # 2. Keep your background collector starting
    collector_task_instance = asyncio.create_task(collector_task())
    
    yield 
    
    # 3. Keep your shutdown cleanup
    collector_task_instance.cancel()
    try:
        await collector_task_instance
    except asyncio.CancelledError:
        pass


# Initialize FastAPI app
app = FastAPI(title="Aviation SIEM Collector", lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "service": "Aviation SIEM Collector"}

@app.websocket("/api/ws/flights")
async def websocket_flights(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from the client, but we must keep the connection open
            # and listen to detect if the client disconnects.
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/v1/live-traffic", response_model=List[HashedPacketResponse])
def get_live_traffic(limit: int = 50, db: Session = Depends(get_db)):
    """
    Returns the latest hashed packets from the collection.
    """
    records = db.query(RawIngest).order_by(desc(RawIngest.inserted_at)).limit(limit).all()
    return records

@app.post("/api/v1/ingest/manual")
async def ingest_manual(data: dict, db: Session = Depends(get_db)):
    """
    Ingests manual data (Hex or JSON) with MITRE tagging.
    """
    raw_input = data.get("input", "")
    input_type = data.get("type", "json") # 'json' or 'hex'
    mitre_tech = data.get("mitre_technique")
    
    try:
        if input_type == "hex":
            packet_data = decode_hex(raw_input)
        else:
            # Assume JSON
            if isinstance(raw_input, str):
                import json
                packet_data = json.loads(raw_input)
            else:
                packet_data = raw_input
        
        # Add MITRE technique if provided
        packet_data["mitre_technique"] = mitre_tech
        packet_data["source"] = "Manual_Simulation"
        
        # Validate with Pydantic
        packet = AviationPacket(**packet_data)
        
        # === ML + RULES ANALYSIS ===
        ml_result = detector.predict(packet_data)
        rule_issues = check_physics(packet_data)
        mitre = map_to_mitre(ml_result["anomaly"], rule_issues)
        
        # Generate hash (forensic parity)
        hash_val = calculate_sha256(packet)
        
        # Save to DB
        raw_entry = RawIngest(
            icao24=packet.icao24,
            callsign=packet.callsign,
            payload=packet.to_dict(),
            sha256_hash=hash_val,
            source=packet.source
        )
        db.add(raw_entry)
        
        # === FORENSIC LOGGING ===
        if ml_result["anomaly"] or rule_issues:
            # Generate digital seal
            f_hash = generate_forensic_hash(
                flight_id=packet.icao24,
                latitude=packet.lat,
                longitude=packet.lon,
                timestamp=packet.timestamp
            )
            
            forensic_entry = ForensicLog(
                icao24=packet.icao24,
                latitude=packet.lat,
                longitude=packet.lon,
                timestamp=datetime.fromtimestamp(packet.timestamp),
                mitre_technique=mitre["technique"] if mitre else "UNKNOWN",
                description=" | ".join(rule_issues) if rule_issues else "ML Anomaly detected",
                forensic_hash=f_hash
            )
            db.add(forensic_entry)
            logger_info = f"Incident detected! Sealed with {f_hash[:16]}..."
            print(logger_info)

        db.commit()
        
        return {
            "status": "success",
            "hash": hash_val,
            "icao24": packet.icao24,
            "forensic_hash": f_hash if (ml_result["anomaly"] or rule_issues) else None,
            "analysis": {
                "ml": ml_result,
                "rules": rule_issues,
                "mitre": mitre
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Ingestion failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
