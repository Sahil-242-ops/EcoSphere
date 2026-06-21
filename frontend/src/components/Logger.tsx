import React, { useState } from 'react';
import { useEcoSphereStore } from '../store';

export const Logger: React.FC = () => {
  const { submitLog, submittingLog, error, clearError } = useEcoSphereStore();
  
  // State for form fields
  const [water, setWater] = useState<string>('');
  const [waste, setWaste] = useState<string>('');
  const [electricity, setElectricity] = useState<string>('');
  const [commuteDist, setCommuteDist] = useState<string>('');
  const [commuteType, setCommuteType] = useState<string>('car_petrol');
  const [success, setSuccess] = useState<boolean>(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormErr(null);
    setSuccess(false);

    // Validate inputs
    const wNum = parseFloat(water);
    const wasteNum = parseFloat(waste);
    const elecNum = parseFloat(electricity);
    const distNum = parseFloat(commuteDist);

    if (isNaN(wNum) || wNum < 0) {
      setFormErr('Water liters must be a positive number.');
      return;
    }
    if (isNaN(wasteNum) || wasteNum < 0) {
      setFormErr('Waste kilograms must be a positive number.');
      return;
    }
    if (isNaN(elecNum) || elecNum < 0) {
      setFormErr('Electricity kWh must be a positive number.');
      return;
    }
    if (isNaN(distNum) || distNum < 0) {
      setFormErr('Commute distance must be a positive number.');
      return;
    }

    const successResult = await submitLog({
      water_liters: wNum,
      waste_kg: wasteNum,
      electricity_kwh: elecNum,
      commute_km: distNum,
      commute_type: commuteType,
    });

    if (successResult) {
      setSuccess(true);
      // Clear inputs
      setWater('');
      setWaste('');
      setElectricity('');
      setCommuteDist('');
      
      // Auto dismiss success banner after 4 seconds
      setTimeout(() => setSuccess(false), 4000);
    }
  };

  return (
    <section className="card" aria-labelledby="logger-title">
      <h2 id="logger-title" className="card-title">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20h9M3 20h4M5 20v-4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Log Resource Intake
      </h2>

      <form onSubmit={handleSubmit} noValidate>
        {success && (
          <div className="error-message" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34d399' }} role="status">
            Log submitted successfully. Metrics and Vertex AI suggestions updated!
          </div>
        )}

        {(formErr || error) && (
          <div className="error-message" role="alert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{formErr || error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="input-water">Daily Water Consumption</label>
          <div className="input-container">
            <input
              id="input-water"
              type="number"
              placeholder="e.g. 150"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              aria-describedby="water-description"
              disabled={submittingLog}
              required
            />
            <span className="input-unit">Liters</span>
          </div>
          <span id="water-description" className="sr-only">Enter total direct water used for showers, wash, and drinking in liters.</span>
        </div>

        <div className="form-group">
          <label htmlFor="input-waste">Municipal Waste Generated</label>
          <div className="input-container">
            <input
              id="input-waste"
              type="number"
              placeholder="e.g. 2.0"
              value={waste}
              onChange={(e) => setWaste(e.target.value)}
              aria-describedby="waste-description"
              disabled={submittingLog}
              step="0.1"
              required
            />
            <span className="input-unit">kg</span>
          </div>
          <span id="waste-description" className="sr-only">Enter weight of organic, recyclable, and landfill waste in kilograms.</span>
        </div>

        <div className="form-group">
          <label htmlFor="input-electricity">Electricity Consumed</label>
          <div className="input-container">
            <input
              id="input-electricity"
              type="number"
              placeholder="e.g. 12"
              value={electricity}
              onChange={(e) => setElectricity(e.target.value)}
              aria-describedby="elec-description"
              disabled={submittingLog}
              required
            />
            <span className="input-unit">kWh</span>
          </div>
          <span id="elec-description" className="sr-only">Enter household electricity consumption in kilowatt hours.</span>
        </div>

        <div className="form-group">
          <label htmlFor="input-commute-dist">Daily Commute Distance</label>
          <div className="input-container">
            <input
              id="input-commute-dist"
              type="number"
              placeholder="e.g. 25"
              value={commuteDist}
              onChange={(e) => setCommuteDist(e.target.value)}
              aria-describedby="commute-description"
              disabled={submittingLog}
              required
            />
            <span className="input-unit">km</span>
          </div>
          <span id="commute-description" className="sr-only">Enter total commuting distance traveled today.</span>
        </div>

        <div className="form-group">
          <label htmlFor="input-commute-type">Commute Mode / Fuel Type</label>
          <div className="input-container">
            <select
              id="input-commute-type"
              value={commuteType}
              onChange={(e) => setCommuteType(e.target.value)}
              disabled={submittingLog}
            >
              <option value="car_petrol">Petrol Engine Car</option>
              <option value="car_diesel">Diesel Engine Car</option>
              <option value="car_electric">Electric Vehicle (EV)</option>
              <option value="transit">Public Transit (Bus/Train)</option>
              <option value="bike_walk">Biking / Walking (Net Zero)</option>
            </select>
          </div>
        </div>

        <button 
          type="submit" 
          className="btn" 
          disabled={submittingLog}
          aria-live="polite"
        >
          {submittingLog ? (
            <>
              <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderTopColor: '#fff', marginRight: '8px' }}></span>
              Storing Logs...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Submit Resource Log
            </>
          )}
        </button>
      </form>
    </section>
  );
};
