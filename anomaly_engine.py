import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict, Any, Tuple

class StreamingAnomalyEngine:
    """
    Stateful anomaly detection engine using Isolation Forest.
    Maintains a sliding window of historical states per aircraft.
    """
    def __init__(self, contamination: float = 0.01):
        self.model = IsolationForest(contamination=contamination, random_state=42)
        self.is_trained = False
        self.history: Dict[str, Dict[str, Any]] = {}
        
        # We need a small seed dataset to initialize the IF if we don't have historical DB access immediately
        # Features: [velocity, alt_divergence, acceleration, implied_speed]
        self.seed_data = np.array([
            [250.0, 10.0, 0.5, 250.0],
            [240.0, 15.0, -0.2, 240.0],
            [260.0, 5.0, 1.1, 260.0],
            [255.0, 12.0, 0.0, 255.0],
            [0.0, 0.0, 0.0, 0.0], # Grounded
            [500.0, 2000.0, 50.0, 1000.0] # Synthetic Anomaly
        ])
        
        # Pre-train so it's ready immediately
        self.train(self.seed_data)

    def train(self, dataset: np.ndarray):
        if len(dataset) > 0:
            self.model.fit(dataset)
            self.is_trained = True

    def get_history(self, icao24: str) -> Dict[str, Any]:
        return self.history.get(icao24)

    def update_history(self, icao24: str, packet: Dict[str, Any], features: Dict[str, float]):
        self.history[icao24] = {
            "lat": packet.get("lat") or packet.get("latitude"),
            "lon": packet.get("lon") or packet.get("longitude"),
            "timestamp": packet.get("timestamp"),
            "velocity": features.get("velocity", 0.0)
        }

    def predict(self, features: Dict[str, float]) -> Tuple[bool, float]:
        if not self.is_trained:
            return False, 0.0

        # Create feature vector
        X = np.array([[
            features.get("velocity", 0.0),
            features.get("alt_divergence", 0.0),
            features.get("acceleration", 0.0),
            features.get("implied_speed", 0.0)
        ]])

        score = self.model.decision_function(X)[0]
        pred = self.model.predict(X)[0]

        # Convert score (usually negative for outliers, positive for inliers)
        # to a 0-1 probability-like anomaly score (higher = more anomalous)
        # IF decision_function is roughly [-0.5, 0.5]
        normalized_score = float(max(0, 0.5 - score) * 2) 
        
        return bool(pred == -1), min(1.0, normalized_score)

# Global singleton
anomaly_engine = StreamingAnomalyEngine()
