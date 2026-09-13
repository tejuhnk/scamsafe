"""ML service: model score plus evidence extraction. Development training data is synthetic."""
import re
from typing import Literal
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

app = FastAPI(title="ScamSafe ML", version="0.1.0")

# Synthetic developer corpus only. Replace with a vetted, versioned dataset before production use.
TRAIN = [
 ("your otp is 128921 do not share it with anyone", "SAFE"),
 ("electricity bill of 850 is due on 20 september", "SAFE"),
 ("your order has shipped and will arrive tomorrow", "SAFE"),
 ("please update your kyc through the official bank app", "SAFE"),
 ("urgent account blocked today click http://bit.ly/kyc-update and share otp", "SCAM"),
 ("tumcha bank account aaj block honar aahe kyc update kara link var click kara", "SCAM"),
 ("jaldi paise bhejo warna account band ho jayega", "SCAM"),
 ("congratulations you won lottery send processing fee now", "SCAM"),
 ("bank customer care verify pin and cvv immediately", "SCAM"),
 ("your profile needs review please contact support", "SUSPICIOUS"),
 ("you have won a prize contact this number", "SUSPICIOUS"),
 ("urgent document update requested", "SUSPICIOUS"),
]
texts, labels = zip(*TRAIN)
vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)
model = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42).fit(vectorizer.fit_transform(texts), labels)

PHRASES = {
 "account_block": [r"account (?:will be )?block", r"account band", r"block honar"],
 "kyc": [r"\bkyc\b", r"kyc update"],
 "otp": [r"\botp\b", r"pin", r"cvv", r"password"],
 "money": [r"paise bhejo", r"send (?:the )?(?:money|fee|payment)", r"transfer.*(?:now|immediately)"],
 "urgency": [r"\burgent\b", r"\bjaldi\b", r"\baaj\b", r"today", r"immediately", r"turant"],
 "prize": [r"won (?:a )?(?:prize|lottery)", r"congratulations"],
}

class AnalyzeRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)

class Signal(BaseModel):
    category: str
    evidence: list[str]

def normalize(message: str) -> str:
    value = message.lower().strip()
    replacements = {"tumcha": "your", "khata": "account", "paise": "money", "bhejo": "send", "jaldi": "urgent", "aaj": "today", "karo": "do"}
    for original, normalized in replacements.items():
        value = re.sub(rf"\b{original}\b", normalized, value)
    return re.sub(r"\s+", " ", value)

def detect_languages(message: str):
    lower = message.lower()
    hindi = any(word in lower for word in ["paise", "bhejo", "jaldi", "karo", "aaj", "khata"])
    marathi = any(word in lower for word in ["tumcha", "honar", "aahe", "kara", "var"])
    english_words = len(re.findall(r"\b(?:account|bank|update|link|urgent|today|click|money)\b", lower))
    languages = (["Marathi", "English"] if marathi and english_words else ["Hindi", "English"] if hindi and english_words else ["Marathi"] if marathi else ["Hindi"] if hindi else ["English"])
    return languages, "-".join(languages) if len(languages) > 1 else languages[0]

@app.get("/health")
def health(): return {"status": "ok", "modelVersion": "tfidf-logreg-synthetic-v1"}

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    raw, clean = request.message, normalize(request.message)
    probs = dict(zip(model.classes_, model.predict_proba(vectorizer.transform([clean]))[0]))
    signals = []
    for category, patterns in PHRASES.items():
        evidence = [match.group(0) for pattern in patterns for match in re.finditer(pattern, raw, re.I)]
        if evidence: signals.append({"category": category, "evidence": list(dict.fromkeys(evidence))})
    urls = re.findall(r"https?://[^\s<>()]+|www\.[^\s<>()]+", raw, re.I)
    phones = re.findall(r"(?<!\d)(?:\+91[-\s]?)?[6-9]\d{9}(?!\d)", raw)
    languages, combination = detect_languages(raw)
    return {"modelProbabilities": probs, "signals": signals, "urls": urls, "phones": phones,
            "language": languages, "languageCombination": combination, "normalizedMessage": clean,
            "modelVersion": "tfidf-logreg-synthetic-v1"}
