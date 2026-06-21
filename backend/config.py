import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Application Config
    APP_NAME: str = "EcoSphere"
    DEBUG: bool = True
    PORT: int = 8080
    HOST: str = "0.0.0.0"
    RATE_LIMIT: str = "30 per minute"
    
    # GCP Config
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "")
    GCP_CREDENTIALS_PATH: str = os.getenv("GCP_CREDENTIALS_PATH", "")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    
    # Vertex AI / Gemini
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = "gemini-1.5-flash"
    
    # Firestore
    FIRESTORE_DATABASE: str = "(default)"
    
    # Pub/Sub
    PUBSUB_TOPIC_ID: str = "ecosphere-emission-events"
    
    # BigQuery
    BIGQUERY_DATASET: str = "ecosphere_analytics"
    BIGQUERY_TABLE: str = "user_emissions"
    
    # Secret Manager
    SECRET_NAME: str = "ecosphere-secrets"
    
    # Mock Mode Override
    # If set to True, or if GCP credentials/project are missing, the app runs in MOCK mode.
    MOCK_MODE: bool = os.getenv("MOCK_MODE", "true").lower() in ("true", "1", "yes")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Auto-detect if mock mode should be forced due to missing GCP credentials
if not settings.GCP_PROJECT_ID and not settings.GEMINI_API_KEY:
    settings.MOCK_MODE = True
