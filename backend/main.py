import os
import uuid
import logging
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Request, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

from backend.config import settings
from backend.models import (
    EmissionLog, 
    EmissionLogResponse, 
    InsightsResponse, 
    UserProfile, 
    WeeklyGoal, 
    ChatRequest, 
    ChatResponse,
    RegisterRequest,
    LoginRequest
)
from backend.gcp_clients import (
    save_emission_log,
    get_emission_history,
    publish_log_event,
    get_aggregate_stats,
    save_user_profile,
    save_weekly_goal,
    get_weekly_goal,
    migrate_anonymous_logs,
    get_user_by_firebase_uid
)
from backend.ai_engine import get_insights, sustainability_chat
from backend.auth import get_current_user, verify_firebase_token

# Setup SlowAPI Limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.APP_NAME,
    description="EcoSphere API - Track, Understand, and Reduce your Ecological Footprint using Vertex AI and Google Cloud Services.",
    version="2.0.0"
)

# Attach Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Impact coefficient values (kg CO2 equivalent per unit per day)
CO2_WATER_FACTOR = 0.0003  # kg CO2e per Litre of water treatment/supply
CO2_WASTE_FACTOR = 0.5     # kg CO2e per kg municipal waste landfilling
CO2_ELEC_FACTOR = 0.4      # kg CO2e per kWh grid electricity

# Mobility factors (kg CO2e per km)
COMMUTE_FACTORS = {
    "car_petrol": 0.18,
    "car_diesel": 0.17,
    "car_electric": 0.05,
    "transit": 0.03,
    "bike_walk": 0.00
}

def calculate_impact_ratings(log: EmissionLog) -> tuple:
    """Helper to grade consumption levels compared to average baselines."""
    # Water rating (L/day): <100: Low, 100-200: Medium, >200: High
    if log.water_liters < 100:
        water_impact = "Low"
    elif log.water_liters <= 200:
        water_impact = "Medium"
    else:
        water_impact = "High"

    # Waste rating (kg/day): <1.5: Low, 1.5-3.0: Medium, >3.0: High
    if log.waste_kg < 1.5:
        waste_impact = "Low"
    elif log.waste_kg <= 3.0:
        waste_impact = "Medium"
    else:
        waste_impact = "High"

    # Energy rating (kWh/day): <8: Low, 8-16: Medium, >16: High
    if log.electricity_kwh < 8:
        energy_impact = "Low"
    elif log.electricity_kwh <= 16:
        energy_impact = "Medium"
    else:
        energy_impact = "High"

    # Mobility rating (km/day): <10: Low, 10-35: Medium, >35: High
    if log.commute_km < 10:
        mobility_impact = "Low"
    elif log.commute_km <= 35:
        mobility_impact = "Medium"
    else:
        mobility_impact = "High"

    return water_impact, waste_impact, energy_impact, mobility_impact


# --- API ROUTES ---

class AuthGooglePayload(BaseModel):
    idToken: str
    device_id: str

@app.post("/api/auth/google", response_model=UserProfile)
@limiter.limit(settings.RATE_LIMIT)
async def authenticate_google(request: Request, payload: AuthGooglePayload):
    """Authenticates a user via Google ID Token, registers profile, and migrates guest history logs."""
    try:
        # Decode and verify the ID token via Firebase Admin
        id_info = verify_firebase_token(payload.idToken)
        
        user_profile = UserProfile(
            user_id=id_info["uid"],
            firebase_uid=id_info["uid"],
            email=id_info["email"],
            name=id_info["name"],
            picture_url=id_info.get("picture")
        )
        
        # 1. Save profile information
        saved = save_user_profile(user_profile)
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to save user profile profile cache.")
            
        # 2. Trigger log ownership migration from guest device ID to new Google ID
        migrate_anonymous_logs(payload.device_id, user_profile.user_id)
        
        return user_profile
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication flow failed: {str(e)}")


