import React, { useState, useCallback, useEffect } from 'react';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import { Theme } from '@astryxdesign/core';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { Toaster, toast } from 'sonner';
import NumberFlow from '@number-flow/react';
import { motion, AnimatePresence } from 'motion/react';
import { Command } from 'cmdk';
import './App.css';

// Fallback certificates in case backend is initializing
const INITIAL_CERTS = [
  {
    domain: 'localhost',
    file: 'localhost.crt',
    issuer: 'Smallstep Intermediate CA',
    algo: 'ECDSA-SHA256',
    validTo: new Date(Date.now() + 19 * 3600 * 1000).toISOString(),
    validFrom: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    serialNumber: 'E58B7FADFD07C2D1D90FC16DB2B46FD8',
    fingerprint: '5E:E1:FF:86:12:DA:F8:11:0B:FE:90:FA:51:A0:7C:99:18:0E:41:11:F9:5E:3E:2A:FD:93:C7:D8:27:D4:69:0D',
    san: 'DNS:localhost',
    keyUsage: ['Server Authentication', 'Client Authentication']
  },
  {
    domain: 'api.local',
    file: 'api.crt',
    issuer: 'Smallstep Intermediate CA',
    algo: 'ECDSA-SHA256',
    validTo: new Date(Date.now() - 1000).toISOString(), // Expired
    validFrom: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    serialNumber: '2A3A70E3528BB6D23DA2BE52A7B11F16',
    fingerprint: '51:E2:7A:C7:A7:F3:13:38:EC:36:B2:99:11:77:3A:F9:67:AA:68:34:1C:9D:3B:C7:F9:C2:C1:3A:EC:89:E0:13',
    san: 'DNS:api.local',
    keyUsage: ['Server Authentication', 'Client Authentication']
  }
];

const TABS = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'issue', label: '+ Issue Certificate' },
  { id: 'endpoints', label: 'Endpoints' }
];

const PROVISIONERS = [
  { value: 'mariano@smallstep.com', label: 'mariano@smallstep.com (JWK)' },
  { value: 'mike@smallstep.com', label: 'mike@smallstep.com (JWK)' },
  { value: 'decade', label: 'decade (10 Year Max)' },
  { value: '90days', label: '90days (90 Day Max)' }
];

const DURATIONS = [
  { value: '24h', label: '24 Hours (Zero-Trust Standard)' },
  { value: '48h', label: '48 Hours' },
  { value: '720h', label: '30 Days' }
];

const ALGO_DETAILS = {
  'ECDSA-SHA256': {
    badge: 'Fast & Modern',
    summary: 'The modern encryption standard used by Apple and Cloudflare.',
    points: [
      { label: '3x Faster', desc: 'Secure handshakes connect in a fraction of a millisecond.' },
      { label: 'Top-Tier Security', desc: 'Equal to giant 3072-bit RSA keys, but tiny and battery-friendly.' }
    ]
  },
  'RSA-2048': {
    badge: 'Legacy Standard',
    summary: 'The classic encryption that runs on almost every device since the 90s.',
    points: [
      { label: 'Broad Compatibility', desc: 'Works with older legacy hardware and appliances.' },
      { label: 'Heavier', desc: 'Much larger keys that take more CPU and memory to verify.' }
    ]
  },
  'Ed25519': {
    badge: 'Next-Gen',
    summary: 'High-speed modern cryptography designed for instant SSH logins.',
    points: [
      { label: 'Bulletproof', desc: 'Built from the ground up to prevent timing-based attacks.' },
      { label: 'Fastest', desc: 'Extremely lightweight verification.' }
    ]
  }
};

