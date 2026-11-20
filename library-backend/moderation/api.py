import os
import hmac
from functools import lru_cache

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

MODEL_ID = os.getenv("FORUM_MODERATION_MODEL", "dangvansam/vietnamese-toxicity")
API_KEY = os.getenv("FORUM_MODERATION_API_KEY", "")
MAX_LENGTH = min(int(os.getenv("FORUM_MODERATION_MAX_LENGTH", "512")), 512)
app = FastAPI(title="Vietnamese Forum Moderation", docs_url=None, redoc_url=None)


class ModerationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=30000)


@lru_cache(maxsize=1)
def get_classifier():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
    classifier = pipeline("text-classification", model=model, tokenizer=tokenizer, device=-1)
    return tokenizer, classifier, model.config.id2label


@app.on_event("startup")
def load_model():
    get_classifier()


def toxic_label(label: str, labels: dict) -> bool:
    normalized = label.lower().replace("_", "-").replace(" ", "-")
    if any(word in normalized for word in ("non-toxic", "not-toxic", "clean", "benign", "normal")):
        return False
    if any(word in normalized for word in ("toxic", "toxicity", "offensive", "hate", "harmful", "violation")):
        return True
    # The source model is binary. Its second class is the positive/toxic class when
    # exported with generic LABEL_n names; explicit human-readable labels take precedence.
    return normalized in {"label-1", "1"} and len(labels) == 2


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID}


@app.post("/moderate")
def moderate(payload: ModerationRequest, x_api_key: str | None = Header(default=None)):
    if API_KEY and not hmac.compare_digest(API_KEY, x_api_key or ""):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        tokenizer, classifier, labels = get_classifier()
        if not any(toxic_label(label, labels) for label in labels.values()):
            raise RuntimeError("The model labels do not identify a toxicity class")
        token_ids = tokenizer.encode(payload.text, add_special_tokens=False)
        chunk_size = max(1, MAX_LENGTH - tokenizer.num_special_tokens_to_add(pair=False))
        chunks = [token_ids[i:i + chunk_size] for i in range(0, len(token_ids), chunk_size)] or [[]]
        texts = [tokenizer.decode(chunk, skip_special_tokens=True) for chunk in chunks]
        predictions = classifier(texts, top_k=None, truncation=True, max_length=MAX_LENGTH)
        if predictions and isinstance(predictions[0], dict):
            predictions = [predictions]
        scores = [
            max((float(item["score"]) for item in result if toxic_label(item["label"], labels)), default=0.0)
            for result in predictions
        ]
        return {"toxicityScore": max(scores, default=0.0), "model": MODEL_ID, "chunks": len(chunks)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Moderation model unavailable") from exc
