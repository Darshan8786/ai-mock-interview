from ultralytics import YOLO
import cv2

def test_inference(model_path="../models/proctor_yolo/weights/best.pt"):
    """
    Run webcam inference to test the trained custom YOLO model.
    """
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"Error loading model from {model_path}: {e}")
        print("Have you trained it yet?")
        return
    
    cap = cv2.VideoCapture(0)
    print("Running inference. Press 'q' to quit.")
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        # Run inference
        results = model(frame, verbose=False)
        
        # Visualize the results on the frame
        annotated_frame = results[0].plot()
        
        cv2.imshow("YOLO Proctoring Inference Test", annotated_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default="../models/proctor_yolo/weights/best.pt", help="Path to best.pt")
    args = parser.parse_args()
    
    test_inference(args.model)
