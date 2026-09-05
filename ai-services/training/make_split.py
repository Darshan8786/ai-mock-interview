"""
Build a proper train/valid split for the phone-detection dataset.

The two source folders (datasets/mindprep_proctoring, datasets/MOBILE-PHONE-1)
are byte-identical duplicates of the same 179-image Roboflow export, and the
original dataset.yaml pointed val at the same folder as train (no real
held-out set). This script dedupes to the single source of truth and writes
a real 80/20 split with copies, leaving the original folders untouched.
"""
import os
import random
import shutil

random.seed(42)

SRC = os.path.join(os.path.dirname(__file__), "..", "datasets", "mindprep_proctoring", "train")
DST = os.path.join(os.path.dirname(__file__), "..", "datasets", "phone_split")
VAL_FRACTION = 0.2

src_images = os.path.join(SRC, "images")
src_labels = os.path.join(SRC, "labels")

stems = sorted(
    os.path.splitext(f)[0] for f in os.listdir(src_images) if f.lower().endswith(".jpg")
)
random.shuffle(stems)

n_val = max(1, round(len(stems) * VAL_FRACTION))
val_stems = set(stems[:n_val])
train_stems = stems[n_val:]

print(f"Total unique images: {len(stems)}")
print(f"Train: {len(train_stems)}  Val: {len(val_stems)}")


def copy_split(stem_list, split_name):
    img_dst = os.path.join(DST, split_name, "images")
    lbl_dst = os.path.join(DST, split_name, "labels")
    os.makedirs(img_dst, exist_ok=True)
    os.makedirs(lbl_dst, exist_ok=True)
    for stem in stem_list:
        shutil.copy2(os.path.join(src_images, stem + ".jpg"), os.path.join(img_dst, stem + ".jpg"))
        label_src = os.path.join(src_labels, stem + ".txt")
        if os.path.exists(label_src):
            shutil.copy2(label_src, os.path.join(lbl_dst, stem + ".txt"))
        else:
            # Negative example (no phone) - YOLO expects an empty label file
            open(os.path.join(lbl_dst, stem + ".txt"), "w").close()


copy_split(train_stems, "train")
copy_split(list(val_stems), "valid")

yaml_path = os.path.join(DST, "data.yaml")
abs_dst = os.path.abspath(DST)
with open(yaml_path, "w") as f:
    f.write(
        # Absolute paths - a relative `path:` here gets resolved against
        # Ultralytics' global datasets-root setting, not this file's folder.
        f"train: {os.path.join(abs_dst, 'train', 'images')}\n"
        f"val: {os.path.join(abs_dst, 'valid', 'images')}\n"
        "names:\n"
        "  0: phone\n"
        "nc: 1\n"
    )

print(f"Wrote split + data.yaml to {os.path.abspath(DST)}")
