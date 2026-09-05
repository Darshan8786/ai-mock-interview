import urllib.request
import zipfile
import os
import sys

URL = "http://www.cbsr.ia.ac.cn/users/xiangyuzhu/projects/3DDFA/Database/AFLW2000-3D.zip"
ZIP_PATH = "AFLW2000-3D.zip"
EXTRACT_DIR = "data"

def report_hook(count, block_size, total_size):
    if total_size > 0:
        percent = int(count * block_size * 100 / total_size)
        sys.stdout.write(f"\rDownloading... {percent}%")
        sys.stdout.flush()

def main():
    print(f"Downloading {URL}...")
    try:
        # Add headers to avoid 403 Forbidden
        req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
        
        # We'll use urlretrieve for the built-in progress hook, but pass a custom opener to include headers
        opener = urllib.request.build_opener()
        opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
        urllib.request.install_opener(opener)
        
        urllib.request.urlretrieve(URL, ZIP_PATH, reporthook=report_hook)
        print("\nDownload finished!")
    except Exception as e:
        print(f"Failed to download: {e}")
        sys.exit(1)
        
    print(f"Extracting to {EXTRACT_DIR}...")
    os.makedirs(EXTRACT_DIR, exist_ok=True)
    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        zip_ref.extractall(EXTRACT_DIR) # The zip usually contains an 'AFLW2000' folder inside
        
    print("Download and extraction complete.")
    
    # Cleanup zip
    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)

if __name__ == "__main__":
    main()
