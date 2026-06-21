import os
import json
import logging
from typing import List, Optional
from backend.config import settings
from backend.models import EmissionLogResponse, Recommendation, InsightsResponse
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_engine")

# Try to setup google-genai
GEMINI_CLIENT_AVAILABLE = False
try:
    from google import genai
    from google.genai import types
    GEMINI_CLIENT_AVAILABLE = True
except ImportError:
    pass

# Helper to check if real Gemini can be initialized
def get_gemini_client():
    if not GEMINI_CLIENT_AVAILABLE:
        return None
        
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
            return None
            
    try:
        if api_key:
            return genai.Client(api_key=api_key)
        else:
            return genai.Client()
    except Exception as e:
        logger.warning(f"Failed to create Google GenAI Client: {e}")
        return None

# --- DETERMINISTIC FALLBACK RULE-ENGINE ---
def generate_fallback_recommendations(log: EmissionLogResponse) -> List[Recommendation]:
    """Generates customized recommendations based on a rule-engine when AI is unavailable."""
    recommendations = []
    
    # 1. Water Recommendation
    if log.water_liters > 200:
        recommendations.append(Recommendation(
            category="Water",
            action="Install a high-efficiency aerator and low-flow showerhead to reduce volumetric flow rate.",
            saving_estimate="~450 Liters / week",
            difficulty="Easy"
        ))
    elif log.water_liters > 120:
        recommendations.append(Recommendation(
            category="Water",
            action="Ensure the dishwasher and washing machine are only run when fully loaded.",
            saving_estimate="~150 Liters / week",
            difficulty="Easy"
        ))
    else:
        recommendations.append(Recommendation(
            category="Water",
            action="Adopt rain harvesting or greywater reuse to irrigate household plants.",
            saving_estimate="~80 Liters / week",
            difficulty="Medium"
        ))
        
    # 2. Waste Recommendation
    if log.waste_kg > 4.0:
        recommendations.append(Recommendation(
            category="Waste",
            action="Establish a localized organic composting cycle for kitchen and garden biowaste.",
            saving_estimate="~5.0 kg / week",
            difficulty="Medium"
        ))
    elif log.waste_kg > 1.5:
        recommendations.append(Recommendation(
            category="Waste",
            action="Audit grocery packaging and switch to dry goods purchased in bulk with reusable containers.",
            saving_estimate="~2.5 kg / week",
            difficulty="Easy"
        ))
    else:
        recommendations.append(Recommendation(
            category="Waste",
            action="Conduct an electronic and hazardous waste inventory to recycle at certified depots.",
            saving_estimate="~0.5 kg / week",
            difficulty="Hard"
        ))
        
    # 3. Energy Recommendation
    if log.electricity_kwh > 20:
        recommendations.append(Recommendation(
            category="Energy",
            action="Audit and insulate home windows and draft doors to reduce thermal loading on heating/cooling.",
            saving_estimate="~35 kWh / week",
            difficulty="Medium"
        ))
    elif log.electricity_kwh > 10:
        recommendations.append(Recommendation(
            category="Energy",
            action="Identify and isolate vampire/standby power loads using smart energy strip switches.",
            saving_estimate="~12 kWh / week",
            difficulty="Easy"
        ))
    else:
        recommendations.append(Recommendation(
            category="Energy",
            action="Transition remaining household bulbs to smart LEDs and lower thermostat settings by 1°C.",
            saving_estimate="~5 kWh / week",
            difficulty="Easy"
        ))
        
    # 4. Mobility Recommendation
    if log.commute_type in ("car_petrol", "car_diesel"):
        if log.commute_km > 30:
            recommendations.append(Recommendation(
                category="Mobility",
                action="Transition at least 2 commute days per week to high-speed public rail or carpooling.",
                saving_estimate="~45 kg CO2 / week",
                difficulty="Medium"
            ))
        else:
            recommendations.append(Recommendation(
                category="Mobility",
                action="Replace short distance drives (under 3km) with walking or e-bike commuting.",
                saving_estimate="~15 kg CO2 / week",
                difficulty="Easy"
            ))
    elif log.commute_type == "car_electric":
        recommendations.append(Recommendation(
            category="Mobility",
            action="Optimize EV charging intervals to run strictly during off-peak hours or when solar grid output is highest.",
            saving_estimate="~8 kg CO2 / week",
            difficulty="Easy"
        ))
    else:
        recommendations.append(Recommendation(
            category="Mobility",
            action="Maintain tire pressure and optimal aerodynamics if using vehicles, or optimize multi-modal public transit routes.",
            saving_estimate="~3 kg CO2 / week",
            difficulty="Easy"
        ))
        
    return recommendations


