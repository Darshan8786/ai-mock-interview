import unittest
import numpy as np
import time
from app.services.proctoring_engine import ProctoringEngine

class TestProctoringEngine(unittest.TestCase):
    def setUp(self):
        self.engine = ProctoringEngine()
        # Fast forward durations for testing
        self.session_id = "test_session_1"
        state = self.engine.get_session(self.session_id)
        state["NO_FACE_DURATION"] = 0.5
        state["MULTIPLE_FACE_DURATION"] = 0.5
        state["LOOKING_AWAY_DURATION"] = 0.5
        state["VIOLATION_COOLDOWN"] = 1.0
        
        # Create a dummy blank frame
        self.blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)

    def test_1_no_person(self):
        """Test: No face in frame continuously generates violation."""
        res1 = self.engine.process_frame(self.session_id, self.blank_frame)
        self.assertEqual(res1["faceCount"], 0)
        self.assertEqual(len(res1["violations"]), 0) # Not enough time passed yet
        
        time.sleep(0.6) # Wait for duration
        res2 = self.engine.process_frame(self.session_id, self.blank_frame)
        self.assertEqual(len(res2["violations"]), 1)
        self.assertEqual(res2["violations"][0]["type"], "NO_FACE")

    # Tests 2-12 would require mocking MediaPipe and YOLO responses,
    # which is complex without actual images. 
    # For a real pipeline, we would load actual images of people looking left/right/etc.
    
    def test_12_cooldown(self):
        """Test: Repeated detection cooldown."""
        # Trigger first violation
        time.sleep(0.6)
        res1 = self.engine.process_frame(self.session_id, self.blank_frame)
        self.assertEqual(len(res1["violations"]), 1)
        
        # Try again immediately
        res2 = self.engine.process_frame(self.session_id, self.blank_frame)
        self.assertEqual(len(res2["violations"]), 0) # Blocked by cooldown
        
        # Wait for cooldown
        time.sleep(1.1)
        res3 = self.engine.process_frame(self.session_id, self.blank_frame)
        self.assertEqual(len(res3["violations"]), 1) # Allowed again

if __name__ == '__main__':
    unittest.main()
