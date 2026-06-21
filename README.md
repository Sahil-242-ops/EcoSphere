# EcoSphere - Personal Ecological Footprint & GenAI Advisory

EcoSphere is a production-grade, privacy-first web application designed to help individuals **Understand ➔ Track ➔ Optimize** their ecological resource footprints. The platform monitors water consumption, waste generation, electricity usage, and daily commutes, calculating carbon equivalents in real-time. It streams telemetry events to Google Cloud BigQuery and leverages Google Vertex AI (Gemini 1.5 Flash) to generate personalized, context-aware sustainability recommendations.

---

## 🚀 Key Features

- **Modern Glassmorphic UI**: Premium, high-performance responsive layout with smooth micro-animations.
- **Robust Authentication**: Mapped using **Firebase Authentication** supporting standard Email/Password (Sign-Up, Sign-In, Password Reset) and Google Sign-In Popup.
- **Vertex AI Sustainability Coach**: Context-aware interactive assistant providing tailored carbon offset advice.
- **Telemetry Event Streaming**: Tracks and stores consumption benchmarks via SQLite (local fallback) and Google BigQuery.
- **Zero-Config Resiliency**: Fully automated offline fallback mode. Runs out of the box with zero credentials using local simulation engines.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Zustand (State Management), Recharts (Visualization), Vanilla CSS.
- **Backend**: Python 3.13, FastAPI (API endpoints), Pydantic v2 (Data Validation), SlowAPI (Rate-limiting), SQLite.
- **Firebase Products**: Firebase Authentication, Firebase Analytics.
- **Google Cloud Platform**: Firestore (NoSQL store), Pub/Sub (Event streaming), BigQuery (Data warehouse), Secret Manager (Secret vault).

---

## 📐 Database Schema Configuration

When a user logs in, their profile is cached in the local SQLite database (`backend/ecosphere_local.db`). The schema maps directly to their Firebase Unique ID:

```sql
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,       -- Mapped to firebase_uid
    firebase_uid TEXT UNIQUE,       -- Mapped to Firebase user.uid
    email TEXT,                     -- User registration email
    name TEXT,                      -- User display name
    picture_url TEXT,               -- User Google profile image
    created_at TEXT                 -- Timestamp of registration
);

CREATE TABLE IF NOT EXISTS goals (
    user_id TEXT PRIMARY KEY,       -- Mapped to users.user_id
    water_target_pct REAL,          -- Target reduction % (default 10.0)
    waste_target_pct REAL,
    electricity_target_pct REAL,
    updated_at TEXT
);
```

---

## 🌐 Resiliency & Local Mock Fallback Layer

To facilitate seamless local development without configuring active GCP accounts, the application implements a fully-featured local fallback layer:

| Cloud Service | Live Mode Behavior | Local Fallback Behavior |
| :--- | :--- | :--- |
| **Firebase Auth** | Authenticates users against the Firebase project | Local simulation mode (returns mock tokens) |
| **Firebase Admin** | Validates ID tokens cryptographically via SDK | Decodes token payloads securely + supports test tokens |
| **Vertex AI** | Consults Gemini 1.5 Flash via API | Local deterministic rule engine returning recommendations |
| **Firestore** | Persists user telemetry in NoSQL Collections | Persists to local SQLite tables (`emissions`) |
| **BigQuery** | Streams data into analytical tables | Appends logs to local SQLite (`bigquery_analytics`) & CSV |
| **Pub/Sub** | Dispatches real-time telemetry events | Distributes events to an in-memory Pub/Sub dispatcher |

---

## ⚙️ Authentication Configuration

### 1. Frontend Web Configuration
The frontend configuration is located in [firebase.ts](file:///d:/Carbon%20Footprint/frontend/src/firebase.ts). It is pre-configured with the live project credentials:
```typescript
const firebaseConfig = {
  apiKey: "AIzaSyBYLzRiV-k9fcWpQl2Z2VRggeMTWVTuiHo",
  authDomain: "ecosphere-49b7f.firebaseapp.com",
  projectId: "ecosphere-49b7f",
  storageBucket: "ecosphere-49b7f.firebasestorage.app",
  messagingSenderId: "540986901943",
  appId: "1:540986901943:web:52ce04d1d4061ea0195432",
  measurementId: "G-NDNJ6SHVSH"
};
```
*Note: If the application fails to connect or if the configuration is removed, it automatically reverts to Local Simulation mode.*

### 2. Backend Credentials
To verify live tokens, the FastAPI backend tries to initialize the Firebase Admin SDK. It checks for service account key credentials at these paths (in order):
1. Environment Variable `GOOGLE_APPLICATION_CREDENTIALS`
2. `backend/serviceAccountKey.json`
3. Root folder `serviceAccountKey.json`
4. `backend/firebase-service-account.json`

**To run with live credentials locally**: Download your Firebase project service account JSON file, name it `serviceAccountKey.json`, and place it in the `backend/` directory.

---

## 💻 Local Development Setup

### Prerequisite Ports
Ensure port `8080` (FastAPI backend) and port `5173` (Vite dev server) are free.

### Step 1: Run the Backend Server
```bash
# 1. Navigate to the backend directory
cd backend

# 2. Activate the virtual environment
.venv\Scripts\activate

# 3. Launch the FastAPI server
uvicorn main:app --port 8080 --reload
```
- API Docs will be available at: http://localhost:8080/docs

### Step 2: Run the Frontend App
```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Boot up the Vite developer server
npm run dev
```
- The application UI will be running at: http://localhost:5173

---

## 🐳 Production Compilation & Container Build

To build and compile both layers into a single deployable artifact (using the project `Dockerfile`):

```bash
# 1. Build production React assets
cd frontend
npm run build

# 2. Deploy compiled assets to the backend serving static folder
xcopy /E /I /Y dist ..\backend\static

# 3. Start the unified FastAPI instance
cd ../backend
uvicorn main:app --port 8080
```
- Your unified application (both APIs and Web pages) will serve from: http://localhost:8080
