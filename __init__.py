from typing import Dict, Any

from .feature_engineering import extract_features
from .heuristics import evaluate_heuristics
from .anomaly_engine import anomaly_engine
from .mitre_mapper import classify_threat

def analyze_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point for the intelligence engine.
    Processes a raw packet, extracts features, runs heuristics and ML,
    and returns a comprehensive threat assessment.
    """
    icao24 = packet.get("icao24")
    if not icao24:
        return {"error": "Missing icao24"}

    # 1. Get History & Extract Features
    history = anomaly_engine.get_history(icao24)
    features = extract_features(packet, history)

    # 2. Run Heuristics (Physics rules)
    violations = evaluate_heuristics(features)

    # 3. Run ML Anomaly Detection
    ml_anomaly, ml_score = anomaly_engine.predict(features)

    # 4. Classify Threat & Contextualize
    threat_assessment = classify_threat(ml_anomaly, ml_score, violations)

    # 5. Update State
    anomaly_engine.update_history(icao24, packet, features)

    # Return unified result
    return {
        "features": features,
        "ml": {
            "anomaly": ml_anomaly,
            "score": ml_score
        },
        "assessment": threat_assessment
    }
