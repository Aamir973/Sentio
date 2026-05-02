from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.chat import router as chat_router
from api.sessions import router as sessions_router   # ← add this
from core.config import settings

app = FastAPI(
    title="Sentio Mental Health Chatbot API",
    description="AI-powered mental health support chatbot with crisis detection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])
app.include_router(sessions_router, prefix="/api/v1", tags=["Sessions"])   # ← add this


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Sentio API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)