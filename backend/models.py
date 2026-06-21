from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class UserProfile(BaseModel):
    user_id: str = Field(..., description="Unique User Identifier (mapped to Firebase UID)")
    firebase_uid: Optional[str] = Field(None, description="Firebase Unique UID")
    email: str = Field(..., description="User email address")
    name: str = Field(..., description="User full display name")
    picture_url: Optional[str] = Field(None, description="User avatar image URL")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class WeeklyGoal(BaseModel):
    user_id: str = Field(..., description="Owner user identifier")
    water_target_pct: float = Field(10.0, ge=0, le=100, description="Goal water reduction percentage")
    waste_target_pct: float = Field(10.0, ge=0, le=100, description="Goal waste reduction percentage")
    electricity_target_pct: float = Field(10.0, ge=0, le=100, description="Goal energy reduction percentage")
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    message: str = Field(..., description="User question for the sustainability coach")
    device_id: str = Field(..., description="Anonymous identifier if guest")

class ChatResponse(BaseModel):
    reply: str = Field(..., description="Gemini-generated sustainability advice")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class EmissionLog(BaseModel):
    device_id: str = Field(..., description="Anonymous device identifier")
    user_id: Optional[str] = Field(None, description="Optional Google Subject ID if logged in")
    water_liters: float = Field(..., ge=0, description="Direct water consumption in liters")
    waste_kg: float = Field(..., ge=0, description="Municipal waste in kg")
    electricity_kwh: float = Field(..., ge=0, description="Household electricity consumption in kWh")
    commute_km: float = Field(..., ge=0, description="Distance traveled in km")
    commute_type: str = Field(..., description="Type of commute: car_petrol, car_diesel, car_electric, transit, bike_walk")

class EmissionLogResponse(BaseModel):
    log_id: str
    timestamp: datetime
    device_id: str
    user_id: Optional[str] = None
    water_liters: float
    waste_kg: float
    electricity_kwh: float
    commute_km: float
    commute_type: str
    
    # Calculated metrics
    co2_water_kg: float
    co2_waste_kg: float
    co2_electricity_kg: float
    co2_commute_kg: float
    total_co2_kg: float
    
    # Impact ratings
    water_impact: str  # Low, Medium, High
    waste_impact: str  # Low, Medium, High
    energy_impact: str  # Low, Medium, High
    mobility_impact: str  # Low, Medium, High

class Recommendation(BaseModel):
    category: str = Field(..., description="Resource category: Water, Waste, Energy, or Mobility")
    action: str = Field(..., description="Specific, highly actionable recommendation")
    saving_estimate: str = Field(..., description="Estimated savings per week (e.g. 50L water, 2kg waste)")
    difficulty: str = Field(..., description="Difficulty level: Easy, Medium, or Hard")

class InsightsResponse(BaseModel):
    device_id: str
    user_id: Optional[str] = None
    recommendations: List[Recommendation]
    generated_by: str  # "Vertex AI (Gemini 1.5)" or "Fallback Rule-Engine"
    timestamp: datetime


class RegisterRequest(BaseModel):
    idToken: str
    device_id: str
    name: str


class LoginRequest(BaseModel):
    idToken: str
    device_id: str

