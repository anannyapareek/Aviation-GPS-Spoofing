from typing import Dict, Any, List

def classify_threat(ml_anomaly: bool, ml_score: float, violations: List[str]) -> Dict[str, Any]:
    """
    Combines ML scores and heuristic violations into a final confidence score
    and MITRE ATT&CK contextualization.
    """
    confidence = 0.0
    severity = "INFO"
    mitre_technique = None
    description = "Normal Flight Behavior"

    # Base score from ML (0.0 to 1.0) -> (0 to 100)
    confidence += (ml_score * 50) 

    # Penalty from heuristics
    if violations:
        confidence += 50
        
    confidence = min(100.0, confidence)

    # Classify severity
    if confidence > 80 or len(violations) > 1:
        severity = "CRITICAL"
        mitre_technique = "T1565.002"
        description = "High Confidence Data Manipulation / Teleportation Detected"
    elif confidence > 50 or ml_anomaly or len(violations) == 1:
        severity = "WARNING"
        mitre_technique = "T1565.002"
        description = "Suspicious Telemetry / Sensor Glitch"
    elif confidence > 20:
        severity = "LOW"
        description = "Minor Telemetry Drift"

    # Specific override for known spoofing signatures
    if any("Teleportation" in v for v in violations):
        severity = "CRITICAL"
        confidence = max(95.0, confidence)
        mitre_technique = "T1565.002"
        description = "Confirmed Position Teleportation (GPS Spoofing/Replay)"

    return {
        "confidence": round(confidence, 2),
        "severity": severity,
        "mitre_technique": mitre_technique,
        "description": description,
        "violations": violations
    }