@app.post("/api/auth/register", response_model=UserProfile)
@limiter.limit(settings.RATE_LIMIT)
async def register_user(request: Request, payload: RegisterRequest):
    """Registers a new user profile using a Firebase registration token."""
    try:
        # Decode and verify the ID token via Firebase Admin
        id_info = verify_firebase_token(payload.idToken)
        
        # Use name from payload if provided, else fall back to token name
        display_name = payload.name if payload.name else id_info.get("name", "Eco User")
        
        user_profile = UserProfile(
            user_id=id_info["uid"],
            firebase_uid=id_info["uid"],
            email=id_info["email"],
            name=display_name,
            picture_url=id_info.get("picture")
        )
        
        # 1. Save profile information
        saved = save_user_profile(user_profile)
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to create user profile.")
            
        # 2. Trigger log ownership migration
        migrate_anonymous_logs(payload.device_id, user_profile.user_id)
        
        return user_profile
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@app.post("/api/auth/login", response_model=UserProfile)
@limiter.limit(settings.RATE_LIMIT)
async def login_user(request: Request, payload: LoginRequest):
    """Logs in an existing user, verifies their Firebase token and registers/updates profile."""
    try:
        # Decode and verify the ID token via Firebase Admin
        id_info = verify_firebase_token(payload.idToken)
        
        user_profile = UserProfile(
            user_id=id_info["uid"],
            firebase_uid=id_info["uid"],
            email=id_info["email"],
            name=id_info["name"],
            picture_url=id_info.get("picture")
        )
        
        # 1. Save/update profile information
        saved = save_user_profile(user_profile)
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to save user profile cache.")
            
        # 2. Trigger log ownership migration
        migrate_anonymous_logs(payload.device_id, user_profile.user_id)
        
        return user_profile
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login verification failed: {str(e)}")


@app.get("/api/auth/me", response_model=UserProfile)
@limiter.limit(settings.RATE_LIMIT)
async def get_my_profile(request: Request, user: dict = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Retrieve user from SQLite/Firestore by ID
    profile_data = get_user_by_firebase_uid(user["sub"])
    if not profile_data:
        # Fall back to values from the decoded token
        return UserProfile(
            user_id=user["sub"],
            firebase_uid=user["sub"],
            email=user["email"],
            name=user["name"],
            picture_url=user.get("picture")
        )
        
    ts = profile_data.get("created_at")
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)
    else:
        ts = datetime.utcnow()
        
    return UserProfile(
        user_id=profile_data["user_id"],
        firebase_uid=profile_data.get("firebase_uid"),
        email=profile_data["email"],
        name=profile_data["name"],
        picture_url=profile_data.get("picture_url"),
        created_at=ts
    )


@app.post("/api/submit-log", response_model=EmissionLogResponse)
@limiter.limit(settings.RATE_LIMIT)
async def submit_log(request: Request, log: EmissionLog, user: Optional[dict] = Depends(get_current_user)):
    """Submits daily resource log. Maps log to Google User ID if authenticated, else Device ID."""
    try:
        # Override log.user_id if authenticated
        user_id = None
        if user:
            user_id = user["sub"]
        elif log.user_id:
            user_id = log.user_id
            
        # Calculate emissions in kg CO2
        co2_water = log.water_liters * CO2_WATER_FACTOR
        co2_waste = log.waste_kg * CO2_WASTE_FACTOR
        co2_elec = log.electricity_kwh * CO2_ELEC_FACTOR
        
        commute_factor = COMMUTE_FACTORS.get(log.commute_type, 0.15)
        co2_commute = log.commute_km * commute_factor
        
        total_co2 = co2_water + co2_waste + co2_elec + co2_commute
        
        # Calculate relative impact grades
        water_imp, waste_imp, energy_imp, mobility_imp = calculate_impact_ratings(log)
        
        log_response = EmissionLogResponse(
            log_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            device_id=log.device_id,
            user_id=user_id,
            water_liters=log.water_liters,
            waste_kg=log.waste_kg,
            electricity_kwh=log.electricity_kwh,
            commute_km=log.commute_km,
            commute_type=log.commute_type,
            co2_water_kg=round(co2_water, 4),
            co2_waste_kg=round(co2_waste, 4),
            co2_electricity_kg=round(co2_elec, 4),
            co2_commute_kg=round(co2_commute, 4),
            total_co2_kg=round(total_co2, 4),
            water_impact=water_imp,
            waste_impact=waste_imp,
            energy_impact=energy_imp,
            mobility_impact=mobility_imp
        )
        
        # Save to database
        saved = save_emission_log(log_response)
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to persist resource log.")
            
        # Publish event
        publish_log_event(log_response)
        
        return log_response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Log processing failed: {str(e)}")


