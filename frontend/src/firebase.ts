import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBYLzRiV-k9fcWpQl2Z2VRggeMTWVTuiHo",
  authDomain: "ecosphere-49b7f.firebaseapp.com",
  projectId: "ecosphere-49b7f",
  storageBucket: "ecosphere-49b7f.firebasestorage.app",
  messagingSenderId: "540986901943",
  appId: "1:540986901943:web:52ce04d1d4061ea0195432",
  measurementId: "G-NDNJ6SHVSH"
};

// Check if configuration is active
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.authDomain);

let firebaseAuth: any = null;
let firebaseAnalytics: any = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firebaseAuth = getAuth(app);
    if (typeof window !== "undefined") {
      firebaseAnalytics = getAnalytics(app);
    }
    console.log("[Firebase] SDK initialized successfully with live config.");
  } catch (error) {
    console.warn("[Firebase] Initialization error, falling back to simulation:", error);
    firebaseAuth = null;
  }
} else {
  console.info("[Firebase] Credentials missing. Running in Simulation (Mock) mode.");
}

export const auth = firebaseAuth;
export const analytics = firebaseAnalytics;

// --- GOOGLE SIGN IN POPUP ---
export const loginWithFirebaseGoogle = async (): Promise<{ idToken: string; user: any }> => {
  if (isFirebaseConfigured && auth) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { idToken, user: result.user };
  } else {
    // Simulated Popup Handshake for Local Offline check
    console.info("[MOCK auth] Opening simulated Google Sign-in popup...");
    const mockUid = "mock-firebase-uid-google-" + Math.floor(Math.random() * 100000);
    const mockName = "Google Eco User";
    const mockEmail = "google.eco.tester@gmail.com";
    const mockToken = `mock-token-${mockUid}-email-${mockEmail}-name-${mockName.replace(/ /g, "_")}`;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          idToken: mockToken,
          user: {
            uid: mockUid,
            email: mockEmail,
            displayName: mockName,
            photoURL: "https://lh3.googleusercontent.com/a/default-user=s96-c"
          }
        });
      }, 800);
    });
  }
};

// --- EMAIL/PASSWORD SIGN UP ---
export const signUpWithFirebaseEmailPassword = async (name: string, email: string, password: string): Promise<{ idToken: string; user: any }> => {
  if (isFirebaseConfigured && auth) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    const idToken = await result.user.getIdToken();
    return { idToken, user: result.user };
  } else {
    console.info("[MOCK auth] Registering email/password in simulated database...");
    const mockUid = "mock-firebase-uid-email-" + Math.floor(Math.random() * 100000);
    const mockToken = `mock-token-${mockUid}-email-${email}-name-${name.replace(/ /g, "_")}`;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          idToken: mockToken,
          user: {
            uid: mockUid,
            email: email,
            displayName: name,
            photoURL: null
          }
        });
      }, 1000);
    });
  }
};

// --- EMAIL/PASSWORD SIGN IN ---
export const signInWithFirebaseEmailPassword = async (email: string, password: string): Promise<{ idToken: string; user: any }> => {
  if (isFirebaseConfigured && auth) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken();
    return { idToken, user: result.user };
  } else {
    console.info("[MOCK auth] Logging in email/password in simulated database...");
    const mockUid = "mock-firebase-uid-email-12345";
    const mockName = "Eco Tester";
    const mockToken = `mock-token-${mockUid}-email-${email}-name-${mockName.replace(/ /g, "_")}`;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          idToken: mockToken,
          user: {
            uid: mockUid,
            email: email,
            displayName: mockName,
            photoURL: null
          }
        });
      }, 800);
    });
  }
};

// --- PASSWORD RESET EMAIL ---
export const sendFirebasePasswordReset = async (email: string): Promise<boolean> => {
  if (isFirebaseConfigured && auth) {
    await sendPasswordResetEmail(auth, email);
    return true;
  } else {
    console.info(`[MOCK auth] Simulated password reset link sent to: ${email}`);
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 500);
    });
  }
};

// --- LOGOUT ---
export const signOutFirebase = async (): Promise<void> => {
  if (isFirebaseConfigured && auth) {
    await signOut(auth);
  } else {
    console.info("[MOCK auth] Signed out simulated session.");
  }
};
