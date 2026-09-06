import Database from 'better-sqlite3';
import { LatchPacket, PolicyRule, VerdictStatus } from '@/types';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export class LatchDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || this.getDefaultPath();
    
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(path);
    this.initialize();
  }

  private getDefaultPath(): string {
    if (process.env.NODE_ENV === 'test') {
      return ':memory:';
    }
    return join(process.cwd(), 'data', 'latch.db');
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS packets (
        id TEXT PRIMARY KEY,
        tool_call TEXT NOT NULL,
        verdict TEXT NOT NULL,
        policy_rule_id TEXT,
        provenance TEXT NOT NULL,
        sealed INTEGER NOT NULL DEFAULT 0,
        sealed_by TEXT,
        sealed_at INTEGER,
        created_at INTEGER NOT NULL,
        reason TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_packets_verdict ON packets(verdict);
      CREATE INDEX IF NOT EXISTS idx_packets_sealed ON packets(sealed);
      CREATE INDEX IF NOT EXISTS idx_packets_created_at ON packets(created_at);

      CREATE TABLE IF NOT EXISTS policy_rules (
        id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        risk_class TEXT NOT NULL,
        action TEXT NOT NULL,
        spend_cap REAL,
        description TEXT NOT NULL
      );
    `);
  }

  savePacket(packet: LatchPacket): void {
    const stmt = this.db.prepare(`
      INSERT INTO packets (
        id, tool_call, verdict, policy_rule_id, provenance,
        sealed, sealed_by, sealed_at, created_at, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      packet.id,
      JSON.stringify(packet.toolCall),
      packet.verdict,
      packet.policyRuleId,
      JSON.stringify(packet.provenance),
      packet.sealed ? 1 : 0,
      packet.sealedBy || null,
      packet.sealedAt || null,
      packet.createdAt,
      packet.reason
    );
  }

  getPacket(id: string): LatchPacket | null {
    const stmt = this.db.prepare('SELECT * FROM packets WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.rowToPacket(row);
  }

  getAllPackets(): LatchPacket[] {
    const stmt = this.db.prepare('SELECT * FROM packets ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToPacket(row));
  }

  getPacketsByVerdict(verdict: VerdictStatus): LatchPacket[] {
    const stmt = this.db.prepare('SELECT * FROM packets WHERE verdict = ? ORDER BY created_at DESC');
    const rows = stmt.all(verdict) as any[];
    return rows.map(row => this.rowToPacket(row));
  }

  getUnsealedHoldPackets(): LatchPacket[] {
    const stmt = this.db.prepare(
      'SELECT * FROM packets WHERE verdict = ? AND sealed = 0 ORDER BY created_at DESC'
    );
    const rows = stmt.all('HOLD') as any[];
    return rows.map(row => this.rowToPacket(row));
  }

  sealPacket(id: string, sealedBy: string): boolean {
    const packet = this.getPacket(id);
    
    if (!packet) return false;
    if (packet.verdict !== 'HOLD') return false;
    if (packet.sealed) return false;

    const stmt = this.db.prepare(`
      UPDATE packets
      SET sealed = 1, sealed_by = ?, sealed_at = ?
      WHERE id = ? AND verdict = 'HOLD' AND sealed = 0
    `);

    const result = stmt.run(sealedBy, Date.now(), id);
    return result.changes > 0;
  }

  savePolicyRules(rules: PolicyRule[]): void {
    this.db.exec('DELETE FROM policy_rules');
    
    const stmt = this.db.prepare(`
      INSERT INTO policy_rules (id, pattern, risk_class, action, spend_cap, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const rule of rules) {
      stmt.run(
        rule.id,
        rule.pattern,
        rule.riskClass,
        rule.action,
        rule.spendCap || null,
        rule.description
      );
    }
  }

  getPolicyRules(): PolicyRule[] {
    const stmt = this.db.prepare('SELECT * FROM policy_rules');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      pattern: row.pattern,
      riskClass: row.risk_class,
      action: row.action,
      spendCap: row.spend_cap,
      description: row.description
    }));
  }

  private rowToPacket(row: any): LatchPacket {
    const packet: LatchPacket = {
      id: row.id,
      toolCall: JSON.parse(row.tool_call),
      verdict: row.verdict,
      policyRuleId: row.policy_rule_id,
      provenance: JSON.parse(row.provenance),
      sealed: row.sealed === 1,
      createdAt: row.created_at,
      reason: row.reason
    };

    if (row.sealed_by) {
      packet.sealedBy = row.sealed_by;
    }
    if (row.sealed_at) {
      packet.sealedAt = row.sealed_at;
    }

    return packet;
  }

  close(): void {
    this.db.close();
  }
}
