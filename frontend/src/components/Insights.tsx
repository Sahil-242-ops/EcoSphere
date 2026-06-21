import React from 'react';
import { useEcoSphereStore } from '../store';

export const Insights: React.FC = () => {
  const { insights, loadingInsights, history } = useEcoSphereStore();

  if (loadingInsights) {
    return (
      <div className="card spinner-container" aria-busy="true" aria-label="Analyzing emissions profiles">
        <div className="spinner"></div>
        <p>Vertex AI Gemini is auditing your logs and generating custom savings plans...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return null; // Don't show recommendations before first log is submitted
  }

  if (!insights || insights.recommendations.length === 0) {
    return (
      <section className="card">
        <h3>AI Recommendation Engine Offline</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Unable to generate sustainability tasks. Please verify your connection.
        </p>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="insights-title" style={{ marginTop: '24px' }}>
      <div className="insights-header">
        <h2 id="insights-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
          Gemini AI Tailored Guidance
        </h2>
        <span className="engine-tag" aria-label={`Insight source: ${insights.generated_by}`}>
          {insights.generated_by}
        </span>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
        Based on your resource consumption profile, our Vertex AI model has generated 4 highly focused, quantified tasks to help you optimize:
      </p>

      <div className="recs-grid">
        {insights.recommendations.map((rec, index) => (
          <article className="rec-card" key={index} aria-labelledby={`rec-title-${index}`}>
            <div>
              <div className={`rec-category ${rec.category}`} id={`rec-title-${index}`}>
                {rec.category === 'Water' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                  </svg>
                )}
                {rec.category === 'Waste' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                )}
                {rec.category === 'Energy' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                )}
                {rec.category === 'Mobility' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="5" width="14" height="14" rx="2" ry="2"/>
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                )}
                {rec.category}
              </div>
              <p className="rec-action" style={{ marginTop: '10px' }}>{rec.action}</p>
            </div>

            <div className="rec-footer">
              <span className="rec-saving" aria-label={`Estimated weekly savings: ${rec.saving_estimate}`}>
                {rec.saving_estimate}
              </span>
              <span className="rec-difficulty">
                <span className={`difficulty-badge ${rec.difficulty}`} aria-hidden="true"></span>
                {rec.difficulty}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
