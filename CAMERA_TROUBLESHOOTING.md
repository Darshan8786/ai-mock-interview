# Camera Troubleshooting Guide

## Issues Fixed ✅

1. **Video Stream Playing**
   - Added proper video playback handling with Promise catching
   - Improved error handling with console logging
   - Added `transform: scaleX(-1)` to flip the video (mirror effect like most video apps)

2. **Camera Visibility**
   - Enhanced WebcamPreview component with loading and error states
   - Better CSS styling for video element (added `bg-black` to prevent transparency issues)
   - Improved overlay display logic

3. **Browser Compatibility**
   - Added `playsInline` attribute (for iOS/mobile support)
   - Improved media constraints with ideal width/height
   - Better error messages for permission denied scenarios

## If Camera Still Doesn't Show - Debugging Steps

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for any errors starting with:
   - "Webcam error:"
   - "Camera and microphone permission denied"
   - "Camera or microphone not found"
   - "Video playback failed:"

### Step 2: Verify Permissions
- Check if your browser has camera/microphone permissions granted
- **Chrome/Edge**: Settings → Privacy & Security → Site Settings → Camera/Microphone
- **Firefox**: Preferences → Privacy & Security → Permissions

### Step 3: Check HTTPS
- The app MUST be served over HTTPS (or localhost) for camera access
- HTTP requests will be blocked by modern browsers
- Ensure your dev server is running on `localhost` or `127.0.0.1`

### Step 4: Browser Compatibility
- Minimum requirements:
  - Chrome/Edge 53+
  - Firefox 55+
  - Safari 14.1+
  - Opera 40+

### Step 5: Hardware Check
- Ensure camera is physically connected
- No other app has exclusive access to the camera
- Check Device Manager (Windows) or System Report (Mac) to see if camera is detected

## Code Changes Made

### `useWebcam.ts` Updates:
- Added explicit video constraints (ideal 1280x720)
- Improved play() promise handling
- Added proper error catching with descriptive messages
- Added transform styling inline

### `WebcamPreview.tsx` Updates:
- Added loading state with spinner
- Added error state display
- Improved video element styling
- Better event listeners for video loading

## Testing the Fix

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Refresh the page** (Ctrl+F5 or Cmd+Shift+R on Mac)
3. **Go to Interview Setup**
4. **Click "Grant Camera & Microphone Access"**
5. **You should see:**
   - Loading spinner (briefly)
   - Then the video feed appears
   - Green "CAM" indicator lights up
   - Blue "MIC" indicator lights up

## If Still Not Working

### Try These Steps:

1. **Restart the dev server**
   ```bash
   cd MindPrepAI-FE
   npm run dev
   ```

2. **Clear node_modules and reinstall**
   ```bash
   rm -r node_modules
   npm install
   npm run dev
   ```

3. **Check if another tab/app has camera access**
   - Close all other camera apps
   - Check if another browser tab is using the camera

4. **Try a different browser**
   - Test in Chrome, Firefox, or Safari to isolate browser-specific issues

5. **Check backend services**
   - Ensure `/analyze-frame` endpoint is working (for face detection)
   - Ensure `/text-to-speech` and `/speech-to-text` endpoints are working

## Performance Tips

- Camera uses significant CPU - ensure your device has adequate resources
- Mobile devices may need lower resolution - adjust constraints if performance is poor
- Closing other browser tabs can improve performance

## Security Notes

- Camera permissions are per-site and per-browser
- Permissions persist until you clear site data
- The app mirrors the video feed (scaleX(-1)) for intuitive mirror effect
- All frame captures are Base64-encoded for API transmission

---

**Version**: 1.0  
**Last Updated**: 2026-06-28
