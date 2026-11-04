"""
SafeDrive AI — Road Hazard Image Classifier Training Script (Phase 2)
Trains a robust computer vision classifier for 5 road-hazard classes:
['pothole', 'crack', 'waterlogging', 'fallen_tree', 'normal_road'].
Evaluates on strictly held-out test data and exports serialized model artifacts.
"""

import os
import json
import numpy as np
from PIL import Image
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_score, recall_score, f1_score
import joblib

DATASETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datasets", "rdd2022_sample")
ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "app", "ml", "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

CLASSES = ["pothole", "crack", "waterlogging", "fallen_tree", "normal_road"]
SEVERITY_MAPPING = {
    "fallen_tree": "critical",
    "pothole": "high",
    "waterlogging": "medium",
    "crack": "medium",
    "normal_road": "low"
}


def extract_visual_features(image_path: str) -> np.ndarray:
    """
    Extracts normalized multi-channel color moments and gradient texture features
    from 224x224 road images.
    """
    img = Image.open(image_path).convert("RGB").resize((112, 112))
    arr = np.array(img, dtype=np.float32) / 255.0  # (112, 112, 3)

    # 1. Color moments (mean, std, skewness per channel)
    mean_rgb = arr.mean(axis=(0, 1))
    std_rgb = arr.std(axis=(0, 1))

    # 2. Color histograms (16 bins per channel = 48 features)
    r_hist, _ = np.histogram(arr[:, :, 0], bins=16, range=(0, 1), density=True)
    g_hist, _ = np.histogram(arr[:, :, 1], bins=16, range=(0, 1), density=True)
    b_hist, _ = np.histogram(arr[:, :, 2], bins=16, range=(0, 1), density=True)

    # 3. Spatial grid intensity pooling (4x4 cells = 16 features per channel)
    cells = []
    for cy in range(4):
        for cx in range(4):
            patch = arr[cy*28:(cy+1)*28, cx*28:(cx+1)*28]
            cells.extend(patch.mean(axis=(0, 1)))

    # 4. Gradient magnitude variance (roughness / edge cue)
    gray = 0.2989 * arr[:, :, 0] + 0.5870 * arr[:, :, 1] + 0.1140 * arr[:, :, 2]
    gy, gx = np.gradient(gray)
    grad_mag = np.sqrt(gx**2 + gy**2)
    grad_stats = [grad_mag.mean(), grad_mag.std(), np.percentile(grad_mag, 90)]

    features = np.concatenate([mean_rgb, std_rgb, r_hist, g_hist, b_hist, cells, grad_stats])
    return features


def load_split_data(split_name: str):
    X, y = [], []
    split_dir = os.path.join(DATASETS_DIR, split_name)
    for label_idx, cls_name in enumerate(CLASSES):
        cls_folder = os.path.join(split_dir, cls_name)
        if not os.path.exists(cls_folder):
            continue
        for fname in os.listdir(cls_folder):
            if fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                fpath = os.path.join(cls_folder, fname)
                feats = extract_visual_features(fpath)
                X.append(feats)
                y.append(label_idx)
    return np.array(X), np.array(y)


def train_and_evaluate():
    print("[SafeDrive AI] Training Road-Hazard Visual Classifier...")
    X_train, y_train = load_split_data("train")
    X_test, y_test = load_split_data("test")

    print(f"Loaded Train: {X_train.shape}, Test: {X_test.shape}")

    # Ensemble Classifier with calibrated probabilities
    clf = ExtraTreesClassifier(n_estimators=120, max_depth=12, random_state=42)
    clf.fit(X_train, y_train)

    # Evaluation on held-out test data
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    rec = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"\n--- Held-Out Test Evaluation ---")
    print(f"Accuracy:  {acc * 100:.2f}%")
    print(f"Precision: {prec * 100:.2f}%")
    print(f"Recall:    {rec * 100:.2f}%")
    print(f"F1-Score:  {f1 * 100:.2f}%")
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # Save artifacts
    model_path = os.path.join(ARTIFACTS_DIR, "hazard_classifier.joblib")
    joblib.dump(clf, model_path)

    metadata = {
        "model_name": "Road Hazard Computer Vision Classifier",
        "version": "1.0.0",
        "classes": CLASSES,
        "severity_mapping": SEVERITY_MAPPING,
        "n_features": int(X_train.shape[1]),
        "metrics": {
            "test_accuracy": round(float(acc), 4),
            "test_precision": round(float(prec), 4),
            "test_recall": round(float(rec), 4),
            "test_f1": round(float(f1), 4),
            "confusion_matrix": cm
        },
        "uncertainty_threshold": 0.60
    }

    meta_path = os.path.join(ARTIFACTS_DIR, "hazard_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nModel artifacts saved to:\n  - {model_path}\n  - {meta_path}")


if __name__ == "__main__":
    train_and_evaluate()
