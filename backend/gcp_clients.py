import os
import json
import sqlite3
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
from backend.config import settings
from backend.models import EmissionLogResponse, UserProfile, WeeklyGoal

# Try importing Google Cloud SDK libraries
# If they are not installed or fail to load, we handle it gracefully via MOCK mode.
GCP_LIBS_AVAILABLE = True
try:
    from google.cloud import firestore
    from google.cloud import pubsub_v1
    from google.cloud import bigquery
    from google.cloud import secretmanager
    from google.oauth2 import service_account
except ImportError:
    GCP_LIBS_AVAILABLE = False

_backend_dir = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(_backend_dir, "ecosphere_local.db")
BQ_MOCK_FILE = os.path.join(_backend_dir, "bigquery_mock_analytics.csv")

# Global flags for active modes
is_mock = settings.MOCK_MODE or not GCP_LIBS_AVAILABLE

# Setup Local SQLite database for fallback storage
def init_local_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Table for Firestore fallback: Emissions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emissions (
            log_id TEXT PRIMARY KEY,
            timestamp TEXT,
            device_id TEXT,
            user_id TEXT,
            water_liters REAL,
            waste_kg REAL,
            electricity_kwh REAL,
            commute_km REAL,
            commute_type TEXT,
            co2_water_kg REAL,
            co2_waste_kg REAL,
            co2_electricity_kg REAL,
            co2_commute_kg REAL,
            total_co2_kg REAL,
            water_impact TEXT,
            waste_impact TEXT,
            energy_impact TEXT,
            mobility_impact TEXT
        )
    """)
    
    # Table for BigQuery fallback: Analytics
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bigquery_analytics (
            log_id TEXT PRIMARY KEY,
            timestamp TEXT,
            device_id TEXT,
            user_id TEXT,
            total_co2_kg REAL,
            water_liters REAL,
            waste_kg REAL,
            electricity_kwh REAL,
            commute_km REAL
        )
    """)

    # Table for user profiles
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            firebase_uid TEXT UNIQUE,
            email TEXT,
            name TEXT,
            picture_url TEXT,
            created_at TEXT
        )
    """)

    # Table for weekly goals
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            user_id TEXT PRIMARY KEY,
            water_target_pct REAL,
            waste_target_pct REAL,
            electricity_target_pct REAL,
            updated_at TEXT
        )
    """)
    
    # Handle DB Migrations: Alter existing databases to support user_id column
    try:
        cursor.execute("ALTER TABLE emissions ADD COLUMN user_id TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
        
    try:
        cursor.execute("ALTER TABLE bigquery_analytics ADD COLUMN user_id TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN firebase_uid TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
        
    conn.commit()
    conn.close()

# Initialize the database immediately
init_local_db()


# Initialize GCP client structures or None if in mock mode
firestore_client = None
pubsub_publisher = None
bigquery_client = None
secret_client = None

if not is_mock:
    try:
        # Resolve credentials if specified
        cred = None
        if settings.GCP_CREDENTIALS_PATH and os.path.exists(settings.GCP_CREDENTIALS_PATH):
            cred = service_account.Credentials.from_service_account_file(settings.GCP_CREDENTIALS_PATH)
            
        firestore_client = firestore.Client(
            project=settings.GCP_PROJECT_ID,
            database=settings.FIRESTORE_DATABASE,
            credentials=cred
        )
        pubsub_publisher = pubsub_v1.PublisherClient(credentials=cred)
        bigquery_client = bigquery.Client(
            project=settings.GCP_PROJECT_ID,
            credentials=cred
        )
        secret_client = secretmanager.SecretManagerServiceClient(credentials=cred)
        print("[INFO] Real Google Cloud Clients Initialized.")
    except Exception as e:
        print(f"[WARNING] Failed to initialize real GCP clients: {e}. Falling back to MOCK mode.")
        is_mock = True

# --- SECRET MANAGER ---
def get_secret(secret_id: str) -> Optional[str]:
    """Retrieves a secret from GCP Secret Manager, falling back to local environment variables."""
    if is_mock or secret_client is None:
        return os.getenv(secret_id)
    try:
        name = f"projects/{settings.GCP_PROJECT_ID}/secrets/{secret_id}/versions/latest"
        response = secret_client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        print(f"[WARNING] Secret Manager fetch failed for {secret_id}: {e}. Trying local environment.")
        return os.getenv(secret_id)


# --- USER PROFILES ---
def save_user_profile(user: UserProfile) -> bool:
    """Saves user profile cache in Firestore or local SQLite."""
    user_data = user.model_dump()
    user_data["created_at"] = user_data["created_at"].isoformat()
    
    if is_mock or firestore_client is None:
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO users (user_id, firebase_uid, email, name, picture_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user.user_id, user.firebase_uid, user.email, user.name, user.picture_url, user_data["created_at"]))
            conn.commit()
            conn.close()
            print(f"[MOCK] User profile saved in SQLite: {user.email}")
            return True
        except Exception as e:
            print(f"[ERROR] Mock user save failed: {e}")
            return False
            
    try:
        doc_ref = firestore_client.collection("users").document(user.user_id)
        doc_ref.set(user_data)
        print(f"[FIRESTORE] Saved user profile: {user.email}")
        return True
    except Exception as e:
        print(f"[ERROR] Firestore user save failed: {e}")
        return False


# --- WEEKLY GOALS ---
def save_weekly_goal(goal: WeeklyGoal) -> bool:
    """Saves or updates userweekly footprint targets."""
    goal_data = goal.model_dump()
    goal_data["updated_at"] = goal_data["updated_at"].isoformat()
    
    if is_mock or firestore_client is None:
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO goals (user_id, water_target_pct, waste_target_pct, electricity_target_pct, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (goal.user_id, goal.water_target_pct, goal.waste_target_pct, goal.electricity_target_pct, goal_data["updated_at"]))
            conn.commit()
            conn.close()
            print(f"[MOCK] Saved weekly goal for user: {goal.user_id}")
            return True
        except Exception as e:
            print(f"[ERROR] Mock goal save failed: {e}")
            return False
            
    try:
        doc_ref = firestore_client.collection("goals").document(goal.user_id)
        doc_ref.set(goal_data)
        print(f"[FIRESTORE] Saved goal for user: {goal.user_id}")
        return True
    except Exception as e:
        print(f"[ERROR] Firestore goal save failed: {e}")
        return False

def get_weekly_goal(user_id: str) -> Optional[WeeklyGoal]:
    """Retrieves weekly reduction targets for user."""
    if is_mock or firestore_client is None:
        try:
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM goals WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                r = dict(row)
                return WeeklyGoal(
                    user_id=r["user_id"],
                    water_target_pct=r["water_target_pct"],
                    waste_target_pct=r["waste_target_pct"],
                    electricity_target_pct=r["electricity_target_pct"],
                    updated_at=datetime.fromisoformat(r["updated_at"])
                )
            return None
        except Exception as e:
            print(f"[ERROR] SQLite goal fetch failed: {e}")
            return None
            
    try:
        doc = firestore_client.collection("goals").document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            if isinstance(data.get("updated_at"), str):
                data["updated_at"] = datetime.fromisoformat(data["updated_at"])
            return WeeklyGoal(**data)
        return None
    except Exception as e:
        print(f"[ERROR] Firestore goal fetch failed: {e}")
        return None


# --- ANONYMOUS LOGS MIGRATION ---
def migrate_anonymous_logs(device_id: str, user_id: str) -> bool:
    """Migrates guest device logs history into user profile upon sign-in."""
    if is_mock or firestore_client is None:
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            # Update emissions logs
            cursor.execute("""
                UPDATE emissions 
                SET user_id = ? 
                WHERE device_id = ? AND (user_id IS NULL OR user_id = '')
            """, (user_id, device_id))
            
            # Update bigquery logs
            cursor.execute("""
                UPDATE bigquery_analytics 
                SET user_id = ? 
                WHERE device_id = ? AND (user_id IS NULL OR user_id = '')
            """, (user_id, device_id))
            
            conn.commit()
            conn.close()
            print(f"[MOCK MIGRATION] Shifted guest logs from device {device_id} to user {user_id}")
            return True
        except Exception as e:
            print(f"[ERROR] SQLite mock migration failed: {e}")
            return False
            
    try:
        # Query logs matching device_id with no user_id
        logs_ref = firestore_client.collection("emissions")
        query = logs_ref.where(filter=firestore.FieldFilter("device_id", "==", device_id))
        docs = list(query.stream())
        
        batch = firestore_client.batch()
        count = 0
        for doc in docs:
            doc_data = doc.to_dict()
            if not doc_data.get("user_id"):
                batch.update(doc.reference, {"user_id": user_id})
                count += 1
                
        if count > 0:
            batch.commit()
            
        print(f"[FIRESTORE MIGRATION] Migrated {count} logs from device {device_id} to user {user_id}")
        return True
    except Exception as e:
        print(f"[ERROR] Firestore migration failed: {e}")
        return False


# --- FIRESTORE EMISSIONS STORAGE ---
def save_emission_log(log: EmissionLogResponse) -> bool:
    """Saves emission log to Firestore (production) or SQLite (mock)."""
    log_data = log.model_dump()
    
    if is_mock or firestore_client is None:
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO emissions (
                    log_id, timestamp, device_id, user_id, water_liters, waste_kg, electricity_kwh, commute_km, commute_type,
                    co2_water_kg, co2_waste_kg, co2_electricity_kg, co2_commute_kg, total_co2_kg,
                    water_impact, waste_impact, energy_impact, mobility_impact
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                log_data["log_id"],
                log_data["timestamp"].isoformat(),
                log_data["device_id"],
                log_data.get("user_id"),
                log_data["water_liters"],
                log_data["waste_kg"],
                log_data["electricity_kwh"],
                log_data["commute_km"],
                log_data["commute_type"],
                log_data["co2_water_kg"],
                log_data["co2_waste_kg"],
                log_data["co2_electricity_kg"],
                log_data["co2_commute_kg"],
                log_data["total_co2_kg"],
                log_data["water_impact"],
                log_data["waste_impact"],
                log_data["energy_impact"],
                log_data["mobility_impact"]
            ))
            conn.commit()
            conn.close()
            print(f"[MOCK] Log saved for owner {log.user_id or log.device_id}")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to save log in SQLite: {e}")
            return False
            
    try:
        doc_ref = firestore_client.collection("emissions").document(log.log_id)
        doc_data = log_data.copy()
        doc_data["timestamp"] = doc_data["timestamp"].isoformat()
        doc_ref.set(doc_data)
        print(f"[FIRESTORE] Log saved successfully for doc ID: {log.log_id}")
        return True
    except Exception as e:
        print(f"[ERROR] Firestore write failed: {e}")
        return False

