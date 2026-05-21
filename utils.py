import hashlib
import json
import numpy as np
from sklearn.ensemble import IsolationForest
from models import AviationPacket

def calculate_sha256(packet: AviationPacket) -> str:
    """
    Generates a deterministic SHA-256 hash.
    We convert to a dict and use standard json.dumps to ensure 
    keys are always in the same order for the hash.
    """
    # Convert Pydantic model to dict, then to a sorted JSON string
    packet_dict = packet.model_dump() 
    json_str = json.dumps(packet_dict, sort_keys=True)
    
    return hashlib.sha256(json_str.encode()).hexdigest()

def decode_hex(hex_str: str) -> dict:
    """
    Decodes ADS-B/Mode S hex strings. 
    Currently returns a simulated packet for testing your Sandbox.
    """
    print(f"Decoding Hex: {hex_str}")
    
    # This dictionary must match your AviationPacket fields exactly
    return {
        "icao24": "4b1a23",
        "callsign": "SIM_ADS_B",
        "timestamp": 1714065600,
        "latitude": 25.2048,
        "longitude": 55.2708,
        "baro_alt": 35000,
        "geo_alt": 35000,
        "velocity": 480,
        "source": "Manual_Hex"
    }

def check_physics(data):
    issues = []
    velocity = data.get("velocity", 0)
    vertical_rate = data.get("vertical_rate", 0)

    if velocity > 350:
        issues.append("Impossible speed")

    if abs(vertical_rate) > 100:
        issues.append("Unrealistic climb rate")

    return issues

def map_to_mitre(anomaly, issues):
    if anomaly or issues:
        return {
            "technique": "T1565.002",
            "description": "Data Manipulation: GPS Spoofing"
        }
    return None

class AnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(contamination=0.05, random_state=42)
        self.is_trained = False

    def preprocess(self, data):
        return np.array([[
            data.get("velocity", 0),
            data.get("geo_altitude", 0),
            data.get("vertical_rate", 0)
        ]])

    def train(self, dataset):
        self.model.fit(dataset)
        self.is_trained = True

    def predict(self, data):
        if not self.is_trained:
            return {"anomaly": False, "score": 0.0}

        X = self.preprocess(data)
        score = self.model.decision_function(X)[0]
        pred = self.model.predict(X)[0]

        return {
            "anomaly": bool(pred == -1),
            "score": float(score)
        }

detector = AnomalyDetector()

def generate_forensic_hash(flight_id: str, latitude: float, longitude: float, timestamp: int) -> str:
    """
    Generates a deterministic SHA-256 digital seal for forensic logging.
    This ensures that the incident data hasn't been tampered with.
    """
    # Create a consistent dictionary for hashing
    data = {
        "icao24": flight_id,
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": timestamp
    }
    # Sort keys to ensure the hash is always the same for the same data
    json_str = json.dumps(data, sort_keys=True)
    
    return hashlib.sha256(json_str.encode()).hexdigest()