# --- GEMINI INSIGHTS GENERATION ---
def get_insights(log: EmissionLogResponse) -> InsightsResponse:
    """Generates personalized insights using Vertex AI (Gemini 1.5 Flash) or fallback rule engine."""
    client = get_gemini_client()
    
    # If client is not available, or config enforces mock, run rule engine instantly
    if settings.MOCK_MODE or client is None:
        logger.info("Using local Rule-Engine fallback for recommendations.")
        recs = generate_fallback_recommendations(log)
        return InsightsResponse(
            device_id=log.device_id,
            user_id=log.user_id,
            recommendations=recs,
            generated_by="Fallback Rule-Engine",
            timestamp=datetime.utcnow()
        )
        
    # AI Mode
    prompt = f"""
    You are an expert environmental consultant and sustainability coach.
    Analyze the user's daily ecological resource log below and compare it against regional averages:
    
    USER METRICS:
    - Water Consumption: {log.water_liters:.1f} Liters/day (Average: 150L)
    - Waste Production: {log.waste_kg:.1f} kg/day (Average: 2.5kg)
    - Electricity Usage: {log.electricity_kwh:.1f} kWh/day (Average: 12kWh)
    - Commuting Distance: {log.commute_km:.1f} km/day using a vehicle of type: '{log.commute_type}' (Average: 25km)
    
    Generate exactly 4 highly-actionable, quantified recommendations tailored to this profile.
    Generate one recommendation for each category: "Water", "Waste", "Energy", and "Mobility".
    For each recommendation, give:
    1. 'category' - Must be exactly "Water", "Waste", "Energy", or "Mobility".
    2. 'action' - A specific, highly personalized action (do not be generic). Suggest a concrete measure (e.g. "Install a dual-flush toilet to save toilet flush volumes" or "Carpool with colleagues on your 30km route").
    3. 'saving_estimate' - Quantify the potential weekly resources or emissions saved.
    4. 'difficulty' - Must be "Easy", "Medium", or "Hard".
    
    Respond strictly in JSON format.
    """
    
    try:
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=List[Recommendation],
            temperature=0.4,
        )
        
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=config
        )
        
        if response.text:
            cleaned_text = response.text.strip()
            raw_recs = json.loads(cleaned_text)
            recs = [Recommendation(**rec) for rec in raw_recs]
            logger.info("Vertex AI Gemini successfully generated insights.")
            return InsightsResponse(
                device_id=log.device_id,
                user_id=log.user_id,
                recommendations=recs,
                generated_by=f"Vertex AI ({settings.GEMINI_MODEL})",
                timestamp=datetime.utcnow()
            )
        else:
            raise Exception("Empty response from model.")
    except Exception as e:
        logger.error(f"Vertex AI generation failed: {e}. Falling back to Rule-Engine.")
        recs = generate_fallback_recommendations(log)
        return InsightsResponse(
            device_id=log.device_id,
            user_id=log.user_id,
            recommendations=recs,
            generated_by="Fallback Rule-Engine",
            timestamp=datetime.utcnow()
        )


