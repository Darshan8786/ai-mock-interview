from ultralytics import YOLO
import os

def train_model(data_yaml="dataset.yaml", epochs=50, imgsz=640, batch=16, name="proctor_yolo"):
    """
    Train a YOLOv8 nano model for custom object detection (phones, headsets).
    """
    if not os.path.exists(data_yaml):
        print(f"Error: {data_yaml} not found.")
        print("Please ensure your dataset is prepared and the yaml file exists.")
        return

    print("Loading base YOLOv8 nano model (yolov8n.pt)...")
    # Load a pretrained YOLOv8n model
    model = YOLO('yolov8n.pt')
    
    print(f"Starting training on {data_yaml} for {epochs} epochs...")
    
    # Train the model
    # Note: Ultralytics automatically detects GPU if available
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        name=name,
        device='', # auto-detect
        workers=0, # FIX for WinError 1455 (Paging file too small)
        project="../models", # Save inside models directory
        exist_ok=True
    )
    
    print("\nTraining completed successfully!")
    print(f"Your best model weights are saved in: ../models/{name}/weights/best.pt")
    
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train YOLO Model for Proctoring")
    parser.add_argument("--data", type=str, default="dataset.yaml", help="Path to data.yaml")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--name", type=str, default="proctor_yolo", help="Name of the training run")
    
    args = parser.parse_args()
    train_model(data_yaml=args.data, epochs=args.epochs, imgsz=args.imgsz, batch=args.batch, name=args.name)
