<div align="center">

# 🧠 Sentio
### AI-Powered Early Screening of Depression using Text and Audio

[![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.1-EE4C2C?style=flat-square&logo=pytorch)](https://pytorch.org)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.3-119EFF?style=flat-square&logo=capacitor)](https://capacitorjs.com)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

> **Sentio** is a multimodal AI mobile application that performs early depression screening by analyzing a user's text messages and voice recordings in real time. It combines NLP, speech processing, and deep learning into a single unified system — providing personalized wellness support without replacing clinical care.

**NED University of Engineering and Technology — Final Year Project 2026**
Department of Computer Science and Information Technology · Group CT-22045

</div>

---

## 📱 App Screenshots

| Home Dashboard | Chat + Crisis Detection | Care & Recommendations | To-Do & Habits |
|:-:|:-:|:-:|:-:|
| Risk gauge, 7-day mood trend | LLaMA3 chatbot with safety layer | Box breathing, journaling, sleep hygiene | Daily tasks + monthly habit tracker |
| ![Home Screen](https://raw.githubusercontent.com/Aamir973/Sentio/main/1.png) | ![Home Screen](https://raw.githubusercontent.com/Aamir973/Sentio/main/2.png) | ![Home Screen](https://raw.githubusercontent.com/Aamir973/Sentio/main/3.png) | ![Home Screen](https://raw.githubusercontent.com/Aamir973/Sentio/main/5.png) |

| ![Home Screen](https://raw.githubusercontent.com/Aamir973/Sentio/main/4.png) |
---

## ✨ Features

- 🎙️ **Voice & Text Input** — Users speak or type naturally; both are analyzed simultaneously
- 🧬 **Multimodal Fusion** — Text (DistilBERT) + Audio (MFCC/librosa) combined via an attention-based fusion layer
- 📊 **Depression Risk Scoring** — Continuous score (0–1) mapped to Low / Moderate / High tiers
- 💬 **AI Chatbot** — Powered by LLaMA3 via Groq API with rolling 10-message conversation memory
- 🚨 **Crisis Detection Engine** — Regex + rule-based filter that detects suicidal ideation and surfaces local Pakistani helplines instantly
- 📈 **Dashboard & Tracking** — 7-day mood trend, 30-day reports, weekly emotional summaries
- 🧘 **Wellness Activities** — Box breathing, daily journaling, mindful walk, body scan, gentle stretch
- ✅ **To-Do & Habit Tracker** — Daily tasks + monthly recurring habits with alarms
- 🔒 **Privacy First** — Raw audio never stored; only extracted features and anonymous metadata persisted
- 🌐 **Fully Deployed** — Android APK via Capacitor, backend on cloud with Firebase Firestore

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Capacitor)                      │
│   HTML · CSS · JavaScript → Android APK                     │
│   Screens: Chat · Dashboard · Care · Journal · To-Do · Auth │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP / JSON
┌────────────────────▼────────────────────────────────────────┐
│                  BACKEND (FastAPI + Uvicorn)                 │
│  chat.py · sessions.py · rule_engine.py · context_builder   │
│  safety_filter.py · crisis_detection.py · api_llm.py        │
│  prompt_builder.py · risk_adapter.py · score_manager.py     │
└──────────┬─────────────────────────┬───────────────────────┘
           │                         │
┌──────────▼──────────┐   ┌──────────▼──────────────────────┐
│    TEXT MODEL        │   │         AUDIO MODEL              │
│  DistilBERT          │   │  librosa → MFCC (40 coeffs)     │
│  all-MiniLM-L6-v2   │   │  pitch · jitter · shimmer        │
│  SentenceTransformers│   │  ANOVA feature selection         │
│  → 256-d embedding  │   │  → 256-d embedding               │
└──────────┬──────────┘   └──────────┬───────────────────────┘
           │                         │
┌──────────▼─────────────────────────▼───────────────────────┐
│              FUSION LAYER (PyTorch)                          │
│  Attention gate → Linear(512→256→128→1) → sigmoid           │
│  Score [0,1] → LOW · MODERATE · HIGH tier                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              DATABASE (Firebase Firestore)                    │
│  Collections: users · sessions · messages · crisis_logs     │
│  Fields: role · timestamp · depression_score · risk_level   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 AI Models

### Text Model
- **Base:** `all-MiniLM-L6-v2` via SentenceTransformers
- **Fine-tuned:** DistilBERT on DAIC-WOZ transcripts
- **Features:** Semantic embeddings, sentiment polarity, self-referential language, absolutist word frequency
- **Framework:** HuggingFace Transformers + PyTorch

### Audio Model
- **Library:** librosa
- **Features extracted:** 40 MFCCs (mean + std = 80-dim), pitch, jitter, shimmer, spectral centroid, chroma, energy
- **Feature selection:** ANOVA F-test to select top discriminative features
- **Classifiers tested:** SVM, Random Forest, Gradient Boosting

### Fusion Model (`best_fusion_model.pt`)
```
text_proj   Linear(256 → 512)
audio_proj  Linear(256 → 512)
            ↓
attention   Linear(512 → 256 → 1)   ← dynamic modality weighting
            ↓
predictor   Linear(512→256) → BN → Linear(256→128) → Linear(128→1)
            ↓
            sigmoid → score ∈ [0, 1]
```

### Dataset
- **DAIC-WOZ** (Distress Analysis Interview Corpus – Wizard of Oz)
- University of Southern California
- Contains: audio interviews · transcripts · PHQ-8 depression scores
- 220 audio sessions used for training

---

## 🎯 Tier Risk Framework

| Tier | Score | Label | System Response |
|------|-------|-------|----------------|
| 0 | 0.0 – 0.39 | 🟢 LOW | Wellness suggestions, mindfulness activities |
| 1 | 0.4 – 0.69 | 🟡 MODERATE | Coping strategies, psychiatrist referral prompt |
| 2 | 0.7 – 1.0 | 🔴 HIGH | Crisis engine activated, helplines displayed |

**Pakistan Crisis Resources built into the app:**
- Umang Helpline: `0317-4288665`
- Rozan Counseling (Islamabad): `051-2890505`
- Emergency / Rescue: `1122`

---

## 🗂️ Project Structure

```
Sentio/
├── sentio_backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt
│   ├── api/
│   │   ├── chat.py                # /api/v1/chat endpoint
│   │   └── sessions.py            # /api/v1/sessions endpoint
│   ├── chatbot/
│   │   ├── api_llm.py             # Groq / LLaMA3 integration
│   │   ├── prompt_builder.py      # Dynamic prompt construction
│   │   └── safety_filter.py       # Harmful content filtering
│   ├── core/
│   │   ├── config.py              # Settings via pydantic
│   │   └── crisis_detection.py    # Suicidal ideation detection
│   ├── database/
│   │   └── firestore_client.py    # Firebase Admin SDK wrapper
│   ├── models/
│   │   └── depression_model.py    # PyTorch fusion model
│   ├── services/
│   │   ├── chat_service.py        # Orchestration layer
│   │   ├── context_builder.py     # Conversation memory (10 turns)
│   │   ├── risk_adapter.py        # Score → tier mapping
│   │   ├── rule_engine.py         # Sentiment + response rules
│   │   └── score_manager.py       # Score persistence
│   └── config/
│       └── sentio_boundaries.json # Safety rule definitions
│
└── sentio_frontend/
    ├── index.html                 # Main app shell
    ├── app.js                     # Core application logic
    ├── style.css                  # UI styling
    ├── capacitor.config.json      # Capacitor configuration
    ├── package.json
    └── android/                   # Generated Android project
        └── app/src/main/
            ├── java/com/sentio/app/MainActivity.java
            └── res/mipmap-*/      # All icon sizes
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Android Studio (for APK build)
- Firebase project with Firestore enabled
- Groq API key (free at [console.groq.com](https://console.groq.com))

---

### Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/Aamir973/Sentio.git
cd Sentio/sentio_backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env
# Edit .env and fill in your keys (see below)

# 5. Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Environment Variables (`.env`)

```env
GROQ_API_KEY=your_groq_api_key_here
FIREBASE_CREDENTIALS_PATH=serviceAccountKey.json
```

---

### Frontend Setup

```bash
cd Sentio/sentio_frontend

# Install Capacitor dependencies
npm install

# Build and sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

Then in Android Studio: **Build → Generate Signed APK**

---

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/chat` | Send message, get AI response + risk score |
| `GET` | `/api/v1/sessions/{user_id}` | Get session history |
| `DELETE` | `/api/v1/sessions/{user_id}` | Clear session |

**Chat request example:**
```json
POST /api/v1/chat
{
  "user_id": "uid_123",
  "message": "I've been feeling really low lately",
  "audio_path": null
}
```

**Response:**
```json
{
  "response": "I hear you, and I'm glad you shared that with me...",
  "depression_score": 0.42,
  "risk_level": "MODERATE",
  "tier": 1,
  "crisis_detected": false
}
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile Frontend** | HTML5 · CSS3 · JavaScript · Capacitor 8 |
| **Android** | Capacitor Android · Google Auth · Microphone plugin |
| **Backend** | Python 3.11 · FastAPI · Uvicorn ASGI |
| **AI / ML** | PyTorch · HuggingFace Transformers · SentenceTransformers |
| **NLP** | DistilBERT · all-MiniLM-L6-v2 · NLTK |
| **Speech** | librosa · soundfile · Whisper API |
| **LLM** | LLaMA3 via Groq API |
| **Database** | Firebase Firestore (NoSQL) · Firebase Auth |
| **DevOps** | Docker · GitHub · Postman |

---

**Project Advisor:** Engr. Mehar Fatima, Lecturer
**Technical Advisor:** Mr. Bilal Saeed

---

## ⚠️ Disclaimer

Sentio is a **screening and awareness tool only**. It is **not a medical diagnostic device** and should not replace professional psychiatric evaluation. If you or someone you know is in crisis, please contact a licensed mental health professional or use the emergency helplines listed in the app.

---

## 📄 License

This project is submitted as an undergraduate final year project at NED University of Engineering and Technology. All rights reserved © 2026.

---

<div align="center">

**Built with care at NED University · Karachi, Pakistan · 2026**

*"Early awareness is the first step toward healing."*

</div>