def get_emission_history(owner_id: str, is_user: bool = False, limit: int = 30) -> List[Dict[str, Any]]:
    """Retrieves logs history filtered by Google user_id or device_id."""
    if is_mock or firestore_client is None:
        try:
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            if is_user:
                cursor.execute("""
                    SELECT * FROM emissions 
                    WHERE user_id = ? 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """, (owner_id, limit))
            else:
                cursor.execute("""
                    SELECT * FROM emissions 
                    WHERE device_id = ? AND (user_id IS NULL OR user_id = '')
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """, (owner_id, limit))
                
            rows = cursor.fetchall()
            conn.close()
            
            history = []
            for row in rows:
                item = dict(row)
                item["timestamp"] = datetime.fromisoformat(item["timestamp"])
                history.append(item)
            return history
        except Exception as e:
            print(f"[ERROR] SQLite history fetch failed: {e}")
            return []
            
    try:
        query = firestore_client.collection("emissions")
        if is_user:
            query = query.where(filter=firestore.FieldFilter("user_id", "==", owner_id))
        else:
            query = query.where(filter=firestore.FieldFilter("device_id", "==", owner_id))
            
        query = query.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit)
        
        docs = query.stream()
        history = []
        for doc in docs:
            doc_dict = doc.to_dict()
            if isinstance(doc_dict.get("timestamp"), str):
                doc_dict["timestamp"] = datetime.fromisoformat(doc_dict["timestamp"])
            
            # In Firestore, if checking anonymous device logs, make sure to skip if it belongs to a user now
            if not is_user and doc_dict.get("user_id"):
                continue
                
            history.append(doc_dict)
        return history
    except Exception as e:
        print(f"[ERROR] Firestore history fetch failed: {e}")
        return get_emission_history(owner_id, is_user, limit)


