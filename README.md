# ScamSafe

An explainable scam-SMS detector for English and code-mixed Indian language messages. The application combines a trainable TF-IDF logistic-regression model with context-aware rules, phrase matching, URL inspection, phone extraction, and configurable risk scoring.

## Run locally

1. Copy `.env.example` to `.env` and replace `JWT_SECRET`.
2. Run `docker compose up --build`.
3. Open `http://localhost:8080`; API health is at `http://localhost:4000/health`.

For development, install Node dependencies at the repository root, install `services/ml/requirements.txt` in a Python virtual environment, then run `npm run dev`.

## Current implementation scope

The repository contains the runnable public analyzer vertical slice: React user interface, Express API boundary, FastAPI ML/rules service, context-aware risk scoring, health endpoints, and Docker topology. Authentication, persistence, SaaS billing, API keys, batch uploads, and the admin tools are deliberately not represented as finished features yet. They require the next phases to add MongoDB schemas, guarded endpoints, migrations, and their interfaces rather than placeholder screens.

## Detection limitations

This is a decision-support tool. A suspicious URL or unfamiliar number alone does not establish that a message is fraudulent. The baseline ML model is trained from the included clearly marked synthetic development corpus, so its metrics must not be represented as real-world accuracy.