@app.get("/api/history/{device_id}", response_model=List[EmissionLogResponse])
@limiter.limit(settings.RATE_LIMIT)
async def get_history(request: Request, device_id: str, limit: int = Query(default=30, ge=1, le=100), user: Optional[dict] = Depends(get_current_user)):
    """Retrieves logs history (scopes to logged-in User ID if authenticated, else Device ID)."""
    if user:
        logs = get_emission_history(user["sub"], is_user=True, limit=limit)
    else:
        logs = get_emission_history(device_id, is_user=False, limit=limit)
        
    parsed_logs = []
    for log in logs:
        ts = log["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        
        parsed_logs.append(EmissionLogResponse(
            log_id=log["log_id"],
            timestamp=ts,
            device_id=log["device_id"],
            user_id=log.get("user_id"),
            water_liters=log["water_liters"],
            waste_kg=log["waste_kg"],
            electricity_kwh=log["electricity_kwh"],
            commute_km=log["commute_km"],
            commute_type=log["commute_type"],
            co2_water_kg=log["co2_water_kg"],
            co2_waste_kg=log["co2_waste_kg"],
            co2_electricity_kg=log["co2_electricity_kg"],
            co2_commute_kg=log["co2_commute_kg"],
            total_co2_kg=log["total_co2_kg"],
            water_impact=log["water_impact"],
            waste_impact=log["waste_impact"],
            energy_impact=log["energy_impact"],
            mobility_impact=log["mobility_impact"]
        ))
    return parsed_logs


@app.get("/api/insights", response_model=InsightsResponse)
@limiter.limit(settings.RATE_LIMIT)
async def fetch_insights(request: Request, device_id: str, user: Optional[dict] = Depends(get_current_user)):
    """Retrieves the latest logs profile and uses Vertex AI Gemini to generate sustainability actions."""
    if user:
        logs = get_emission_history(user["sub"], is_user=True, limit=1)
    else:
        logs = get_emission_history(device_id, is_user=False, limit=1)
    
    if not logs:
        # Default fallback log
        default_log = EmissionLogResponse(
            log_id="default",
            timestamp=datetime.utcnow(),
            device_id=device_id,
            user_id=user["sub"] if user else None,
            water_liters=150.0,
            waste_kg=2.5,
            electricity_kwh=12.0,
            commute_km=25.0,
            commute_type="car_petrol",
            co2_water_kg=0.045,
            co2_waste_kg=1.25,
            co2_electricity_kg=4.8,
            co2_commute_kg=4.5,
            total_co2_kg=10.595,
            water_impact="Medium",
            waste_impact="Medium",
            energy_impact="Medium",
            mobility_impact="Medium"
        )
        return get_insights(default_log)
        
    log = logs[0]
    ts = log["timestamp"]
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)
        
    log_response = EmissionLogResponse(
        log_id=log["log_id"],
        timestamp=ts,
        device_id=log["device_id"],
        user_id=log.get("user_id"),
        water_liters=log["water_liters"],
        waste_kg=log["waste_kg"],
        electricity_kwh=log["electricity_kwh"],
        commute_km=log["commute_km"],
        commute_type=log["commute_type"],
        co2_water_kg=log["co2_water_kg"],
        co2_waste_kg=log["co2_waste_kg"],
        co2_electricity_kg=log["co2_electricity_kg"],
        co2_commute_kg=log["co2_commute_kg"],
        total_co2_kg=log["total_co2_kg"],
        water_impact=log["water_impact"],
        waste_impact=log["waste_impact"],
        energy_impact=log["energy_impact"],
        mobility_impact=log["mobility_impact"]
    )
    
    return get_insights(log_response)