# --- PUB/SUB ---
def publish_log_event(log: EmissionLogResponse) -> bool:
    """Publishes log event to Pub/Sub."""
    event_data = {
        "event_id": log.log_id,
        "event_type": "emission_logged",
        "timestamp": log.timestamp.isoformat(),
        "device_id": log.device_id,
        "user_id": log.user_id,
        "total_co2_kg": log.total_co2_kg,
        "water_liters": log.water_liters,
        "waste_kg": log.waste_kg,
        "electricity_kwh": log.electricity_kwh,
        "commute_km": log.commute_km
    }
    message_bytes = json.dumps(event_data).encode("utf-8")
    
    if is_mock or pubsub_publisher is None:
        print(f"[MOCK PUB/SUB] Published event to topic '{settings.PUBSUB_TOPIC_ID}': {event_data}")
        stream_to_bigquery(log)
        return True
        
    try:
        topic_path = pubsub_publisher.topic_path(settings.GCP_PROJECT_ID, settings.PUBSUB_TOPIC_ID)
        future = pubsub_publisher.publish(topic_path, message_bytes)
        message_id = future.result(timeout=5.0)
        print(f"[PUB/SUB] Published event {log.log_id}. Message ID: {message_id}")
        return True
    except Exception as e:
        print(f"[ERROR] Pub/Sub publish failed: {e}")
        stream_to_bigquery(log)
        return False


