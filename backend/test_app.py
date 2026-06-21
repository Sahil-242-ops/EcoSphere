import os
import sys
from fastapi.testclient import TestClient

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

client = TestClient(app)

def test_flow():
    print("\n=== STARTING ECOSPHERE PHASE 2 INTEGRATION TESTS ===\n")
    
    # Clean up test database entries to ensure test runs cleanly every time
    import sqlite3
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ecosphere_local.db")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM users WHERE user_id IN ('test-google-sub-555', 'firebase-uid-email-new')")
            cursor.execute("DELETE FROM goals WHERE user_id IN ('test-google-sub-555', 'firebase-uid-email-new')")
            cursor.execute("DELETE FROM emissions WHERE device_id IN ('test-device-uuid-99999', 'test-device-uuid-new-99999') OR user_id IN ('test-google-sub-555', 'firebase-uid-email-new')")
            cursor.execute("DELETE FROM bigquery_analytics WHERE device_id IN ('test-device-uuid-99999', 'test-device-uuid-new-99999') OR user_id IN ('test-google-sub-555', 'firebase-uid-email-new')")
            conn.commit()
            print("[INFO] Cleaned up existing test entries from database.")
        except Exception as e:
            print(f"[WARNING] Database cleanup failed: {e}")
        finally:
            conn.close()
    
    device_id = "test-device-uuid-99999"
    user_token = "mock-token-test-google-sub-555"
    user_id = "test-google-sub-555"
    
    # 1. Submit a log as a guest first to test anonymous migration later
    print("[TEST] Submitting log as guest...")
    payload_anon = {
        "device_id": device_id,
        "water_liters": 120.0,
        "waste_kg": 2.0,
        "electricity_kwh": 8.0,
        "commute_km": 10.0,
        "commute_type": "transit"
    }
    response_anon = client.post("/api/submit-log", json=payload_anon)
    assert response_anon.status_code == 200
    print("[OK] Guest log submitted successfully.")

    # 2. Test POST /api/auth/google (Verify and create profile, run migration)
    print("[TEST] Authenticating via POST /api/auth/google...")
    auth_payload = {
        "idToken": user_token,
        "device_id": device_id
    }
    response_auth = client.post("/api/auth/google", json=auth_payload)
    if response_auth.status_code != 200:
        print(f"[FAIL] Auth flow failed: {response_auth.text}")
        return False
        
    user_profile = response_auth.json()
    print("[OK] Authentication status 200.")
    assert user_profile["user_id"] == user_id
    assert user_profile["email"] == "sustainability.tester@gmail.com"
    print(f"[OK] Profile created: {user_profile['name']} ({user_profile['email']})")

    # 3. Verify Log Migration: retrieved user history should contain the migrated log
    print("[TEST] Verifying log history migration...")
    response_hist = client.get(
        f"/api/history/{device_id}", 
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response_hist.status_code == 200
    history = response_hist.json()
    print(f"[OK] Retrieved user history size: {len(history)}")
    assert len(history) >= 1
    assert history[0]["user_id"] == user_id
    print(f"[OK] Guest log ownership successfully migrated to user: {history[0]['user_id']}")

    # 3.1 Test POST /api/auth/register (Firebase email/password signup proxy)
    print("[TEST] Registering via POST /api/auth/register...")
    reg_payload = {
        "idToken": "mock-token-firebase-new-uid-email-newuser@gmail.com-name-New_User",
        "device_id": "test-device-uuid-new-99999",
        "name": "New User"
    }
    response_reg = client.post("/api/auth/register", json=reg_payload)
    assert response_reg.status_code == 200
    reg_user = response_reg.json()
    assert reg_user["user_id"] == "firebase-new-uid"
    assert reg_user["email"] == "newuser@gmail.com"
    assert reg_user["name"] == "New User"
    print("[OK] New user registered successfully.")

    # 3.2 Test POST /api/auth/login (Firebase email/password login proxy)
    print("[TEST] Logging in via POST /api/auth/login...")
    login_payload = {
        "idToken": "mock-token-firebase-new-uid-email-newuser@gmail.com-name-New_User",
        "device_id": "test-device-uuid-new-99999"
    }
    response_login = client.post("/api/auth/login", json=login_payload)
    assert response_login.status_code == 200
    login_user = response_login.json()
    assert login_user["user_id"] == "firebase-new-uid"
    print("[OK] Existing user logged in successfully.")

    # 3.3 Test GET /api/auth/me (Current user details)
    print("[TEST] Fetching current user details via GET /api/auth/me...")
    response_me = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer mock-token-firebase-new-uid-email-newuser@gmail.com-name-New_User"}
    )
    assert response_me.status_code == 200
    me = response_me.json()
    assert me["user_id"] == "firebase-new-uid"
    assert me["email"] == "newuser@gmail.com"
    print("[OK] Current user details retrieved successfully.")

    # 4. Test GET & POST /api/goals (Weekly targets management)
    print("[TEST] Fetching default weekly goals...")
    response_goals_get = client.get(
        "/api/goals",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response_goals_get.status_code == 200
    goal = response_goals_get.json()
    assert goal["user_id"] == user_id
    assert goal["water_target_pct"] == 10.0 # Default value
    print("[OK] Default weekly goals fetched.")

    print("[TEST] Saving new weekly goals...")
    goal_payload = {
        "user_id": user_id,
        "water_target_pct": 25.0,
        "waste_target_pct": 15.0,
        "electricity_target_pct": 30.0
    }
    response_goals_post = client.post(
        "/api/goals",
        json=goal_payload,
        headers={"Authorization": f"Bearer {user_token}"}
    )
    if response_goals_post.status_code != 200:
        print(f"[FAIL] Goal save failed: {response_goals_post.text}")
        return False
    saved_goal = response_goals_post.json()
    assert saved_goal["water_target_pct"] == 25.0
    assert saved_goal["electricity_target_pct"] == 30.0
    print("[OK] Updated weekly goals saved successfully.")

    # 5. Test POST /api/chat (Interactive Sustainability Coach)
    print("[TEST] Sending query to /api/chat...")
    chat_payload = {
        "message": "What is my biggest footprint source?",
        "device_id": device_id
    }
    response_chat = client.post(
        "/api/chat",
        json=chat_payload,
        headers={"Authorization": f"Bearer {user_token}"}
    )
    if response_chat.status_code != 200:
        print(f"[FAIL] Chat assistant failed: {response_chat.text}")
        return False
    chat_resp = response_chat.json()
    assert "reply" in chat_resp
    print("[OK] Chat assistant response status 200.")
    print(f"      Coach reply: {chat_resp['reply']}")

    print("\n[SUCCESS] ALL ECOSPHERE PHASE 2 INTEGRATION TESTS PASSED SUCCESSFULLY!\n")
    return True

if __name__ == "__main__":
    success = test_flow()
    sys.exit(0 if success else 1)
