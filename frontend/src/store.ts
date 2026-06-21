import { create } from 'zustand';

// Types corresponding to Backend models
export interface EmissionLog {
  log_id: string;
  timestamp: string;
  device_id: string;
  user_id?: string;
  water_liters: number;
  waste_kg: number;
  electricity_kwh: number;
  commute_km: number;
  commute_type: string;
  co2_water_kg: number;
  co2_waste_kg: number;
  co2_electricity_kg: number;
  co2_commute_kg: number;
  total_co2_kg: number;
  water_impact: 'Low' | 'Medium' | 'High';
  waste_impact: 'Low' | 'Medium' | 'High';
  energy_impact: 'Low' | 'Medium' | 'High';
  mobility_impact: 'Low' | 'Medium' | 'High';
}

export interface Recommendation {
  category: string;
  action: string;
  saving_estimate: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface Insights {
  device_id: string;
  user_id?: string;
  recommendations: Recommendation[];
  generated_by: string;
  timestamp: string;
}

export interface Averages {
  co2: number;
  water: number;
  waste: number;
  electricity: number;
  commute: number;
}

export interface Stats {
  user_logs_count: number;
  user_averages: Averages;
  global_averages: Averages;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture_url?: string;
  idToken: string;
}

export interface WeeklyGoal {
  user_id: string;
  water_target_pct: number;
  waste_target_pct: number;
  electricity_target_pct: number;
}

export interface ChatMessage {
  sender: 'user' | 'coach';
  text: string;
  timestamp: string;
}

interface EcoSphereState {
  deviceId: string;
  user: User | null;
  history: EmissionLog[];
  insights: Insights | null;
  stats: Stats | null;
  goal: WeeklyGoal | null;
  chatHistory: ChatMessage[];
  
  // Loading status
  loadingHistory: boolean;
  loadingInsights: boolean;
  loadingStats: boolean;
  loadingGoals: boolean;
  savingGoals: boolean;
  submittingLog: boolean;
  sendingChatMessage: boolean;
  error: string | null;
  
