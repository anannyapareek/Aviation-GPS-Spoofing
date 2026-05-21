import math
from typing import Dict, Any, Tuple

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance in meters between two points 
    on the earth (specified in decimal degrees)
    """
    if None in (lat1, lon1, lat2, lon2):
        return 0.0

    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371000 # Radius of earth in meters
    return c * r

def extract_features(current_packet: Dict[str, Any], history: Dict[str, Any] = None) -> Dict[str, float]:
    """
    Extracts advanced flight physics features from the current packet and historical state.
    """
    lat = current_packet.get("lat") or current_packet.get("latitude")
    lon = current_packet.get("lon") or current_packet.get("longitude")
    alt_baro = current_packet.get("baro_alt") or 0.0
    alt_geo = current_packet.get("geo_alt") or 0.0
    velocity = current_packet.get("velocity") or 0.0
    timestamp = current_packet.get("timestamp", 0)

    features = {
        "velocity": float(velocity),
        "alt_divergence": abs(float(alt_baro) - float(alt_geo)),
        "distance_delta": 0.0,
        "time_delta": 0.0,
        "acceleration": 0.0,
        "implied_speed": 0.0
    }

    if history and history.get("lat") is not None and history.get("lon") is not None:
        features["distance_delta"] = calculate_haversine_distance(
            history["lat"], history["lon"], lat, lon
        )
        features["time_delta"] = max(1.0, timestamp - history.get("timestamp", timestamp - 1))
        
        # Calculate implied speed (m/s) based on distance jumped over time
        features["implied_speed"] = features["distance_delta"] / features["time_delta"]
        
        # Calculate acceleration (m/s^2)
        prev_velocity = history.get("velocity", velocity)
        features["acceleration"] = (velocity - prev_velocity) / features["time_delta"]

    return features
