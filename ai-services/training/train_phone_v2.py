"""
Retrain the phone detector on the deduped, properly-split dataset
(datasets/phone_split). Saves to models/proctor_yolo_v2/weights/ so the
current production weights (models/proctor_yolo/weights/best.pt) are left
untouched until the new run's validation metrics are reviewed.
"""
import os
from ultralytics import YOLO

HERE = os.path.dirname(__file__)
DATA_YAML = os.path.join(HERE, "..", "datasets", "phone_split", "data.yaml")

if __name__ == "__main__":
    model = YOLO(os.path.join(HERE, "yolov8n.pt"))
    model.train(
        data=DATA_YAML,
        epochs=60,
        patience=15,
        imgsz=640,
        batch=16,
        device="cpu",
        workers=0,
        project="../models",
        name="proctor_yolo_v2",
        exist_ok=True,
        seed=42,
    )
    print("Training complete.")