// Dynamic Countdown Formatter & Color Coder
function getCountdown(validTo, now) {
  if (!validTo) return { text: 'In 24 Hours', color: '#30d158', badge: 'Active', bg: 'rgba(48, 209, 88, 0.14)', border: 'rgba(48, 209, 88, 0.3)' };
  const diff = new Date(validTo).getTime() - now;

  if (diff <= 0) {
    return {
      text: 'Expired',
      color: '#ff453a',
      badge: 'Passive Revoked',
      bg: 'rgba(255, 69, 58, 0.15)',
      border: 'rgba(255, 69, 58, 0.35)'
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const timeStr = `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  if (hours < 8) {
    return {
      text: timeStr,
      color: '#ffd60a',
      badge: 'Auto-Renew Window (<8h)',
      bg: 'rgba(255, 214, 10, 0.15)',
      border: 'rgba(255, 214, 10, 0.35)'
    };
  }

  return {
    text: timeStr,
    color: '#30d158',
    badge: 'Active',
    bg: 'rgba(48, 209, 88, 0.14)',
    border: 'rgba(48, 209, 88, 0.3)'
  };
}

function AlgorithmTooltip({ algo }) {
  const [hovered, setHovered] = useState(false);
  const details = ALGO_DETAILS[algo] || {
    badge: 'Encrypted',
    summary: 'Standard cryptographic signature used to keep TLS connections secure.',
    points: [{ label: 'Tamper-Proof', desc: 'Ensures traffic cannot be modified in transit.' }]
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <span
        style={{
          fontFamily: '"SF Mono", monospace',
          color: '#5ac8fa',
          cursor: 'help',
          borderBottom: '1px dashed rgba(90, 200, 250, 0.45)',
          paddingBottom: '1px',
          fontWeight: 500
        }}
      >
        {algo}
      </span>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 12px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(24, 24, 28, 0.96)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderTop: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.85)',
            borderRadius: '14px',
            padding: '14px 18px',
            width: '280px',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'tooltipIn 0.14s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: '7px solid rgba(24, 24, 28, 0.96)'
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>{algo}</span>
            <span style={{
              fontSize: '11px',
              background: 'rgba(48, 209, 88, 0.15)',
              color: '#30d158',
              border: '1px solid rgba(48, 209, 88, 0.3)',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontWeight: 600
            }}>
              {details.badge}
            </span>
          </div>

          <p style={{ fontSize: '12.5px', color: '#f5f5f7', marginBottom: '10px', lineHeight: 1.45 }}>
            {details.summary}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {details.points.map((pt, i) => (
              <div
                key={i}
                style={{
                  fontSize: '12px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  lineHeight: 1.4
                }}
              >
                <span style={{ color: '#5ac8fa', fontWeight: 600 }}>{pt.label}: </span>
                <span style={{ color: '#a1a1a6' }}>{pt.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Generate code templates for instant developer usage
function getCodeSnippets(cert) {
  if (!cert) return {};
  const domain = cert.domain || 'app.local';
  const certFile = cert.file || `${domain}.crt`;
  const keyFile = certFile.replace(/\.crt$/, '.key');

  return {
    node: `// Node.js HTTPS Express Server
const https = require('https');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Secure TLS via step-ca!'));

const options = {
  cert: fs.readFileSync('${certFile}'),
  key: fs.readFileSync('${keyFile}')
};

https.createServer(options, app).listen(443, () => {
  console.log('Secure server running at https://${domain}');
});`,

    python: `# Python FastAPI + Uvicorn
# Run command:
# uvicorn main:app --ssl-keyfile ${keyFile} --ssl-certfile ${certFile} --port 443

from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "secure", "domain": "${domain}", "tls": "step-ca"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=443, ssl_keyfile="${keyFile}", ssl_certfile="${certFile}")`,

    go: `// Go net/http Microservice
package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello from secure %s!", "${domain}")
	})

	fmt.Println("Listening on https://${domain}:443...")
	err := http.ListenAndServeTLS(":443", "${certFile}", "${keyFile}", nil)
	if err != nil {
		panic(err)
	}
}`,

    docker: `# Docker Compose TLS Mount
version: '3.8'

