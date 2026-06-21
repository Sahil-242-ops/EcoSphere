import React, { useState, useEffect } from 'react';
import { useEcoSphereStore } from '../store';

export const GoalsPanel: React.FC = () => {
  const { goal, history, stats, saveGoal, savingGoals, loadingGoals, user } = useEcoSphereStore();

  // Slider target states
  const [waterTarget, setWaterTarget] = useState<number>(10);
  const [wasteTarget, setWasteTarget] = useState<number>(10);
  const [elecTarget, setElecTarget] = useState<number>(10);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Sync targets with fetched goals
  useEffect(() => {
    if (goal) {
      setWaterTarget(goal.water_target_pct);
      setWasteTarget(goal.waste_target_pct);
      setElectricityTarget(goal.electricity_target_pct);
    }
  }, [goal]);

  // Rename setter helper to prevent naming conflicts
  const setElectricityTarget = (val: number) => setElecTarget(val);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(false);
    
    const success = await saveGoal({
      water_target_pct: waterTarget,
      waste_target_pct: wasteTarget,
      electricity_target_pct: elecTarget
    });

    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  if (!user) {
    return (
      <section className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }} aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h3>Goal Setting is Locked</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '380px' }}>
          Please sign in with Google or run Simulated Login in the header to set custom weekly reduction goals and track ecological badges achievements.
        </p>
      </section>
    );
  }

  if (loadingGoals) {
    return (
      <div className="card spinner-container" aria-busy="true" aria-label="Loading goals">
        <div className="spinner"></div>
        <p>Retrieving your weekly targets...</p>
      </div>
    );
  }

  // --- DYNAMIC BADGES CALCULATION ---
  const latestLog = history.length > 0 ? history[0] : null;
  const userAvgCo2 = stats?.user_averages.co2 || 0.0;
  const globalAvgCo2 = stats?.global_averages.co2 || 15.0;
  const totalLogs = stats?.user_logs_count || 0;

  // 1. Water Warrior: Latest water usage is 100L or less
  const waterWarrior = latestLog ? latestLog.water_liters <= 100 : false;
  
  // 2. Carbon Cutter: User averages carbon below global baseline averages
  const carbonCutter = totalLogs > 0 && userAvgCo2 < globalAvgCo2;

  // 3. Transit Star: Commuted using public transit or walk/biking in history
  const transitStar = history.some(log => log.commute_type === 'transit' || log.commute_type === 'bike_walk');

  // 4. Eco Streak: Submitted logs at least 3 times
  const ecoStreak = totalLogs >= 3;

  return (
    <div className="dashboard-panel">
      {/* Target Settings Card */}
      <section className="card" aria-labelledby="goals-title">
        <h3 id="goals-title" className="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          Set Footprint Reduction Goals
        </h3>

        <form onSubmit={handleSave}>
          {savedSuccess && (
            <div className="error-message" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34d399' }} role="status">
              Weekly reduction targets saved!
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
            {/* Water Target */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                <label htmlFor="water-range">Water Reduction Target</label>
                <span style={{ fontWeight: 'bold', color: 'var(--color-blue)' }}>{waterTarget}%</span>
              </div>
              <input
                id="water-range"
                type="range"
                min="0"
                max="50"
                value={waterTarget}
                onChange={(e) => setWaterTarget(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-blue)', cursor: 'pointer' }}
                disabled={savingGoals}
              />
            </div>

            {/* Waste Target */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                <label htmlFor="waste-range">Waste Reduction Target</label>
                <span style={{ fontWeight: 'bold', color: '#c084fc' }}>{wasteTarget}%</span>
              </div>
              <input
                id="waste-range"
                type="range"
                min="0"
                max="50"
                value={wasteTarget}
                onChange={(e) => setWasteTarget(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#c084fc', cursor: 'pointer' }}
                disabled={savingGoals}
              />
            </div>

            {/* Electricity Target */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                <label htmlFor="elec-range">Electricity Reduction Target</label>
                <span style={{ fontWeight: 'bold', color: 'var(--color-orange)' }}>{elecTarget}%</span>
              </div>
              <input
                id="elec-range"
                type="range"
                min="0"
                max="50"
                value={elecTarget}
                onChange={(e) => setElectricityTarget(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-orange)', cursor: 'pointer' }}
                disabled={savingGoals}
              />
            </div>
          </div>

          <button type="submit" className="btn" disabled={savingGoals}>
            {savingGoals ? 'Saving Targets...' : 'Save Goal Targets'}
          </button>
        </form>
      </section>

      {/* Badges Achievements Card */}
      <section className="card" aria-labelledby="badges-title">
        <h3 id="badges-title" className="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          Footprint Badges & Achievements
        </h3>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Improve your habits and register logs to unlock exclusive achievements.
        </p>

        <div className="recs-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          
          {/* Badge 1: Water Warrior */}
          <article 
            className="rec-card" 
            style={{ 
              opacity: waterWarrior ? 1 : 0.45, 
              background: waterWarrior ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.01)',
              borderColor: waterWarrior ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-color)',
              textAlign: 'center',
              alignItems: 'center'
            }}
          >
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '50%', background: waterWarrior ? 'var(--color-blue)' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', marginBottom: '12px'
            }}>
              💧
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>Water Warrior</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Logged direct daily water consumption ≤ 100 Liters.
            </p>
            <div style={{ marginTop: '12px', fontSize: '0.75rem', fontWeight: 'bold', color: waterWarrior ? '#60a5fa' : 'var(--text-muted)' }}>
              {waterWarrior ? '🔓 Unlocked' : '🔒 Locked'}
            </div>
          </article>

          {/* Badge 2: Carbon Cutter */}
          <article 
            className="rec-card" 
            style={{ 
              opacity: carbonCutter ? 1 : 0.45, 
              background: carbonCutter ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255,255,255,0.01)',
              borderColor: carbonCutter ? 'rgba(6, 182, 212, 0.3)' : 'var(--border-color)',
              textAlign: 'center',
              alignItems: 'center'
            }}
          >
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '50%', background: carbonCutter ? '#06b6d4' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', marginBottom: '12px'
            }}>
              ✂️
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>Carbon Cutter</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Your average footprint is lower than the global community average.
            </p>
            <div style={{ marginTop: '12px', fontSize: '0.75rem', fontWeight: 'bold', color: carbonCutter ? '#22d3ee' : 'var(--text-muted)' }}>
              {carbonCutter ? '🔓 Unlocked' : '🔒 Locked'}
            </div>
          </article>

          {/* Badge 3: Transit Star */}
          <article 
            className="rec-card" 
            style={{ 
              opacity: transitStar ? 1 : 0.45, 
              background: transitStar ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.01)',
              borderColor: transitStar ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)',
              textAlign: 'center',
              alignItems: 'center'
            }}
          >
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '50%', background: transitStar ? 'var(--color-emerald)' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', marginBottom: '12px'
            }}>
              🚲
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>Transit Star</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Logged a commute using public transit, biking, or walking.
            </p>
            <div style={{ marginTop: '12px', fontSize: '0.75rem', fontWeight: 'bold', color: transitStar ? '#34d399' : 'var(--text-muted)' }}>
              {transitStar ? '🔓 Unlocked' : '🔒 Locked'}
            </div>
          </article>

          {/* Badge 4: Eco Logger */}
          <article 
            className="rec-card" 
            style={{ 
              opacity: ecoStreak ? 1 : 0.45, 
              background: ecoStreak ? 'rgba(192, 132, 252, 0.08)' : 'rgba(255,255,255,0.01)',
              borderColor: ecoStreak ? 'rgba(192, 132, 252, 0.3)' : 'var(--border-color)',
              textAlign: 'center',
              alignItems: 'center'
            }}
          >
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '50%', background: ecoStreak ? '#a855f7' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', marginBottom: '12px'
            }}>
              🔥
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>Eco Logger</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Recorded resource logs on 3 or more separate occasions.
            </p>
            <div style={{ marginTop: '12px', fontSize: '0.75rem', fontWeight: 'bold', color: ecoStreak ? '#c084fc' : 'var(--text-muted)' }}>
              {ecoStreak ? '🔓 Unlocked' : '🔒 Locked'}
            </div>
          </article>

        </div>
      </section>
    </div>
  );
};