  // Actions
  init: () => void;
  loginWithGoogle: (idToken: string) => Promise<boolean>;
  signUpWithEmailPassword: (idToken: string, name: string) => Promise<boolean>;
  signInWithEmailPassword: (idToken: string) => Promise<boolean>;
  mockLogin: () => Promise<void>;
  logout: () => void;
  submitLog: (log: {
    water_liters: number;
    waste_kg: number;
    electricity_kwh: number;
    commute_km: number;
    commute_type: string;
  }) => Promise<boolean>;
  fetchHistory: () => Promise<void>;
  fetchInsights: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchGoal: () => Promise<void>;
  saveGoal: (targets: {
    water_target_pct: number;
    waste_target_pct: number;
    electricity_target_pct: number;
  }) => Promise<boolean>;
  sendChatMessage: (message: string) => Promise<void>;
  clearError: () => void;
}

const BASE_URL = window.location.port === '5173' ? 'http://localhost:8080' : '';

const getOrCreateDeviceId = (): string => {
  let id = localStorage.getItem('ecosphere_device_id');
  if (!id) {
    id = typeof crypto.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('ecosphere_device_id', id);
  }
  return id;
};

export const useEcoSphereStore = create<EcoSphereState>((set, get) => ({
  deviceId: '',
  user: null,
  history: [],
  insights: null,
  stats: null,
  goal: null,
  chatHistory: [
    { sender: 'coach', text: "Hello! I'm your GenAI Sustainability Coach. Ask me how to reduce your footprints or query specific tips about waste, energy, water, or transit.", timestamp: new Date().toISOString() }
  ],
  
  loadingHistory: false,
  loadingInsights: false,
  loadingStats: false,
  loadingGoals: false,
  savingGoals: false,
  submittingLog: false,
  sendingChatMessage: false,
  error: null,
  
  clearError: () => set({ error: null }),
  
  init: () => {
    const id = getOrCreateDeviceId();
    set({ deviceId: id });
    
    // Check for cached login session
    const cachedUser = localStorage.getItem('ecosphere_user');
    if (cachedUser) {
      try {
        set({ user: JSON.parse(cachedUser) });
      } catch (e) {
        localStorage.removeItem('ecosphere_user');
      }
    }
    
    // Fetch initial datasets
    get().fetchHistory();
    get().fetchStats();
    get().fetchInsights();
    
    if (get().user) {
      get().fetchGoal();
    }
  },

  loginWithGoogle: async (idToken: string) => {
    const { deviceId } = get();
    set({ submittingLog: true, error: null }); // Using submittingLog or custom indicator
    try {
      const response = await fetch(`${BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, device_id: deviceId })
      });

      if (!response.ok) {
        throw new Error('Google Authentication handshake failed.');
      }

      const profile = await response.json();
      const userData: User = { ...profile, idToken };

      localStorage.setItem('ecosphere_user', JSON.stringify(userData));
      set({ user: userData, submittingLog: false });

      // Refresh data scope to User ID
      await get().fetchHistory();
      await get().fetchStats();
      await get().fetchInsights();
      await get().fetchGoal();

      return true;
    } catch (err: any) {
      set({ error: err.message || 'Error signing in with Google', submittingLog: false });
      return false;
    }
  },

  signUpWithEmailPassword: async (idToken: string, name: string) => {
    const { deviceId } = get();
    set({ submittingLog: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, device_id: deviceId, name })
      });

      if (!response.ok) {
        throw new Error('Registration profile save failed on server.');
      }

      const profile = await response.json();
      const userData: User = { ...profile, idToken };

      localStorage.setItem('ecosphere_user', JSON.stringify(userData));
      set({ user: userData, submittingLog: false });

      // Refresh data scope to User ID
      await get().fetchHistory();
      await get().fetchStats();
      await get().fetchInsights();
      await get().fetchGoal();

      return true;
    } catch (err: any) {
      set({ error: err.message || 'Error creating profile', submittingLog: false });
      return false;
    }
  },

  signInWithEmailPassword: async (idToken: string) => {
    const { deviceId } = get();
    set({ submittingLog: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, device_id: deviceId })
      });

      if (!response.ok) {
        throw new Error('Login profile validation failed on server.');
      }

      const profile = await response.json();
      const userData: User = { ...profile, idToken };

      localStorage.setItem('ecosphere_user', JSON.stringify(userData));
      set({ user: userData, submittingLog: false });

      // Refresh data scope to User ID
      await get().fetchHistory();
      await get().fetchStats();
      await get().fetchInsights();
      await get().fetchGoal();

      return true;
    } catch (err: any) {
      set({ error: err.message || 'Error verifying profile', submittingLog: false });
      return false;
    }
  },

  mockLogin: async () => {
    // Simulated token payload for local testing
    const mockUid = "mock-firebase-uid-google-" + Math.floor(Math.random() * 100000);
    const mockName = "Google Eco User";
    const mockEmail = "google.eco.tester@gmail.com";
    const mockToken = `mock-token-${mockUid}-email-${mockEmail}-name-${mockName.replace(/ /g, "_")}`;
    await get().loginWithGoogle(mockToken);
  },

  logout: () => {
    import('./firebase').then(({ signOutFirebase }) => {
      signOutFirebase();
    });
    localStorage.removeItem('ecosphere_user');
    set({ user: null, goal: null });
    
    // Refresh history / graphs back to anonymous guest scopes
    get().fetchHistory();
    get().fetchStats();
    get().fetchInsights();
  },
  
  fetchHistory: async () => {
    const { deviceId, user } = get();
    if (!deviceId) return;
    
    set({ loadingHistory: true, error: null });
    try {
      const headers: HeadersInit = {};
      if (user?.idToken) {
        headers['Authorization'] = `Bearer ${user.idToken}`;
      }

      const response = await fetch(`${BASE_URL}/api/history/${deviceId}?limit=10`, { headers });
      if (!response.ok) {
        throw new Error('Failed to retrieve history logs.');
      }
      const data = await response.json();
      set({ history: data, loadingHistory: false });
    } catch (err: any) {
      set({ error: err.message || 'Error loading history', loadingHistory: false });
    }
  },
  
  fetchInsights: async () => {
    const { deviceId, user } = get();
    if (!deviceId) return;
    
    set({ loadingInsights: true, error: null });
    try {
      const headers: HeadersInit = {};
      if (user?.idToken) {
        headers['Authorization'] = `Bearer ${user.idToken}`;
      }

      const response = await fetch(`${BASE_URL}/api/insights?device_id=${deviceId}`, { headers });
      if (!response.ok) {
        throw new Error('Failed to retrieve sustainability insights.');
      }
      const data = await response.json();
      set({ insights: data, loadingInsights: false });
    } catch (err: any) {
      set({ error: err.message || 'Error generating insights', loadingInsights: false });
    }
  },
  
  fetchStats: async () => {
    const { deviceId, user } = get();
    if (!deviceId) return;
    
    set({ loadingStats: true, error: null });
    try {
      const headers: HeadersInit = {};
      if (user?.idToken) {
        headers['Authorization'] = `Bearer ${user.idToken}`;
      }

      const response = await fetch(`${BASE_URL}/api/stats/${deviceId}`, { headers });
      if (!response.ok) {
        throw new Error('Failed to retrieve comparative analytics.');
      }
      const data = await response.json();
      set({ stats: data, loadingStats: false });
    } catch (err: any) {
      set({ error: err.message || 'Error retrieving stats', loadingStats: false });
    }
  },

  fetchGoal: async () => {
    const { user } = get();
    if (!user) return;
    
    set({ loadingGoals: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/api/goals`, {
        headers: { 'Authorization': `Bearer ${user.idToken}` }
      });
      if (!response.ok) {
        throw new Error('Failed to retrieve weekly goals.');
      }
      const data = await response.json();
      set({ goal: data, loadingGoals: false });
    } catch (err: any) {
      set({ error: err.message || 'Error loading goals', loadingGoals: false });
    }
  },

  saveGoal: async (targets) => {
    const { user } = get();
    if (!user) return false;
    
    set({ savingGoals: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/api/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.idToken}`
        },
        body: JSON.stringify({
          user_id: user.user_id,
          ...targets
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save reduction targets.');
      }
      
      const newGoal = await response.json();
      set({ goal: newGoal, savingGoals: false });
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Error saving goals', savingGoals: false });
      return false;
    }
  },
  
  submitLog: async (logInput) => {
    const { deviceId, user } = get();
    if (!deviceId) return false;
    
    set({ submittingLog: true, error: null });
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.idToken) {
        headers['Authorization'] = `Bearer ${user.idToken}`;
      }

      const response = await fetch(`${BASE_URL}/api/submit-log`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          device_id: deviceId,
          user_id: user?.user_id || null,
          ...logInput,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save log.');
      }
      
      const newLog = await response.json();
      
      set((state) => ({
        history: [newLog, ...state.history].slice(0, 10),
        submittingLog: false,
      }));
      
      get().fetchStats();
      get().fetchInsights();
      
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Error logging carbon entries', submittingLog: false });
      return false;
    }
  },

  sendChatMessage: async (message) => {
    const { deviceId, user } = get();
    const newUserMsg: ChatMessage = { sender: 'user', text: message, timestamp: new Date().toISOString() };
    
    // Add user message to local state immediately for fast response
    set((state) => ({
      chatHistory: [...state.chatHistory, newUserMsg],
      sendingChatMessage: true,
      error: null
    }));

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.idToken) {
        headers['Authorization'] = `Bearer ${user.idToken}`;
      }

      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          device_id: deviceId
        })
      });

      if (!response.ok) {
        throw new Error('Sustainability coach connection lost.');
      }

      const data = await response.json();
      const coachMsg: ChatMessage = { sender: 'coach', text: data.reply, timestamp: data.timestamp };

      set((state) => ({
        chatHistory: [...state.chatHistory, coachMsg],
        sendingChatMessage: false
      }));
    } catch (err: any) {
      const errorMsg: ChatMessage = { sender: 'coach', text: `Error: ${err.message || 'Unable to connect to advisory service.'}`, timestamp: new Date().toISOString() };
      set((state) => ({
        chatHistory: [...state.chatHistory, errorMsg],
        sendingChatMessage: false
      }));
    }
  }
}));