@app.get("/api/stats/{device_id}")
@limiter.limit(settings.RATE_LIMIT)
async def fetch_stats(request: Request, device_id: str, user: Optional[dict] = Depends(get_current_user)):
    """Retrieves aggregated BigQuery statistics (scopes to logged-in user if authenticated)."""
    if user:
        stats = get_aggregate_stats(user["sub"], is_user=True)
    else:
        stats = get_aggregate_stats(device_id, is_user=False)
    return stats


# --- GOALS MANAGEMENT ---

@app.get("/api/goals", response_model=WeeklyGoal)
@limiter.limit(settings.RATE_LIMIT)
async def fetch_goals(request: Request, user: dict = Depends(get_current_user)):
    """Retrieves weekly reduction goals for the authenticated user."""
    if not user:
        raise HTTPException(status_code=401, detail="Google authentication required to manage goals.")
    
    goal = get_weekly_goal(user["sub"])
    if not goal:
        # Return default goal values
        return WeeklyGoal(
            user_id=user["sub"],
            water_target_pct=10.0,
            waste_target_pct=10.0,
            electricity_target_pct=10.0
        )
    return goal


@app.post("/api/goals", response_model=WeeklyGoal)
@limiter.limit(settings.RATE_LIMIT)
async def create_or_update_goals(request: Request, goal_input: WeeklyGoal, user: dict = Depends(get_current_user)):
    """Creates or updates weekly reduction goals for the authenticated user."""
    if not user:
        raise HTTPException(status_code=401, detail="Google authentication required to manage goals.")
    
    # Enforce token owner verification
    if goal_input.user_id != user["sub"]:
        raise HTTPException(status_code=403, detail="Forbidden: Goal target mismatch.")
        
    goal_input.updated_at = datetime.utcnow()
    saved = save_weekly_goal(goal_input)
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to save weekly goals.")
    return goal_input


# --- AI CHAT ASSISTANT ---

@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit(settings.RATE_LIMIT)
async def assistant_chat(request: Request, chat_req: ChatRequest, user: Optional[dict] = Depends(get_current_user)):
    """Consults the AI Sustainability Coach, supplying latest log data context."""
    # Resolve owner
    owner_id = user["sub"] if user else chat_req.device_id
    is_user = user is not None
    
    # Retrieve latest log
    logs = get_emission_history(owner_id, is_user=is_user, limit=1)
    last_log = None
    if logs:
        log = logs[0]
        ts = log["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
            
        last_log = EmissionLogResponse(
            log_id=log["log_id"],
            timestamp=ts,
            device_id=log["device_id"],
            user_id=log.get("user_id"),
            water_liters=log["water_liters"],
            waste_kg=log["waste_kg"],
            electricity_kwh=log["electricity_kwh"],
            commute_km=log["commute_km"],
            commute_type=log["commute_type"],
            co2_water_kg=log["co2_water_kg"],
            co2_waste_kg=log["co2_waste_kg"],
            co2_electricity_kg=log["co2_electricity_kg"],
            co2_commute_kg=log["co2_commute_kg"],
            total_co2_kg=log["total_co2_kg"],
            water_impact=log["water_impact"],
            waste_impact=log["waste_impact"],
            energy_impact=log["energy_impact"],
            mobility_impact=log["mobility_impact"]
        )
        
    reply = sustainability_chat(chat_req.message, last_log)
    
    return ChatResponse(
        reply=reply,
        timestamp=datetime.utcnow()
    )


# --- FRONTEND STATIC SERVING ---

# Mount static folder if built assets exist
backend_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(backend_dir, "static")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(static_dir, "index.html"))
        
    @app.get("/{full_path:path}")
    async def serve_frontend_assets(full_path: str):
        asset_path = os.path.join(static_dir, full_path)
        if os.path.exists(asset_path) and os.path.isfile(asset_path):
            return FileResponse(asset_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
else:
    @app.get("/")
    async def fallback_root():
        return {
            "status": "online",
            "message": "EcoSphere Backend active. Frontend static files have not been built yet."
        }
