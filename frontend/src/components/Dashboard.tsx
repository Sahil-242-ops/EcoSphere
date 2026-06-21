import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useEcoSphereStore } from '../store';
import type { EmissionLog } from '../store';

export const Dashboard: React.FC = () => {
  const { history, stats, loadingHistory, loadingStats } = useEcoSphereStore();

  if (loadingHistory || loadingStats) {
    return (
      <div className="card spinner-container" aria-busy="true" aria-label="Loading analytics">
        <div className="spinner"></div>
        <p>Crunching BigQuery analytics and loading history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <section className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <h3>No Consumption Logs Registered</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '360px' }}>
          Please submit a daily resource intake in the form to initialize your charts, carbon metrics, and Vertex AI analysis.
        </p>
      </section>
    );
  }

  const latestLog: EmissionLog = history[0];

  // Format historical logs chronologically for area chart
  const chartData = [...history]
    .reverse()
    .map((log) => ({
      date: new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      Water: log.co2_water_kg,
      Waste: log.co2_waste_kg,
      Energy: log.co2_electricity_kg,
      Mobility: log.co2_commute_kg,
      Total: log.total_co2_kg,
      rawWater: log.water_liters,
      rawWaste: log.waste_kg,
      rawEnergy: log.electricity_kwh,
      rawMobility: log.commute_km,
    }));

  // Format BigQuery benchmarking averages
  const benchmarkData = stats ? [
    { name: 'Carbon (kg)', User: stats.user_averages.co2, Global: stats.global_averages.co2 },
    { name: 'Water (L/10)', User: stats.user_averages.water / 10, Global: stats.global_averages.water / 10 },
    { name: 'Waste (kg)', User: stats.user_averages.waste, Global: stats.global_averages.waste },
    { name: 'Energy (kWh)', User: stats.user_averages.electricity, Global: stats.global_averages.electricity },
    { name: 'Mobility (km)', User: stats.user_averages.commute, Global: stats.global_averages.commute },
  ] : [];

  return (
    <div className="dashboard-panel">
      {/* Metric Cards Grid */}
      <section aria-label="Latest footprints summary">
        <div className="metric-grid">
          <div className="metric-card" style={{ gridColumn: 'span 2', background: 'var(--grad-card)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span className="metric-label" style={{ color: '#22d3ee' }}>Total Carbon Impact</span>
            <div className="metric-value" style={{ fontSize: '2.25rem', background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {latestLog.total_co2_kg.toFixed(2)}
            </div>
            <span className="metric-unit">kg CO2e (Equivalent) today</span>
          </div>

          <div className="metric-card water">
            <span className="metric-label">Water Intake</span>
            <div className="metric-value">{latestLog.water_liters}</div>
            <span className="metric-unit">Liters</span>
            <div>
              <span className={`metric-impact ${latestLog.water_impact}`} aria-label={`Water impact rating: ${latestLog.water_impact}`}>
                {latestLog.water_impact}
              </span>
            </div>
          </div>

          <div className="metric-card waste">
            <span className="metric-label">Waste Output</span>
            <div className="metric-value">{latestLog.waste_kg}</div>
            <span className="metric-unit">kg</span>
            <div>
              <span className={`metric-impact ${latestLog.waste_impact}`} aria-label={`Waste impact rating: ${latestLog.waste_impact}`}>
                {latestLog.waste_impact}
              </span>
            </div>
          </div>

          <div className="metric-card energy">
            <span className="metric-label">Grid Energy</span>
            <div className="metric-value">{latestLog.electricity_kwh}</div>
            <span className="metric-unit">kWh</span>
            <div>
              <span className={`metric-impact ${latestLog.energy_impact}`} aria-label={`Energy impact rating: ${latestLog.energy_impact}`}>
                {latestLog.energy_impact}
              </span>
            </div>
          </div>

          <div className="metric-card mobility">
            <span className="metric-label">Mobility</span>
            <div className="metric-value">{latestLog.commute_km}</div>
            <span className="metric-unit">km ({latestLog.commute_type.replace('car_', '')})</span>
            <div>
              <span className={`metric-impact ${latestLog.mobility_impact}`} aria-label={`Mobility impact rating: ${latestLog.mobility_impact}`}>
                {latestLog.mobility_impact}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Historical Stacked Area Chart */}
      <section className="card" aria-labelledby="trend-title">
        <h3 id="trend-title" className="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Carbon Emission Trends (kg CO2e)
        </h3>
        
        <div className="chart-container" style={{ outline: 'none' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorWaste" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMobility" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} />
              <Tooltip 
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ fontWeight: 'bold', color: '#fff' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area type="monotone" dataKey="Water" stackId="1" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWater)" />
              <Area type="monotone" dataKey="Waste" stackId="1" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorWaste)" />
              <Area type="monotone" dataKey="Energy" stackId="1" stroke="#f97316" fillOpacity={1} fill="url(#colorEnergy)" />
              <Area type="monotone" dataKey="Mobility" stackId="1" stroke="#0d9488" fillOpacity={1} fill="url(#colorMobility)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tabular data fallback for Screen Readers / WCAG Compliance */}
        <details style={{ marginTop: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', padding: '6px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '6px' }}>
            Show trend data as table alternative
          </summary>
          <table className="access-table" summary="Historical list of calculated carbon emissions by categories.">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Water (kg CO2)</th>
                <th scope="col">Waste (kg CO2)</th>
                <th scope="col">Energy (kg CO2)</th>
                <th scope="col">Mobility (kg CO2)</th>
                <th scope="col">Total (kg CO2)</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.date}</td>
                  <td>{row.Water.toFixed(4)}</td>
                  <td>{row.Waste.toFixed(4)}</td>
                  <td>{row.Energy.toFixed(4)}</td>
                  <td>{row.Mobility.toFixed(4)}</td>
                  <td>{row.Total.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {/* BigQuery Averages Benchmarking Chart */}
      {stats && (
        <section className="card" aria-labelledby="benchmark-title">
          <h3 id="benchmark-title" className="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
            BigQuery Benchmarking: Your Average vs. Global Average
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Aggregated in real-time. (Note: Water volume is scaled by 1/10 to normalize visualization layout).
          </p>

          <div className="chart-container" style={{ outline: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benchmarkData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} />
                <Tooltip 
                  contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#fff' }}
                />
                <Legend verticalAlign="top" height={36} iconType="rect" />
                <Bar dataKey="User" fill="#06b6d4" name="Your Average" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Global" fill="rgba(255,255,255,0.15)" name="Global Average" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <details style={{ marginTop: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', padding: '6px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '6px' }}>
              Show benchmark data as table alternative
            </summary>
            <table className="access-table" summary="Statistical comparison of user average consumption vs. global average.">
              <thead>
                <tr>
                  <th scope="col">Resource Metric</th>
                  <th scope="col">Your Average</th>
                  <th scope="col">Global Baseline Average</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Carbon Footprint (kg CO2e)</td>
                  <td>{stats.user_averages.co2.toFixed(2)}</td>
                  <td>{stats.global_averages.co2.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Daily Water Usage (Liters)</td>
                  <td>{stats.user_averages.water.toFixed(1)}</td>
                  <td>{stats.global_averages.water.toFixed(1)}</td>
                </tr>
                <tr>
                  <td>Daily Municipal Waste Output (kg)</td>
                  <td>{stats.user_averages.waste.toFixed(2)}</td>
                  <td>{stats.global_averages.waste.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Electricity Consumption (kWh)</td>
                  <td>{stats.user_averages.electricity.toFixed(1)}</td>
                  <td>{stats.global_averages.electricity.toFixed(1)}</td>
                </tr>
                <tr>
                  <td>Daily Travel/Commute Distance (km)</td>
                  <td>{stats.user_averages.commute.toFixed(1)}</td>
                  <td>{stats.global_averages.commute.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </section>
      )}
    </div>
  );
};
