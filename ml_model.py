import numpy as np
from sklearn.ensemble import IsolationForest

class AnomalyDetector:
    def __init__(self):
        # We lower contamination to be more specific to extreme jumps
        self.model = IsolationForest(contamination=0.01, random_state=42)
        self.is_trained = False
        self.history = {} # Tracks {icao24: last_position_data}

    def preprocess(self, data):
        icao = data.get("icao24")
        
        # Calculate 'Distance Delta' (Speed Check)
        # If we have history, we calculate how far it 'jumped'
        dist_delta = 0
        if icao in self.history:
            prev = self.history[icao]
            # Simple Euclidean distance as a proxy for 'jump'
            dist_delta = np.sqrt(
                (data.get("latitude", 0) - prev["lat"])**2 + 
                (data.get("longitude", 0) - prev["lon"])**2
            )
        
        # Update history for the next packet
        self.history[icao] = {"lat": data.get("latitude"), "lon": data.get("longitude")}

        # Features: Velocity, Vertical Rate, and the 'Jump' distance
        return np.array([[
            data.get("velocity", 0) or 0,
            data.get("vertical_rate", 0) or 0,
            dist_delta * 100 # Scaling the jump for the model
        ]])

    def train(self, dataset):
        # Ensure dataset is a 2D numpy array of the 3 features above
        if len(dataset) > 0:
            self.model.fit(dataset)
            self.is_trained = True

    def predict(self, data):
        if not self.is_trained:
            # Auto-train if you have enough samples, or return safe
            return {"anomaly": False, "score": 0}

        X = self.preprocess(data)
        score = self.model.decision_function(X)[0]
        pred = self.model.predict(X)[0]

        return {
            "anomaly": bool(pred == -1),
            "score": float(score)
        }
detector = AnomalyDetector()
detector.is_trained = True 
"""
import numpy as np
from sklearn.ensemble import IsolationForest

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
            return {"anomaly": False, "score": 0}

        X = self.preprocess(data)
        score = self.model.decision_function(X)[0]
        pred = self.model.predict(X)[0]

        return {
            "anomaly": pred == -1,
            "score": float(score)
        }"""