# --- BIGQUERY ---
def stream_to_bigquery(log: EmissionLogResponse) -> bool:
    """Streams consumption event data into BigQuery dataset."""
    row_data = {
        "log_id": log.log_id,
        "timestamp": log.timestamp.isoformat(),
        "device_id": log.device_id,
        "user_id": log.user_id,
        "total_co2_kg": log.total_co2_kg,
        "water_liters": log.water_liters,
        "waste_kg": log.waste_kg,
        "electricity_kwh": log.electricity_kwh,
        "commute_km": log.commute_km
    }
    
    if is_mock or bigquery_client is None:
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO bigquery_analytics (
                    log_id, timestamp, device_id, user_id, total_co2_kg, water_liters, waste_kg, electricity_kwh, commute_km
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row_data["log_id"],
                row_data["timestamp"],
                row_data["device_id"],
                row_data.get("user_id"),
                row_data["total_co2_kg"],
                row_data["water_liters"],
                row_data["waste_kg"],
                row_data["electricity_kwh"],
                row_data["commute_km"]
            ))
            conn.commit()
            conn.close()
            
            # CSV append
            file_exists = os.path.exists(BQ_MOCK_FILE)
            with open(BQ_MOCK_FILE, mode="a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=row_data.keys())
                if not file_exists:
                    writer.writeheader()
                writer.writerow(row_data)
            
            print(f"[MOCK BIGQUERY] Streamed row into local analytics DB & CSV: {row_data['log_id']}")
            return True
        except Exception as e:
            print(f"[ERROR] Mock BigQuery write failed: {e}")
            return False
            
    try:
        table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BIGQUERY_DATASET}.{settings.BIGQUERY_TABLE}"
        errors = bigquery_client.insert_rows_json(table_ref, [row_data])
        if errors:
            print(f"[ERROR] BigQuery stream errors: {errors}")
            return False
        print(f"[BIGQUERY] Row successfully streamed: {table_ref}")
        return True
    except Exception as e:
        print(f"[ERROR] BigQuery write failed: {e}")
        return False


# --- STATISTICS HELPER ---
def _get_sqlite_aggregate_stats(owner_id: str, is_user: bool = False) -> Dict[str, Any]:
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Fetch device totals & averages
        if is_user:
            cursor.execute("""
                SELECT 
                    COUNT(*) as count,
                    AVG(total_co2_kg) as avg_co2,
                    AVG(water_liters) as avg_water,
                    AVG(waste_kg) as avg_waste,
                    AVG(electricity_kwh) as avg_elec,
                    AVG(commute_km) as avg_commute
                FROM bigquery_analytics 
                WHERE user_id = ?
            """, (owner_id,))
        else:
            cursor.execute("""
                SELECT 
                    COUNT(*) as count,
                    AVG(total_co2_kg) as avg_co2,
                    AVG(water_liters) as avg_water,
                    AVG(waste_kg) as avg_waste,
                    AVG(electricity_kwh) as avg_elec,
                    AVG(commute_km) as avg_commute
                FROM bigquery_analytics 
                WHERE device_id = ? AND (user_id IS NULL OR user_id = '')
            """, (owner_id,))
            
        user_row = cursor.fetchone()
        
        # Fetch global averages
        cursor.execute("""
            SELECT 
                AVG(total_co2_kg) as global_co2,
                AVG(water_liters) as global_water,
                AVG(waste_kg) as global_waste,
                AVG(electricity_kwh) as global_elec,
                AVG(commute_km) as global_commute
            FROM bigquery_analytics
        """)
        global_row = cursor.fetchone()
        conn.close()
        
        u_count = user_row[0] or 0
        return {
            "user_logs_count": u_count,
            "user_averages": {
                "co2": user_row[1] or 0.0,
                "water": user_row[2] or 0.0,
                "waste": user_row[3] or 0.0,
                "electricity": user_row[4] or 0.0,
                "commute": user_row[5] or 0.0,
            },
            "global_averages": {
                "co2": global_row[0] or 15.0,
                "water": global_row[1] or 150.0,
                "waste": global_row[2] or 2.5,
                "electricity": global_row[3] or 12.0,
                "commute": global_row[4] or 25.0,
            }
        }
    except Exception as e:
        print(f"[ERROR] SQLite aggregation failed: {e}")
        return {
            "user_logs_count": 0,
            "user_averages": {"co2": 0.0, "water": 0.0, "waste": 0.0, "electricity": 0.0, "commute": 0.0},
            "global_averages": {"co2": 15.0, "water": 150.0, "waste": 2.5, "electricity": 12.0, "commute": 25.0}
        }