# --- INTERACTIVE CHAT ASSISTANT ---
def sustainability_chat(query: str, last_log: Optional[EmissionLogResponse] = None) -> str:
    """Provides a natural language sustainability Q&A console, using the user's latest logs as prompt context."""
    client = get_gemini_client()

    # Formulate context based on latest log data
    context = ""
    if last_log:
        context = f"""
        USER PROFILE CONTEXT:
        - Daily Water: {last_log.water_liters} Litres (Rating: {last_log.water_impact})
        - Daily Waste: {last_log.waste_kg} kg (Rating: {last_log.waste_impact})
        - Daily Energy: {last_log.electricity_kwh} kWh (Rating: {last_log.energy_impact})
        - Commute distance: {last_log.commute_km} km via {last_log.commute_type} (Rating: {last_log.mobility_impact})
        - Total Daily Carbon: {last_log.total_co2_kg:.2f} kg CO2e
        """
    else:
        context = "USER PROFILE CONTEXT: No metrics logged yet. Treat the user as having global baseline average resource usage."

    # MOCK MODE Fallback Chat Advisor
    if settings.MOCK_MODE or client is None:
        q_lower = query.lower()
        logger.info(f"[MOCK CHAT] Answering query: '{query}'")
        
        if "water" in q_lower or "shower" in q_lower or "tap" in q_lower:
            return "Based on your water usage, my advice is to prioritize installing high-efficiency aerators. Doing so reduces faucet flow by up to 30%. Also, aim to keep showers under 5 minutes to conserve ~40L of heated water daily."
        elif "waste" in q_lower or "plastic" in q_lower or "compost" in q_lower:
            return "To address your waste footprint, establish an organic kitchen composting bin. Composting redirects food scraps from landfills, eliminating methane emissions. Also, opt for package-free dry goods in bulk using your own containers."
        elif "energy" in q_lower or "electricity" in q_lower or "bulb" in q_lower or "light" in q_lower:
            return "Looking at your energy numbers, focus on isolating 'vampire' standby loads (e.g. televisions, routers) using smart power strips. Transitioning remaining halogen bulbs to smart LEDs can also cut lighting energy by 80%."
        elif "commute" in q_lower or "car" in q_lower or "petrol" in q_lower or "transit" in q_lower:
            return "For transportation, your petrol vehicle is a major carbon driver. Replacing short trips under 3km with walking or e-biking, and combining work commutes through carpooling two days a week, will dramatically drop your mobility emissions."
        elif "biggest" in q_lower or "highest" in q_lower or "footprint" in q_lower or "co2" in q_lower:
            if last_log:
                highest_cat = "Energy"
                highest_val = last_log.co2_electricity_kg
                if last_log.co2_commute_kg > highest_val:
                    highest_cat = "Mobility"
                    highest_val = last_log.co2_commute_kg
                if last_log.co2_waste_kg > highest_val:
                    highest_cat = "Waste"
                    highest_val = last_log.co2_waste_kg
                if last_log.co2_water_kg > highest_val:
                    highest_cat = "Water"
                    highest_val = last_log.co2_water_kg
                return f"Analyzing your logs, your highest daily emission source is {highest_cat} contributing {highest_val:.2f} kg CO2e. Focus on targeting this category first for maximum reduction impact."
            return "Without logged data, electricity and vehicle commuting are generally the highest household carbon drivers. Log your intake details in the panel so I can identify your specific top source!"
        else:
            return "Glad you asked! Conserving resources starts with minor daily habit changes. Log your daily consumption inputs, set specific weekly targets in the Goals tab, and try to lower your water and waste levels below global baselines."

    # Live Vertex AI Gemini Chat
    system_prompt = f"""
    You are EcoCoach, an expert AI sustainability advisor.
    Provide actionable, customized, and encouraging advice to help the user reduce their ecological footprint.
    
    {context}
    
    Answer the user's question concisely (under 120 words), making references to their specific logged metrics if relevant. 
    Be direct, positive, and suggest specific habit changes or eco-friendly technologies.
    """
    
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[system_prompt, f"User Question: {query}"],
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=300,
            )
        )
        if response.text:
            return response.text.strip()
        return "Sorry, I am unable to formulate an answer right now. Please try again."
    except Exception as e:
        logger.error(f"Vertex AI Chat generation failed: {e}")
        return "I encountered an error verifying the AI service. Running fallback advisory connection."
