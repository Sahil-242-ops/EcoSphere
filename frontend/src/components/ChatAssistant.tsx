import React, { useState, useRef, useEffect } from 'react';
import { useEcoSphereStore } from '../store';

export const ChatAssistant: React.FC = () => {
  const { chatHistory, sendChatMessage, sendingChatMessage } = useEcoSphereStore();
  const [input, setInput] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat container to bottom when messages are appended
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, sendingChatMessage]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const query = input;
    setInput('');
    await sendChatMessage(query);
  };

  const handleChipClick = async (promptText: string) => {
    if (sendingChatMessage) return;
    await sendChatMessage(promptText);
  };

  const suggestionChips = [
    "What is my biggest footprint source?",
    "How can I reduce waste at home?",
    "Show me water conservation tips.",
    "Is public transit better than EV?"
  ];

  return (
    <section className="card" aria-labelledby="chat-title" style={{ display: 'flex', flexDirection: 'column', height: '620px' }}>
      <h3 id="chat-title" className="card-title" style={{ flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        AI Sustainability Assistant
      </h3>

      {/* Message Area */}
      <div 
        role="log"
        aria-live="polite"
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '12px 6px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          marginBottom: '16px'
        }}
      >
        {chatHistory.map((msg, index) => {
          const isCoach = msg.sender === 'coach';
          return (
            <div 
              key={index}
              style={{
                alignSelf: isCoach ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                background: isCoach ? 'rgba(26, 36, 56, 0.9)' : 'var(--grad-primary)',
                backgroundImage: isCoach ? 'none' : 'var(--grad-primary)',
                border: isCoach ? '1px solid var(--border-color)' : 'none',
                padding: '10px 14px',
                borderRadius: isCoach ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.75rem', marginBottom: '4px', opacity: 0.8 }}>
                {isCoach ? 'EcoCoach AI' : 'You'}
              </div>
              <p style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{msg.text}</p>
            </div>
          );
        })}

        {sendingChatMessage && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(26, 36, 56, 0.9)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '12px 12px 12px 2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px', borderTopColor: '#06b6d4', margin: 0 }}></span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Coach is thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div style={{ flexShrink: 0, marginBottom: '12px' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Suggested Questions:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {suggestionChips.map((chip, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleChipClick(chip)}
              disabled={sendingChatMessage}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} style={{ flexShrink: 0, display: 'flex', gap: '8px' }}>
        <div className="input-container" style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Type your sustainability question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sendingChatMessage}
            aria-label="Sustainability question input"
            required
            style={{ paddingRight: '16px' }}
          />
        </div>
        <button 
          type="submit" 
          className="btn" 
          disabled={sendingChatMessage || !input.trim()}
          style={{ width: 'auto', padding: '0 20px' }}
          aria-label="Send query"
        >
          Send
        </button>
      </form>
    </section>
  );
};
