'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e) => {
    e.preventDefault();
    if (id === 'judge' && password === 'judge05') {
      // Set the auth cookie
      document.cookie = 'regchain_auth=true; path=/; max-age=86400; SameSite=Strict';
      // Redirect to main page
      router.push('/');
    } else {
      setError('Invalid ID or Password. Please try again.');
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '3rem',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid #333'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '48px', 
            height: '48px', 
            backgroundColor: '#ffaa00', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            fontWeight: 'bold',
            fontSize: '24px',
            color: '#000'
          }}>
            R
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Welcome to RegChain</h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#888', fontSize: '14px' }}>Please sign in to access the session.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', color: '#ccc' }}>Session ID</label>
            <input 
              type="text" 
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter session ID"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', color: '#ccc' }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          {error && (
            <div style={{ color: '#ff4444', fontSize: '14px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button 
            type="submit"
            style={{
              marginTop: '1rem',
              padding: '0.875rem',
              backgroundColor: '#ffaa00',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e69900'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffaa00'}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
