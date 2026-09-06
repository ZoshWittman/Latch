'use client';

import { useState, useEffect } from 'react';
import { LatchPacket } from '@/types';

export default function Home() {
  const [packets, setPackets] = useState<LatchPacket[]>([]);
  const [filter, setFilter] = useState<'all' | 'OPEN' | 'CLOSED' | 'HOLD'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackets();
  }, []);

  const fetchPackets = async () => {
    try {
      const response = await fetch('/api/packets');
      const data = await response.json();
      setPackets(data.packets);
    } catch (error) {
      console.error('Failed to fetch packets:', error);
    } finally {
      setLoading(false);
    }
  };

  const sealPacket = async (id: string) => {
    const sealedBy = prompt('Enter your name to seal this packet:');
    if (!sealedBy) return;

    try {
      await fetch(`/api/packets/${id}/seal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sealedBy })
      });
      fetchPackets();
    } catch (error) {
      console.error('Failed to seal packet:', error);
      alert('Failed to seal packet');
    }
  };

  const filteredPackets = packets.filter(
    p => filter === 'all' || p.verdict === filter
  );

  const stats = {
    total: packets.length,
    open: packets.filter(p => p.verdict === 'OPEN').length,
    closed: packets.filter(p => p.verdict === 'CLOSED').length,
    hold: packets.filter(p => p.verdict === 'HOLD' && !p.sealed).length,
    sealed: packets.filter(p => p.sealed).length
  };

  if (loading) {
    return (
      <div className="container">
        <div className="header">
          <h1>Latch</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Latch</h1>
        <p>Action-boundary desk for agent tool calls</p>
      </div>

      <div className="stats">
        <div className="stat-card">
          <h3>Total Packets</h3>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <h3>Open</h3>
          <div className="value" style={{ color: '#28a745' }}>{stats.open}</div>
        </div>
        <div className="stat-card">
          <h3>Closed</h3>
          <div className="value" style={{ color: '#dc3545' }}>{stats.closed}</div>
        </div>
        <div className="stat-card">
          <h3>Hold (Unsealed)</h3>
          <div className="value" style={{ color: '#ffc107' }}>{stats.hold}</div>
        </div>
        <div className="stat-card">
          <h3>Sealed</h3>
          <div className="value" style={{ color: '#17a2b8' }}>{stats.sealed}</div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`tab ${filter === 'OPEN' ? 'active' : ''}`}
          onClick={() => setFilter('OPEN')}
        >
          Open
        </button>
        <button
          className={`tab ${filter === 'CLOSED' ? 'active' : ''}`}
          onClick={() => setFilter('CLOSED')}
        >
          Closed
        </button>
        <button
          className={`tab ${filter === 'HOLD' ? 'active' : ''}`}
          onClick={() => setFilter('HOLD')}
        >
          Hold
        </button>
      </div>

      {filteredPackets.length === 0 ? (
        <div className="card">
          <p>No packets found. Use the CLI or API to create packets.</p>
        </div>
      ) : (
        filteredPackets.map(packet => (
          <div key={packet.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <span className={`badge ${packet.verdict.toLowerCase()}`}>
                  {packet.verdict}
                </span>
                {packet.sealed && (
                  <span className="badge sealed" style={{ marginLeft: '10px' }}>
                    SEALED
                  </span>
                )}
              </div>
              {packet.verdict === 'HOLD' && !packet.sealed && (
                <button
                  className="button"
                  onClick={() => sealPacket(packet.id)}
                >
                  Seal
                </button>
              )}
            </div>

            <h3 style={{ marginBottom: '10px' }}>
              <code>{packet.toolCall.tool}</code>
            </h3>

            <p style={{ color: '#666', marginBottom: '10px' }}>
              {packet.reason}
            </p>

            <details>
              <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                Details
              </summary>
              <div>
                <p><strong>ID:</strong> <code>{packet.id}</code></p>
                <p><strong>Created:</strong> {new Date(packet.createdAt).toLocaleString()}</p>
                {packet.policyRuleId && (
                  <p><strong>Policy Rule:</strong> <code>{packet.policyRuleId}</code></p>
                )}
                {packet.sealed && (
                  <>
                    <p><strong>Sealed By:</strong> {packet.sealedBy}</p>
                    <p><strong>Sealed At:</strong> {new Date(packet.sealedAt!).toLocaleString()}</p>
                  </>
                )}
                <p><strong>Parameters:</strong></p>
                <pre>{JSON.stringify(packet.toolCall.parameters, null, 2)}</pre>
              </div>
            </details>
          </div>
        ))
      )}
    </div>
  );
}
