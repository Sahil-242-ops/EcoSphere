import React, { useEffect, useState } from 'react';
import { useEcoSphereStore } from './store';
import { Logger } from './components/Logger';
import { Dashboard } from './components/Dashboard';
import { Insights } from './components/Insights';
import { GoalsPanel } from './components/GoalsPanel';
import { ChatAssistant } from './components/ChatAssistant';
import { 
  loginWithFirebaseGoogle, 
  signUpWithFirebaseEmailPassword, 
  signInWithFirebaseEmailPassword, 
  sendFirebasePasswordReset,
  isFirebaseConfigured 
} from './firebase';
import './index.css';

const App: React.FC = () => {
  const { 
    init, 
    user, 
    logout, 
    loginWithGoogle, 
    signUpWithEmailPassword, 
    signInWithEmailPassword, 
    deviceId 
  } = useEcoSphereStore();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'goals' | 'chat'>('dashboard');
  
  // Authentication Modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const result = await loginWithFirebaseGoogle();
      const success = await loginWithGoogle(result.idToken);
      if (success) {
        setIsAuthModalOpen(false);
        setEmail('');
        setPassword('');
        setName('');
      } else {
        setAuthError("Failed to sync profile with the server.");
      }
    } catch (e: any) {
      setAuthError(e.message || "Google login failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (authTab === 'signup') {
        if (!name.trim()) throw new Error("Please enter your name.");
        const result = await signUpWithFirebaseEmailPassword(name, email, password);
        const success = await signUpWithEmailPassword(result.idToken, name);
        if (success) {
          setIsAuthModalOpen(false);
          setEmail('');
          setPassword('');
          setName('');
        }
      } else if (authTab === 'signin') {
        const result = await signInWithFirebaseEmailPassword(email, password);
        const success = await signInWithEmailPassword(result.idToken);
        if (success) {
          setIsAuthModalOpen(false);
          setEmail('');
          setPassword('');
          setName('');
        }
      } else {
        await sendFirebasePasswordReset(email);
        setResetSent(true);
        setTimeout(() => {
          setResetSent(false);
          setAuthTab('signin');
        }, 4000);
      }
    } catch (e: any) {
      setAuthError(e.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* WCAG Accessibility Link */}
      <a href="#active-panel-content" className="skip-link">
        Skip to Active Content Tab
      </a>

      {/* Primary App Header */}
      <header>
        <div className="logo" role="img" aria-label="EcoSphere Logo">
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z" strokeWidth="2.5" />
            <path d="M12 6a6 6 0 0 1 6 6c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6z" strokeWidth="2" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
          <span>EcoSphere</span>
        </div>

        {/* Identity Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="sr-only-mobile" style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{user.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{user.email}</div>
              </div>
              {user.picture_url ? (
                <img 
                  src={user.picture_url} 
                  alt={`${user.name}'s profile`} 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--color-teal)' }}
                />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {user.name.charAt(0)}
                </div>
              )}
              <button 
                onClick={logout} 
                className="btn" 
                style={{ width: 'auto', padding: '6px 14px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)' }}
              >
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => {
                  setAuthError(null);
                  setAuthTab('signin');
                  setIsAuthModalOpen(true);
                }}
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  fontSize: '0.85rem',
                  background: 'var(--grad-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '30px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
                  transition: 'all 0.3s ease',
                  width: 'auto'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
                </svg>
                Sign In / Join
              </button>
              {!isFirebaseConfigured && (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                  (Simulated Mode)
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Tab Controller navigation */}
      <nav style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: '8px', padding: '8px 24px' }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            background: activeTab === 'dashboard' ? 'var(--grad-primary)' : 'transparent',
            color: activeTab === 'dashboard' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 20px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
        >
          Dashboard & Insights
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          style={{
            background: activeTab === 'goals' ? 'var(--grad-primary)' : 'transparent',
            color: activeTab === 'goals' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 20px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
        >
          Weekly Goals & Badges
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            background: activeTab === 'chat' ? 'var(--grad-primary)' : 'transparent',
            color: activeTab === 'chat' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 20px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
        >
          AI Advisor Chat
        </button>
      </nav>

      {/* Page Content Panel grid */}
      <main className="main-content">
        {/* Aside: Logger input is permanently docked on the side to log inputs from any view */}
        <aside aria-label="Logger input panel">
          <Logger />
        </aside>

        {/* Tab display pane */}
        <div id="active-panel-content" tabIndex={-1} style={{ outline: 'none' }}>
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <Dashboard />
              <Insights />
            </div>
          )}
          {activeTab === 'goals' && <GoalsPanel />}
          {activeTab === 'chat' && <ChatAssistant />}
        </div>
      </main>

      {/* Accessible Footer */}
      <footer>
        <p>EcoSphere © 2026. Powered by Google Vertex AI Gemini & Google Cloud.</p>
        {deviceId && (
          <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '4px' }}>
            Anonymous Device Fingerprint ID: {deviceId}
          </p>
        )}
        <p style={{ marginTop: '8px', fontSize: '0.75rem', opacity: 0.7 }}>
          Privacy First: Zero PII captured. Analytics aggregates processed using transient session tokens. WCAG 2.1 AA compliant.
        </p>
      </footer>

      {/* Premium Glassmorphic Authentication Modal */}
      {isAuthModalOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(15, 23, 42, 0.75)', // Deep slate overlay
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            boxSizing: 'border-box'
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <div 
            style={{
              background: 'rgba(30, 41, 59, 0.85)', // Slate 800 with transparency
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '440px',
              padding: '40px 32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setIsAuthModalOpen(false);
                setAuthError(null);
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: 'var(--text-secondary)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              aria-label="Close authentication window"
            >
              ×
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <h2 id="auth-modal-title" style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.025em' }}>
                {authTab === 'signin' && 'Welcome Back'}
                {authTab === 'signup' && 'Create Account'}
                {authTab === 'forgot' && 'Reset Password'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
                {authTab === 'signin' && 'Sign in to monitor and track your goals'}
                {authTab === 'signup' && 'Join EcoSphere and start saving carbon today'}
                {authTab === 'forgot' && 'Enter your email to receive a recovery link'}
              </p>
            </div>

            {/* Tab Selectors (only for login/register modes) */}
            {authTab !== 'forgot' && (
              <div 
                style={{ 
                  display: 'flex', 
                  background: 'rgba(15, 23, 42, 0.4)', 
                  padding: '4px', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}
              >
                <button
                  type="button"
                  onClick={() => { setAuthTab('signin'); setAuthError(null); }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    border: 'none',
                    borderRadius: '8px',
                    background: authTab === 'signin' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: authTab === 'signin' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('signup'); setAuthError(null); }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    border: 'none',
                    borderRadius: '8px',
                    background: authTab === 'signup' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: authTab === 'signup' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Error and Success Indicators */}
            {authError && (
              <div 
                style={{ 
                  background: 'rgba(239, 68, 68, 0.12)', 
                  border: '1px solid rgba(239, 68, 68, 0.2)', 
                  color: '#f87171', 
                  padding: '12px 16px', 
                  borderRadius: '12px',
                  fontSize: '0.85rem'
                }}
                role="alert"
              >
                {authError}
              </div>
            )}

            {resetSent && (
              <div 
                style={{ 
                  background: 'rgba(16, 185, 129, 0.12)', 
                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                  color: '#34d399', 
                  padding: '12px 16px', 
                  borderRadius: '12px',
                  fontSize: '0.85rem'
                }}
                role="status"
              >
                Password reset instructions sent to your email!
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleEmailAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {authTab === 'signup' && (
                <div>
                  <label htmlFor="auth-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Full Name</label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Email Address</label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(15, 23, 42, 0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {authTab !== 'forgot' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label htmlFor="auth-password" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
                    {authTab === 'signin' && (
                      <button
                        type="button"
                        onClick={() => { setAuthTab('forgot'); setAuthError(null); }}
                        style={{ background: 'none', border: 'none', color: 'var(--color-teal)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="btn"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  marginTop: '8px',
                  background: 'var(--grad-primary)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: authLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {authLoading ? 'Processing...' : (
                  authTab === 'signin' ? 'Sign In' : (
                    authTab === 'signup' ? 'Create Account' : 'Send Reset Link'
                  )
                )}
              </button>
            </form>

            {/* OR Separator */}
            {authTab !== 'forgot' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', gap: '10px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
                  <span>OR</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '11px',
                    borderRadius: '12px',
                    background: '#ffffff',
                    color: '#1f2937',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: authLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}

            {/* Back to Sign In Link */}
            {authTab === 'forgot' && (
              <button
                type="button"
                onClick={() => { setAuthTab('signin'); setAuthError(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                ← Back to Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
