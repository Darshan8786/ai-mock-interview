"""
Zero-shot baseline: how well do pretrained (NOT fine-tuned) sentence encoders
retrieve the right topic? Used to choose which model to fine-tune.

    python -m chatbot.zero_shot
"""
import sys
import time

from sentence_transformers import SentenceTransformer

from chatbot.evaluate import Index, evaluate_sets, load, print_results, tune_threshold

CANDIDATES = sys.argv[1:] or [
    "sentence-transformers/all-MiniLM-L6-v2",
    "BAAI/bge-small-en-v1.5",
    "sentence-transformers/all-mpnet-base-v2",
]

train, validation = load("train"), load("validation")
sets = {"test1": load("test1"), "test2": load("test2"), "test3": load("test3")}

for name in CANDIDATES:
    t0 = time.time()
    model = SentenceTransformer(name, device="cpu")
    encode = lambda texts, m=model: m.encode(texts, normalize_embeddings=True, convert_to_numpy=True, batch_size=64)
    index = Index(train, encode)
    threshold, bal = tune_threshold(index, validation)
    results = evaluate_sets(index, threshold, sets)
    print_results(f"{name} zero-shot  (validation balanced {bal*100:.1f}%, {time.time()-t0:.0f}s)", threshold, results)
