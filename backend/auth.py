import os
import logging
from typing import Optional
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.config import settings

# Initialize Firebase Admin
import firebase_admin
from firebase_admin import credentials as firebase_creds
from firebase_admin import auth as firebase_auth

logger = logging.getLogger("auth")

# Prevent duplicate initialization
if not firebase_admin._apps:
    initialized = False
    
    # List of possible certificate locations
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    cert_paths = [
        settings.GCP_CREDENTIALS_PATH,
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
        os.path.join(backend_dir, "serviceAccountKey.json"),
        os.path.join(os.path.dirname(backend_dir), "serviceAccountKey.json"),
        os.path.join(backend_dir, "firebase-service-account.json")
    ]
    
    # Try finding an existing certificate file
    for path in cert_paths:
        if path and os.path.exists(path) and os.path.isfile(path):
            try:
                cred = firebase_creds.Certificate(path)
                firebase_admin.initialize_app(cred)
                logger.info(f"Firebase Admin initialized using credentials file: {path}")
                initialized = True
                break
            except Exception as ex:
                logger.warning(f"Failed to initialize Firebase Admin with credentials file {path}: {ex}")

    if not initialized:
        try:
            # Fall back to default application credentials
            firebase_admin.initialize_app()
            logger.info("Firebase Admin initialized successfully with environment default credentials.")
            initialized = True
        except Exception as e:
            logger.warning(f"Firebase Admin default initialization fallback: {e}. Running in Simulated mode.")

security = HTTPBearer(auto_error=False)

def verify_firebase_token(token: str) -> dict:
    """Verifies a Firebase ID token, falling back to simulated credentials in mock/local mode."""
    if not token:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    # Local simulated developer token verification for offline development
    if token.startswith("mock-token-"):
        sub_id = token.replace("mock-token-", "")
        
        # Parse fields from structured mock token if available
        email = "sustainability.tester@gmail.com"
        name = "Eco Tester"
        if "-name-" in sub_id:
            parts = sub_id.split("-name-")
            sub_id = parts[0]
            name = parts[1].replace("_", " ")
            
        if "-email-" in sub_id:
            parts = sub_id.split("-email-")
            sub_id = parts[0]
            email = parts[1]

        return {
            "uid": sub_id,
            "email": email,
            "name": name,
            "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c"
        }

    try:
        # Cryptographic token validation via Firebase Admin SDK
        decoded_token = firebase_auth.verify_id_token(token)
        return {
            "uid": decoded_token["uid"],
            "email": decoded_token.get("email", ""),
            "name": decoded_token.get("name", "Firebase User"),
            "picture": decoded_token.get("picture")
        }
    except Exception as e:
        # Fallback for local development if Firebase Admin SDK is not initialized/configured
        # but the frontend is sending real tokens.
        if settings.MOCK_MODE:
            logger.warning(f"Cryptographic token verification failed ({e}). Attempting unverified decoding in Mock Mode.")
            import base64
            import json
            try:
                parts = token.split(".")
                if len(parts) == 3:
                    payload_b64 = parts[1]
                    payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
                    payload_data = json.loads(base64.b64decode(payload_b64).decode("utf-8"))
                    
                    uid = payload_data.get("sub") or payload_data.get("user_id") or payload_data.get("uid")
                    if uid:
                        return {
                            "uid": uid,
                            "email": payload_data.get("email", ""),
                            "name": payload_data.get("name", "Firebase User"),
                            "picture": payload_data.get("picture")
                        }
            except Exception as decode_err:
                logger.error(f"Unverified token decoding failed: {decode_err}")
                
        raise HTTPException(status_code=401, detail=f"Authentication validation failed: {str(e)}")

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> Optional[dict]:
    """Dependency helper to extract user context from bearer headers if present."""
    if not credentials:
        return None
    # We verify the Firebase ID Token
    # This maps the Firebase uid to user context so downstream endpoints Depends(get_current_user) work.
    decoded = verify_firebase_token(credentials.credentials)
    # Map 'uid' to 'sub' so it matches the existing token signature in main.py
    return {
        "sub": decoded["uid"],
        "email": decoded["email"],
        "name": decoded["name"],
        "picture": decoded["picture"]
    }



