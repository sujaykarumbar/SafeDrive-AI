import os
import json
import io
import numpy as np
from PIL import Image
import joblib

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "hazard_classifier.joblib")
META_PATH = os.path.join(ARTIFACTS_DIR, "hazard_metadata.json")

CLASSES = ["pothole", "crack", "waterlogging", "fallen_tree", "normal_road"]
SEVERITY_MAPPING = {
    "fallen_tree": "critical",
    "pothole": "high",
    "waterlogging": "medium",
    "crack": "medium",
    "normal_road": "low"
}


class HazardClassifierService:
    def __init__(self):
        self.model = None
        self.metadata = {}
        self.load_model()

    def load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                if os.path.exists(META_PATH):
                    with open(META_PATH, "r") as f:
                        self.metadata = json.load(f)
                print(f"[SafeDrive AI] Hazard Classifier v{self.metadata.get('version', '1.0.0')} loaded successfully.")
            except Exception as e:
                print(f"[SafeDrive AI] Error loading hazard classifier: {e}")
                self.model = None

    def extract_features(self, img: Image.Image) -> np.ndarray:
        """Extract multi-channel color moments and gradient features."""
        img_resized = img.convert("RGB").resize((112, 112))
        arr = np.array(img_resized, dtype=np.float32) / 255.0

        mean_rgb = arr.mean(axis=(0, 1))
        std_rgb = arr.std(axis=(0, 1))

        r_hist, _ = np.histogram(arr[:, :, 0], bins=16, range=(0, 1), density=True)
        g_hist, _ = np.histogram(arr[:, :, 1], bins=16, range=(0, 1), density=True)
        b_hist, _ = np.histogram(arr[:, :, 2], bins=16, range=(0, 1), density=True)

        cells = []
        for cy in range(4):
            for cx in range(4):
                patch = arr[cy*28:(cy+1)*28, cx*28:(cx+1)*28]
                cells.extend(patch.mean(axis=(0, 1)))

        gray = 0.2989 * arr[:, :, 0] + 0.5870 * arr[:, :, 1] + 0.1140 * arr[:, :, 2]
        gy, gx = np.gradient(gray)
        grad_mag = np.sqrt(gx**2 + gy**2)
        grad_stats = [grad_mag.mean(), grad_mag.std(), np.percentile(grad_mag, 90)]

        features = np.concatenate([mean_rgb, std_rgb, r_hist, g_hist, b_hist, cells, grad_stats])
        return features.reshape(1, -1)

    def classify_image_bytes(self, image_bytes: bytes) -> dict:
        """Classifies image bytes and returns structured prediction with uncertainty check."""
        try:
            img = Image.open(io.BytesIO(image_bytes))
        except Exception:
            raise ValueError("Invalid image file format")

        if self.model is None:
            # Fallback heuristic if model uninitialized
            return {
                "predicted_class": "pothole",
                "confidence": 0.70,
                "severity": "medium",
                "class_probabilities": {"pothole": 0.70, "crack": 0.15, "waterlogging": 0.10, "normal_road": 0.05},
                "is_uncertain": True,
                "model_version": "fallback-1.0.0"
            }

        features = self.extract_features(img)
        probabilities = self.model.predict_proba(features)[0]
        max_idx = int(np.argmax(probabilities))
        pred_class = CLASSES[max_idx]
        confidence = float(probabilities[max_idx])

        # Map to class probability dict
        prob_dict = {cls_name: round(float(prob), 4) for cls_name, prob in zip(CLASSES, probabilities)}

        # Cautious severity mapping
        severity = SEVERITY_MAPPING.get(pred_class, "medium")

        # Uncertainty threshold: if confidence < 0.60, mark for human officer inspection
        threshold = self.metadata.get("uncertainty_threshold", 0.60)
        is_uncertain = confidence < threshold

        return {
            "predicted_class": pred_class,
            "confidence": round(confidence, 4),
            "severity": severity,
            "class_probabilities": prob_dict,
            "is_uncertain": is_uncertain,
            "model_version": self.metadata.get("version", "1.0.0"),
            "resolution_guidance": "High-urgency road obstruction" if severity == "critical" else "Schedule repair order"
        }


hazard_service = HazardClassifierService()
