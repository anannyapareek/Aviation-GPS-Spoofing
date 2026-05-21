from typing import Dict, Any, List

# Aviation Physics Thresholds
MAX_COMMERCIAL_SPEED_MS = 350.0  # ~Mach 1, impossible for standard commercial
MAX_ACCELERATION_MS2 = 15.0      # ~1.5G, extreme for commercial pax
MAX_ALT_DIVERGENCE_M = 1000.0    # 1km diff between baro and geo altitude
MAX_IMPLIED_SPEED_MS = 500.0     # "Jump" speed - likely teleportation/spoofing

def evaluate_heuristics(features: Dict[str, float]) -> List[str]:
    """
    Evaluates extracted features against hard physics rules.
    Returns a list of violation descriptions.
    """
    violations = []
    
    if features.get("velocity", 0) > MAX_COMMERCIAL_SPEED_MS:
        violations.append(f"Impossible Velocity: {features['velocity']:.2f} m/s")
        
    if abs(features.get("acceleration", 0)) > MAX_ACCELERATION_MS2:
        violations.append(f"Extreme Acceleration: {features['acceleration']:.2f} m/s^2")
        
    if features.get("alt_divergence", 0) > MAX_ALT_DIVERGENCE_M:
        violations.append(f"Altitude Divergence Anomaly: {features['alt_divergence']:.2f}m diff")
        
    if features.get("implied_speed", 0) > MAX_IMPLIED_SPEED_MS:
        violations.append(f"Position Teleportation (Implied Speed {features['implied_speed']:.2f} m/s)")
        
    return violations