def get_aggregate_stats(owner_id: str, is_user: bool = False) -> Dict[str, Any]:
    """Retrieves aggregated statistics for user comparison benchmarks."""
    if is_mock or bigquery_client is None:
        return _get_sqlite_aggregate_stats(owner_id, is_user)
            
    try:
        # Run analytical query in BigQuery
        filter_clause = "user_id = @owner_id" if is_user else "device_id = @owner_id AND user_id IS NULL"
        query_string = f"""
            SELECT 
              (SELECT AS STRUCT COUNT(*), AVG(total_co2_kg), AVG(water_liters), AVG(waste_kg), AVG(electricity_kwh), AVG(commute_km) 
               FROM `{settings.GCP_PROJECT_ID}.{settings.BIGQUERY_DATASET}.{settings.BIGQUERY_TABLE}` WHERE {filter_clause}) as user_stats,
              (SELECT AS STRUCT AVG(total_co2_kg), AVG(water_liters), AVG(waste_kg), AVG(electricity_kwh), AVG(commute_km) 
               FROM `{settings.GCP_PROJECT_ID}.{settings.BIGQUERY_DATASET}.{settings.BIGQUERY_TABLE}`) as global_stats
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("owner_id", "STRING", owner_id)
            ]
        )
        query_job = bigquery_client.query(query_string, job_config=job_config)
        results = list(query_job.result())
        
        row = results[0]
        user_stats = row.get("user_stats", {})
        global_stats = row.get("global_stats", {})
        
        return {
            "user_logs_count": user_stats.get("_f0", 0),
            "user_averages": {
                "co2": user_stats.get("_f1", 0.0),
                "water": user_stats.get("_f2", 0.0),
                "waste": user_stats.get("_f3", 0.0),
                "electricity": user_stats.get("_f4", 0.0),
                "commute": user_stats.get("_f5", 0.0),
            },
            "global_averages": {
                "co2": global_stats.get("_f0", 15.0),
                "water": global_stats.get("_f1", 150.0),
                "waste": global_stats.get("_f2", 2.5),
                "electricity": global_stats.get("_f3", 12.0),
                "commute": global_stats.get("_f4", 25.0),
            }
        }
    except Exception as e:
        print(f"[ERROR] BigQuery analytics failed: {e}. Falling back to SQLite aggregates.")
        return _get_sqlite_aggregate_stats(owner_id, is_user)


def get_user_by_firebase_uid(uid: str) -> Optional[Dict[str, Any]]:
    """Retrieves user profile from SQLite or Firestore by firebase_uid."""
    if is_mock or firestore_client is None:
        try:
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE firebase_uid = ?", (uid,))
            row = cursor.fetchone()
            conn.close()
            if row:
                return dict(row)
            return None
        except Exception as e:
            print(f"[ERROR] SQLite user fetch failed: {e}")
            return None
            
    try:
        doc = firestore_client.collection("users").document(uid).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"[ERROR] Firestore user fetch failed: {e}")
        return None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieves user profile from SQLite or Firestore by email."""
    if is_mock or firestore_client is None:
        try:
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            conn.close()
            if row:
                return dict(row)
            return None
        except Exception as e:
            print(f"[ERROR] SQLite user by email fetch failed: {e}")
            return None
            
    try:
        query = firestore_client.collection("users").where(filter=firestore.FieldFilter("email", "==", email)).limit(1)
        docs = list(query.stream())
        if docs:
            return docs[0].to_dict()
        return None
    except Exception as e:
        print(f"[ERROR] Firestore user by email fetch failed: {e}")
        return None

