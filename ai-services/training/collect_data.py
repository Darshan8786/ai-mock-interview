import cv2
import os
import time

def collect_data(output_dir="datasets/raw_images", num_images=100, interval=1.0):
    """
    Collect images from webcam for custom YOLO training.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"Starting data collection. Saving to {output_dir}")
    print(f"Goal: {num_images} images, taking one every {interval} seconds.")
    print("Press 'q' to quit early.")
    print("Starting in 3 seconds...")
    time.sleep(3)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    count = 0
    last_time = time.time()

    while count < num_images:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame.")
            break

        current_time = time.time()
        
        # Display the frame
        cv2.putText(frame, f"Captured: {count}/{num_images}", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.imshow("Data Collection", frame)

        # Save frame at intervals
        if current_time - last_time >= interval:
            filename = os.path.join(output_dir, f"capture_{int(time.time())}.jpg")
            cv2.imwrite(filename, frame)
            print(f"Saved {filename}")
            count += 1
            last_time = current_time

        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("Collection stopped manually.")
            break

    cap.release()
    cv2.destroyAllWindows()
    print(f"Done! Collected {count} images.")
    print("Next step: Use a tool like Roboflow or CVAT to annotate these images.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Collect Webcam Data for YOLO Training")
    parser.add_argument("--output", type=str, default="../datasets/raw_images", help="Output directory")
    parser.add_argument("--count", type=int, default=100, help="Number of images to capture")
    parser.add_argument("--interval", type=float, default=1.0, help="Seconds between captures")
    
    args = parser.parse_args()
    collect_data(output_dir=args.output, num_images=args.count, interval=args.interval)
