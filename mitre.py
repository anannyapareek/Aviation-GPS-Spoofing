def map_to_mitre(anomaly, issues):
    if anomaly or issues:
        return {
            "technique": "T1565.002",
            "description": "Data Manipulation: GPS Spoofing"
        }
    return None