services:
  service_${domain.replace(/[^a-zA-Z0-9]/g, '_')}:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./${certFile}:/etc/ssl/certs/${certFile}:ro
      - ./${keyFile}:/etc/ssl/private/${keyFile}:ro
    environment:
      - DOMAIN=${domain}
      - TLS_PROVIDER=step-ca`
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('inventory');
  const [domainName, setDomainName] = useState('app.local');
  const [provisioner, setProvisioner] = useState('mariano@smallstep.com');
  const [duration, setDuration] = useState('24h');
  const [issuedCerts, setIssuedCerts] = useState(INITIAL_CERTS);
  const [isIssuing, setIsIssuing] = useState(false);
  const [inspectCert, setInspectCert] = useState(null);
  const [inspectTab, setInspectTab] = useState('details'); // 'details' | 'snippets'
  const [snippetLang, setSnippetLang] = useState('node'); // 'node' | 'python' | 'go' | 'docker'
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [telemetry, setTelemetry] = useState({ status: 'online', latencyMs: 12, caUrl: 'https://localhost:9000' });
  const [renewingFile, setRenewingFile] = useState(null);

  // Real-time ticking clock for second-accurate expiry
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real certificates from backend CLI bridge on mount
  const fetchCertificates = useCallback(async () => {
    try {
      const res = await fetch('/api/certificates');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setIssuedCerts(data);
        }
      }
    } catch (err) {
      console.warn('API bridge not ready, using fallback certs');
    }
  }, []);

  // Live Telemetry Health Ping
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      } else {
        setTelemetry(prev => ({ ...prev, status: 'degraded' }));
      }
    } catch {
      setTelemetry(prev => ({ ...prev, status: 'offline' }));
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
    fetchTelemetry();
    const healthInterval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(healthInterval);
  }, [fetchCertificates, fetchTelemetry]);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdkOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const copyToClipboard = useCallback((text, label = 'Copied to clipboard') => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    toast.success(label, {
      description: text.length > 60 ? `${text.slice(0, 58)}...` : text
    });
  }, []);

  // Real Backend Issuance via step ca CLI
  const handleIssue = useCallback(async (e) => {
    e.preventDefault();
    if (!domainName.trim() || isIssuing) return;
    setIsIssuing(true);
    const cleanDomain = domainName.trim();

    try {
      const res = await fetch('/api/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleanDomain, provisioner, duration })
      });

      const result = await res.json();
      if (res.ok && result.certificate) {
        setIssuedCerts(prev => [result.certificate, ...prev.filter(c => c.file !== result.certificate.file)]);
        toast.success(`Generated ${result.certificate.file} via step-ca!`, {
          description: `Real .crt & .key written to disk • SAN: ${result.certificate.san}`
        });
        setActiveTab('inventory');
      } else {
        toast.error('Issuance failed', {
          description: result.error || 'Failed to execute step CLI command'
        });
      }
    } catch (err) {
      toast.error('API Error', { description: err.message });
    } finally {
      setIsIssuing(false);
    }
  }, [domainName, provisioner, duration, isIssuing]);

  // 1-Click "Renew Now" via mTLS
  const handleRenew = useCallback(async (certFile, domain) => {
    if (renewingFile) return;
    setRenewingFile(certFile);
    try {
      const res = await fetch('/api/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certFile })
      });

      const data = await res.json();
      if (res.ok && data.certificate) {
        setIssuedCerts(prev => prev.map(c => c.file === certFile ? data.certificate : c));
        toast.success(`Successfully renewed ${domain}!`, {
          description: `Extended validity to 24h via step ca renew (mTLS)`
        });
      } else {
        toast.error('Renewal failed', { description: data.error || 'Could not renew certificate' });
      }
    } catch (err) {
      toast.error('Renewal Error', { description: err.message });
    } finally {
      setRenewingFile(null);
    }
  }, [renewingFile]);

  // 1-Click Root CA Download & Command Copy
  const handleDownloadRootCA = useCallback(() => {
    const a = document.createElement('a');
    a.href = '/api/root-ca';
    a.download = 'root_ca.crt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    copyToClipboard('step certificate install root_ca.crt', 'Downloaded root_ca.crt! Terminal install command copied:');
  }, [copyToClipboard]);

  const commandToCopy = `step ca certificate ${domainName || 'app.local'} ${(domainName || 'app.local').replace(/\./g, '_')}.crt ${(domainName || 'app.local').replace(/\./g, '_')}.key --provisioner ${provisioner}`;

  return (
    <Theme theme={neutralTheme} mode="dark">
      <Toaster theme="dark" position="bottom-right" richColors />

      <div style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#000000',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
        padding: '36px 44px',
        WebkitFontSmoothing: 'antialiased',
        background: 'radial-gradient(circle at 50% 0%, rgba(10, 132, 255, 0.12) 0%, rgba(0, 0, 0, 0) 65%), #000000',
        boxSizing: 'border-box'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          {/* Header */}
          <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(28, 28, 32, 0.72)',
            backdropFilter: 'blur(35px) saturate(190%)',
            WebkitBackdropFilter: 'blur(35px) saturate(190%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderTop: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '18px',
            padding: '16px 24px',
            marginBottom: '32px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55)',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0a84ff 0%, #0056b3 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 12px rgba(10, 132, 255, 0.45)'
                }}>
                  <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '17px' }}>S</span>
                </div>
                <h1 style={{ margin: 0, color: '#ffffff', fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
                  step-ca Certificate Manager
                </h1>

                {/* Section 3: Live Authority Telemetry with Breathing Beacon & Latency */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: telemetry.status === 'online' ? '#30d158' : '#ff453a',
                  background: telemetry.status === 'online' ? 'rgba(48, 209, 88, 0.12)' : 'rgba(255, 69, 58, 0.12)',
                  border: `1px solid ${telemetry.status === 'online' ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255, 69, 58, 0.3)'}`,
                  padding: '4px 12px',
                  borderRadius: '9999px'
                }}>
                  <span className={telemetry.status === 'online' ? 'beacon-pulse' : 'beacon-offline'} />
                  {telemetry.status === 'online'
                    ? `Authority Active (:9000) • ${telemetry.latencyMs || 1}ms`
                    : 'Authority Offline (:9000)'}
                </span>
              </div>
              <p style={{ color: '#98989d', fontSize: '12px', margin: '6px 0 0 46px', fontFamily: '"SF Mono", monospace', letterSpacing: '0.02em' }}>
                Fingerprint: 84a033e84196f73bd593fad7a63e509e57fd982f02084359c4e8c5c864efc27d
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Section 4: Ecosystem Companion Links */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <a href="/presentation.html" target="_blank" rel="noreferrer" className="companion-link">
                  🖥️ Slides
                </a>
                <a href="/playground.html" target="_blank" rel="noreferrer" className="companion-link">
                  🧪 Playground
                </a>
                <a href="/cheatsheet.html" target="_blank" rel="noreferrer" className="companion-link">
                  📄 Cheat Sheet
                </a>
              </div>

              {/* Section 2: 1-Click Root CA Installer Download */}
              <button
                onClick={handleDownloadRootCA}
                className="btn-press"
                title="Download Root CA Certificate & copy install command"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(10, 132, 255, 0.14)',
                  border: '1px solid rgba(10, 132, 255, 0.32)',
                  color: '#64d2ff',
                  padding: '7px 13px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'inherit'
                }}
              >
                <span>🛡️ Root CA</span>
              </button>

              {/* Command Palette Trigger Button */}
              <button
                onClick={() => setCmdkOpen(true)}
                className="btn-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#a1a1a6',
                  padding: '7px 14px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontFamily: 'inherit'
                }}
              >
                <span>Search</span>
                <kbd style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '4px',
                  padding: '1px 5px',
                  fontSize: '11px',
                  fontFamily: '"SF Mono", monospace',
                  color: '#ffffff'
                }}>
                  ⌘K
                </kbd>
              </button>

              {/* Section 1: Sliding Capsule Pill Navigation with Motion layoutId */}
              <nav style={{
                display: 'flex',
                background: 'rgba(0, 0, 0, 0.45)',
                padding: '4px',
                borderRadius: '9999px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'relative'
              }}>
                {TABS.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="btn-press"
                      style={{
                        position: 'relative',
                        background: 'transparent',
                        color: isActive ? '#ffffff' : '#a1a1a6',
                        border: 'none',
                        padding: '8px 18px',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 500,
                        zIndex: 1,
                        outline: 'none'
                      }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="active-nav-pill"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: '#0a84ff',
                            borderRadius: '9999px',
                            boxShadow: '0 2px 12px rgba(10, 132, 255, 0.5)',
                            zIndex: -1
                          }}
                        />
                      )}
                      <span style={{ position: 'relative', zIndex: 2 }}>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </header>

          {/* TAB 1: INVENTORY */}
          {activeTab === 'inventory' && (
            <div>
              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px', marginBottom: '32px' }}>
                <div style={{
                  background: 'rgba(28, 28, 32, 0.65)',
                  backdropFilter: 'blur(25px)',
                  WebkitBackdropFilter: 'blur(25px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '22px 26px'
                }}>
                  <div style={{ fontSize: '11px', color: '#98989d', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Active Certificates</div>
                  <div style={{ fontSize: '36px', fontWeight: 700, color: '#ffffff', marginTop: '6px', letterSpacing: '-0.03em' }}>
                    <NumberFlow value={issuedCerts.length} />
                  </div>
                </div>
                <div style={{
                  background: 'rgba(28, 28, 32, 0.65)',
                  backdropFilter: 'blur(25px)',
                  WebkitBackdropFilter: 'blur(25px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '22px 26px'
                }}>
                  <div style={{ fontSize: '11px', color: '#98989d', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>CA Port</div>
                  <div style={{ fontSize: '36px', fontWeight: 700, color: '#30d158', marginTop: '6px', letterSpacing: '-0.03em' }}>:9000</div>
                </div>
                <div style={{
                  background: 'rgba(28, 28, 32, 0.65)',
                  backdropFilter: 'blur(25px)',
                  WebkitBackdropFilter: 'blur(25px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '22px 26px'
                }}>
                  <div style={{ fontSize: '11px', color: '#98989d', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Revocation Model</div>
                  <div style={{ fontSize: '26px', fontWeight: 700, color: '#ffd60a', marginTop: '8px', letterSpacing: '-0.02em' }}>Passive (24h TTL)</div>
                </div>
              </div>

              {/* Table Card */}
              <div style={{
                background: 'rgba(28, 28, 32, 0.65)',
                backdropFilter: 'blur(35px) saturate(190%)',
                WebkitBackdropFilter: 'blur(35px) saturate(190%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderTop: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '18px',
                padding: '28px 32px 48px',
                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
                    Issued Certificates
                  </h2>
                  <button
                    onClick={fetchCertificates}
                    className="btn-press"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#a1a1a6',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    ↻ Sync Disk
                  </button>
                </div>

                <div style={{ overflowX: 'visible', minHeight: '300px', position: 'relative' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#a1a1a6' }}>
                        <th style={{ padding: '14px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>Domain / SAN</th>
                        <th style={{ padding: '14px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>Certificate File</th>
                        <th style={{ padding: '14px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>Issuer</th>
                        <th style={{ padding: '14px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>Algorithm</th>
                        <th style={{ padding: '14px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>Validity &amp; Lifespan</th>
                        <th style={{ padding: '14px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>Status</th>
                        <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {issuedCerts.map((cert) => {
                          const countdown = getCountdown(cert.validTo, now);
                          const totalDuration = (cert.validFrom && cert.validTo)
                            ? (new Date(cert.validTo).getTime() - new Date(cert.validFrom).getTime())
                            : (24 * 3600 * 1000);
                          const diff = cert.validTo ? (new Date(cert.validTo).getTime() - now) : 0;
                          const isExpired = diff <= 0;
                          const remainingPct = isExpired ? 0 : Math.max(0, Math.min(100, (diff / totalDuration) * 100));
                          const isAmber = !isExpired && diff < 8 * 3600 * 1000;

                          return (
                            <motion.tr
                              key={cert.file}
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                              className="table-row-hover"
                              style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
                            >
                              <td style={{ padding: '16px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>{cert.domain}</td>
                              <td style={{ padding: '16px', color: '#e5e5ea', fontFamily: '"SF Mono", monospace', fontSize: '12.5px', whiteSpace: 'nowrap' }}>{cert.file}</td>
                              <td style={{ padding: '16px', color: '#a1a1a6', whiteSpace: 'nowrap' }}>{cert.issuer}</td>
                              <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                                <AlgorithmTooltip algo={cert.algo} />
                              </td>

                              {/* Section 1: Color Coded Countdown + Visual Lifespan Progress Bar */}
                              <td style={{ padding: '16px' }}>
                                <div style={{ fontFamily: '"SF Mono", monospace', fontSize: '13px', fontWeight: 600, color: countdown.color }}>
                                  {countdown.text}
                                </div>
                                <div style={{ marginTop: '7px', width: '100%', maxWidth: '160px' }}>
                                  <div style={{
                                    height: '5px',
                                    borderRadius: '3px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    overflow: 'hidden',
                                    position: 'relative'
                                  }}>
                                    <div
                                      className={isAmber ? 'pulse-amber-bar' : ''}
                                      style={{
                                        height: '100%',
                                        width: `${isExpired ? 100 : remainingPct}%`,
                                        background: isExpired ? '#ff453a' : isAmber ? '#ffd60a' : '#30d158',
                                        borderRadius: '3px',
                                        transition: 'width 1s linear',
                                        boxShadow: isExpired ? 'none' : isAmber ? '0 0 8px rgba(255, 214, 10, 0.7)' : '0 0 8px rgba(48, 209, 88, 0.6)'
                                      }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginTop: '3px', fontFamily: '"SF Mono", monospace' }}>
                                    <span style={{ color: isExpired ? '#ff453a' : '#86868b' }}>
                                      {isExpired ? '100% elapsed' : `${Math.round(remainingPct)}% left`}
                                    </span>
                                    <span style={{ color: isExpired ? '#ff453a' : isAmber ? '#ffd60a' : '#30d158', fontWeight: 600 }}>
                                      {isExpired ? 'Expired' : isAmber ? 'Renew Window' : 'Healthy'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td style={{ padding: '16px' }}>
                                <span style={{
                                  backgroundColor: countdown.bg,
                                  color: countdown.color,
                                  border: `1px solid ${countdown.border}`,
                                  padding: '4px 11px',
                                  borderRadius: '9999px',
                                  fontSize: '11.5px',
                                  fontWeight: 600
                                }}>
                                  {countdown.badge}
                                </span>
                              </td>

                              {/* Action Buttons: 1-Click Renew + Inspect + Copy CLI */}
                              <td style={{ padding: '16px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                                  {!isExpired && (
                                    <button
                                      onClick={() => handleRenew(cert.file, cert.domain)}
                                      disabled={renewingFile === cert.file}
                                      className="btn-press"
                                      title="Renew certificate validity for another 24 hours via mTLS"
                                      style={{
                                        background: 'rgba(48, 209, 88, 0.15)',
                                        border: '1px solid rgba(48, 209, 88, 0.35)',
                                        color: '#30d158',
                                        padding: '6px 12px',
                                        borderRadius: '9999px',
                                        cursor: renewingFile === cert.file ? 'wait' : 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      {renewingFile === cert.file ? 'Renewing...' : '↻ Renew'}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => { setInspectCert(cert); setInspectTab('details'); }}
                                    className="btn-press"
                                    style={{
                                      background: '#0a84ff',
                                      border: 'none',
                                      color: '#ffffff',
                                      padding: '6px 14px',
                                      borderRadius: '9999px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      boxShadow: '0 2px 8px rgba(10, 132, 255, 0.35)'
                                    }}
                                  >
                                    Inspect Cert
                                  </button>

                                  <button
                                    onClick={() => copyToClipboard(`step certificate inspect ${cert.file}`)}
                                    className="btn-press"
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.08)',
                                      border: '1px solid rgba(255, 255, 255, 0.14)',
                                      color: '#a1a1a6',
                                      padding: '6px 12px',
                                      borderRadius: '9999px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 600
                                    }}
                                  >
                                    Copy CLI
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ISSUE CERTIFICATE */}
          {activeTab === 'issue' && (
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              <div style={{
                background: 'rgba(28, 28, 32, 0.7)',
                backdropFilter: 'blur(35px) saturate(190%)',
                WebkitBackdropFilter: 'blur(35px) saturate(190%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderTop: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '18px',
                padding: '38px 42px',
                boxShadow: '0 28px 56px rgba(0, 0, 0, 0.55)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <h2 style={{ color: '#ffffff', fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>
                    Request Real TLS Certificate
                  </h2>
                  <span style={{ fontSize: '11px', background: 'rgba(48, 209, 88, 0.15)', color: '#30d158', border: '1px solid rgba(48, 209, 88, 0.3)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                    Live step CLI Bridge
                  </span>
                </div>
                <p style={{ color: '#a1a1a6', fontSize: '14px', marginBottom: '28px', lineHeight: 1.5 }}>
                  Executes <code>step ca certificate</code> on the backend and writes authentic <code>.crt</code> and <code>.key</code> files directly to disk.
                </p>

                <form onSubmit={handleIssue}>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#e5e5ea' }}>
                      Target Domain Name (SAN)
                    </label>
                    <input
                      type="text"
                      value={domainName}
                      onChange={(e) => setDomainName(e.target.value)}
                      placeholder="e.g. gateway.internal or myapi.local"
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        padding: '13px 18px',
                        borderRadius: '12px',
                        color: '#ffffff',
                        fontSize: '14.5px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#e5e5ea' }}>
                        Provisioner
                      </label>
                      <select
                        value={provisioner}
                        onChange={(e) => setProvisioner(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(0, 0, 0, 0.5)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          padding: '13px 16px',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        {PROVISIONERS.map(p => (
                          <option key={p.value} value={p.value} style={{ background: '#1c1c20', color: '#ffffff' }}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#e5e5ea' }}>
                        Lifetime
                      </label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(0, 0, 0, 0.5)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          padding: '13px 16px',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        {DURATIONS.map(d => (
                          <option key={d.value} value={d.value} style={{ background: '#1c1c20', color: '#ffffff' }}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* CLI Equivalent Terminal Preview */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.55)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '28px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                        Equivalent Backend CLI Command
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(commandToCopy)}
                        className="btn-press"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#0a84ff',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Copy Command
                      </button>
                    </div>
                    <code style={{
                      fontFamily: '"SF Mono", monospace',
                      fontSize: '12.5px',
                      color: '#64d2ff',
                      wordBreak: 'break-all',
                      lineHeight: 1.5,
                      display: 'block'
                    }}>
                      {commandToCopy}
                    </code>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('inventory')}
                      className="btn-press"
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#ffffff',
                        padding: '12px 24px',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isIssuing}
                      className="btn-press"
                      style={{
                        background: isIssuing ? '#0056b3' : '#0a84ff',
                        border: 'none',
                        color: '#ffffff',
                        padding: '12px 28px',
                        borderRadius: '9999px',
                        cursor: isIssuing ? 'wait' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                        boxShadow: '0 4px 14px rgba(10, 132, 255, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {isIssuing ? 'Issuing via step-ca...' : 'Issue Certificate'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: ENDPOINTS */}
          {activeTab === 'endpoints' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px' }}>
              <div style={{
                background: 'rgba(28, 28, 32, 0.65)',
                backdropFilter: 'blur(35px) saturate(190%)',
                WebkitBackdropFilter: 'blur(35px) saturate(190%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderTop: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '18px',
                padding: '30px 34px'
              }}>
                <h2 style={{ color: '#0a84ff', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '16px' }}>
                  step-ca Authority Server (:9000)
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '14px', lineHeight: 2.2 }}>
                  <li><strong>Health Check:</strong> <a href="https://localhost:9000/health" target="_blank" rel="noreferrer" style={{ color: '#64d2ff', textDecoration: 'none' }}>https://localhost:9000/health</a></li>
                  <li><strong>Root Certificate:</strong> <a href="https://localhost:9000/roots.pem" target="_blank" rel="noreferrer" style={{ color: '#64d2ff', textDecoration: 'none' }}>https://localhost:9000/roots.pem</a></li>
                  <li><strong>Config File:</strong> <code style={{ fontFamily: '"SF Mono", monospace', color: '#e5e5ea' }}>examples/pki/config/ca.json</code></li>
                  <li><strong>Fingerprint:</strong> <code style={{ fontFamily: '"SF Mono", monospace', fontSize: '12px', color: '#e5e5ea' }}>84a033e8...64efc27d</code></li>
                </ul>
              </div>

              <div style={{
                background: 'rgba(28, 28, 32, 0.65)',
                backdropFilter: 'blur(35px) saturate(190%)',
                WebkitBackdropFilter: 'blur(35px) saturate(190%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderTop: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '18px',
                padding: '30px 34px'
              }}>
                <h2 style={{ color: '#30d158', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '16px' }}>
                  Node.js HTTPS App (:3000)
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '14px', lineHeight: 2.2 }}>
                  <li><strong>App URL:</strong> <a href="https://localhost:3000" target="_blank" rel="noreferrer" style={{ color: '#30d158', textDecoration: 'none' }}>https://localhost:3000</a></li>
                  <li><strong>API Bridge:</strong> <code style={{ color: '#64d2ff' }}>GET /api/certificates</code> &amp; <code style={{ color: '#64d2ff' }}>POST /api/issue</code></li>
                  <li><strong>Cert Keypair:</strong> <code style={{ fontFamily: '"SF Mono", monospace', fontSize: '12px', color: '#e5e5ea' }}>localhost.crt / localhost.key</code></li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: In-Browser Certificate Inspector Modal with Code Snippets Drawer */}
      {inspectCert && (
        <div
          onClick={() => setInspectCert(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 1000
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '680px',
              background: 'rgba(24, 24, 28, 0.96)',
              backdropFilter: 'blur(40px) saturate(190%)',
              WebkitBackdropFilter: 'blur(40px) saturate(190%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderTop: '1px solid rgba(255, 255, 255, 0.22)',
              borderRadius: '20px',
              padding: '30px 34px',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.85)',
              color: '#ffffff',
              animation: 'modalIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0a84ff', fontWeight: 700 }}>
                  X.509 Certificate Inspector
                </span>
                <h3 style={{ fontSize: '1.45rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                  {inspectCert.domain}
                </h3>
                <div style={{ fontSize: '12px', color: '#86868b', fontFamily: '"SF Mono", monospace', marginTop: '2px' }}>
                  {inspectCert.file}
                </div>
              </div>

              <button
                onClick={() => setInspectCert(null)}
                className="btn-press"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#ffffff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Sub-Tabs: [Details] vs [Code Snippets] */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
              <button
                onClick={() => setInspectTab('details')}
                className={`code-tab-btn ${inspectTab === 'details' ? 'active' : ''}`}
              >
                📋 X.509 Details
              </button>
              <button
                onClick={() => setInspectTab('snippets')}
                className={`code-tab-btn ${inspectTab === 'snippets' ? 'active' : ''}`}
              >
                💻 How to Use in Code
              </button>
            </div>

            {/* TAB: X.509 DETAILS */}
            {inspectTab === 'details' && (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr',
                  gap: '12px 16px',
                  fontSize: '13px',
                  background: 'rgba(0, 0, 0, 0.45)',
                  padding: '18px 20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  marginBottom: '20px',
                  lineHeight: 1.5
                }}>
                  <div style={{ color: '#86868b', fontWeight: 600 }}>Issuer:</div>
                  <div style={{ color: '#f5f5f7' }}>{inspectCert.issuer}</div>

                  <div style={{ color: '#86868b', fontWeight: 600 }}>Algorithm:</div>
                  <div style={{ color: '#5ac8fa', fontFamily: '"SF Mono", monospace' }}>{inspectCert.algo}</div>

                  <div style={{ color: '#86868b', fontWeight: 600 }}>SANs:</div>
                  <div style={{ color: '#f5f5f7', fontFamily: '"SF Mono", monospace' }}>{inspectCert.san}</div>

                  <div style={{ color: '#86868b', fontWeight: 600 }}>Serial Number:</div>
                  <div style={{ color: '#e5e5ea', fontFamily: '"SF Mono", monospace', fontSize: '11.5px', wordBreak: 'break-all' }}>
                    {inspectCert.serialNumber || 'E58B7FADFD07C2D1D90FC16DB2B46FD8'}
                  </div>

                  <div style={{ color: '#86868b', fontWeight: 600 }}>Valid Range:</div>
                  <div style={{ color: '#d1d1d6', fontSize: '12px' }}>
                    {inspectCert.validFrom ? new Date(inspectCert.validFrom).toLocaleString() : 'Active'} &rarr; {inspectCert.validTo ? new Date(inspectCert.validTo).toLocaleString() : 'In 24h'}
                  </div>

                  <div style={{ color: '#86868b', fontWeight: 600 }}>Current Status:</div>
                  <div>
                    {(() => {
                      const countdown = getCountdown(inspectCert.validTo, now);
                      return (
                        <span style={{
                          backgroundColor: countdown.bg,
                          color: countdown.color,
                          border: `1px solid ${countdown.border}`,
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          fontFamily: '"SF Mono", monospace'
                        }}>
                          {countdown.badge} ({countdown.text})
                        </span>
                      );
                    })()}
                  </div>

                  <div style={{ color: '#86868b', fontWeight: 600 }}>SHA-256 Hash:</div>
                  <div style={{ color: '#64d2ff', fontFamily: '"SF Mono", monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                    {inspectCert.fingerprint || '5E:E1:FF:86:12:DA:F8:11:0B:FE:90:FA:51:A0:7C:99:18:0E:41:11:F9:5E:3E:2A:FD:93:C7:D8:27:D4:69:0D'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => copyToClipboard(inspectCert.fingerprint, 'Fingerprint copied')}
                    className="btn-press"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      padding: '9px 18px',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    Copy Fingerprint
                  </button>
                  <button
                    onClick={() => copyToClipboard(inspectCert.rawPem || `step certificate inspect ${inspectCert.file}`, 'Certificate copied')}
                    className="btn-press"
                    style={{
                      background: '#0a84ff',
                      border: 'none',
                      color: '#ffffff',
                      padding: '9px 20px',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      boxShadow: '0 2px 10px rgba(10, 132, 255, 0.4)'
                    }}
                  >
                    Copy PEM Certificate
                  </button>
                </div>
              </>
            )}

            {/* TAB: CODE SNIPPETS DRAWER */}
            {inspectTab === 'snippets' && (() => {
              const snippets = getCodeSnippets(inspectCert);
              return (
                <div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                    {[
                      { id: 'node', label: 'Node.js' },
                      { id: 'python', label: 'Python (FastAPI)' },
                      { id: 'go', label: 'Go' },
                      { id: 'docker', label: 'Docker Compose' }
                    ].map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => setSnippetLang(lang.id)}
                        className={`code-tab-btn ${snippetLang === lang.id ? 'active' : ''}`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>

                  <pre className="code-block-pre">
                    <code>{snippets[snippetLang]}</code>
                  </pre>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button
                      onClick={() => copyToClipboard(snippets[snippetLang], `${snippetLang.toUpperCase()} snippet copied`)}
                      className="btn-press"
                      style={{
                        background: '#0a84ff',
                        border: 'none',
                        color: '#ffffff',
                        padding: '9px 22px',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        boxShadow: '0 2px 10px rgba(10, 132, 255, 0.4)'
                      }}
                    >
                      Copy Snippet
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* cmdk Command Palette Dialog */}
      <Command.Dialog
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        label="Global Command Palette"
      >
        <Command.Input placeholder="Type a command or search certificates..." />
        <Command.List>
          <Command.Empty>No matching results found.</Command.Empty>

          <Command.Group heading="Navigation">
            <Command.Item onSelect={() => { setActiveTab('inventory'); setCmdkOpen(false); }}>
              <span>📋 Go to Certificate Inventory</span>
              <kbd>Tab 1</kbd>
            </Command.Item>
            <Command.Item onSelect={() => { setActiveTab('issue'); setCmdkOpen(false); }}>
              <span>⚡ Go to Issue Certificate</span>
              <kbd>Tab 2</kbd>
            </Command.Item>
            <Command.Item onSelect={() => { setActiveTab('endpoints'); setCmdkOpen(false); }}>
              <span>🌐 Go to Service Endpoints</span>
              <kbd>Tab 3</kbd>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Ecosystem Apps">
            <Command.Item onSelect={() => { window.open('/presentation.html', '_blank'); setCmdkOpen(false); }}>
              <span>🖥️ Open Interactive Presentation Deck</span>
            </Command.Item>
            <Command.Item onSelect={() => { window.open('/playground.html', '_blank'); setCmdkOpen(false); }}>
              <span>🧪 Open Developer PKI Playground</span>
            </Command.Item>
            <Command.Item onSelect={() => { window.open('/cheatsheet.html', '_blank'); setCmdkOpen(false); }}>
              <span>📄 Open Printable Cheat Sheet</span>
            </Command.Item>
            <Command.Item onSelect={() => { handleDownloadRootCA(); setCmdkOpen(false); }}>
              <span>🛡️ Download Root CA Certificate</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Inspect Certificates">
            {issuedCerts.map(cert => (
              <Command.Item
                key={cert.file}
                onSelect={() => {
                  setInspectCert(cert);
                  setInspectTab('details');
                  setCmdkOpen(false);
                }}
              >
                <span>🔍 Inspect {cert.domain} ({cert.file})</span>
                <span style={{ fontSize: '11px', color: '#64d2ff', fontFamily: '"SF Mono", monospace' }}>
                  {cert.algo}
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Quick Actions">
            <Command.Item onSelect={() => {
              copyToClipboard('84a033e84196f73bd593fad7a63e509e57fd982f02084359c4e8c5c864efc27d', 'CA Root Fingerprint Copied');
              setCmdkOpen(false);
            }}>
              <span>🔑 Copy step-ca Root Fingerprint</span>
            </Command.Item>
            <Command.Item onSelect={() => {
              window.open('https://localhost:9000/health', '_blank');
              setCmdkOpen(false);
            }}>
              <span>🩺 Check step-ca Health (:9000)</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </Theme>
  );
}
