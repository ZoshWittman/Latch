import { randomBytes } from 'crypto';
import { LatchDatabase } from './database';
import { PolicyEngine, DEFAULT_POLICIES } from './policy-engine';
import { createProvenance, verifyProvenance, getPolicyHash } from './provenance';
import {
  LatchPacket,
  ToolCall,
  PolicyRule,
  SealRequest,
  TamperCheckResult
} from '@/types';

export class LatchService {
  private db: LatchDatabase;
  private policyEngine: PolicyEngine;
  private policyHash: string;

  constructor(dbPath?: string, customPolicies?: PolicyRule[]) {
    this.db = new LatchDatabase(dbPath);
    
    const policies = customPolicies || DEFAULT_POLICIES;
    this.policyEngine = new PolicyEngine(policies);
    this.policyHash = getPolicyHash(policies);
    
    this.db.savePolicyRules(policies);
  }

  createPacket(toolCall: ToolCall): LatchPacket {
    const evaluation = this.policyEngine.evaluate(toolCall);
    const provenance = createProvenance(this.policyHash, toolCall);

    const packet: LatchPacket = {
      id: this.generateId(),
      toolCall,
      verdict: evaluation.verdict,
      policyRuleId: evaluation.matchedRule?.id || null,
      provenance,
      sealed: false,
      createdAt: Date.now(),
      reason: evaluation.reason
    };

    this.db.savePacket(packet);
    return packet;
  }

  getPacket(id: string): LatchPacket | null {
    return this.db.getPacket(id);
  }

  getAllPackets(): LatchPacket[] {
    return this.db.getAllPackets();
  }

  getUnsealedHoldPackets(): LatchPacket[] {
    return this.db.getUnsealedHoldPackets();
  }

  sealPacket(request: SealRequest): { success: boolean; error?: string } {
    const packet = this.db.getPacket(request.packetId);

    if (!packet) {
      return { success: false, error: 'Packet not found' };
    }

    if (packet.verdict !== 'HOLD') {
      return { success: false, error: 'Only HOLD packets can be sealed' };
    }

    if (packet.sealed) {
      return { success: false, error: 'Packet is already sealed' };
    }

    const success = this.db.sealPacket(request.packetId, request.sealedBy);

    if (!success) {
      return { success: false, error: 'Failed to seal packet' };
    }

    return { success: true };
  }

  verifyPacketIntegrity(packetId: string): TamperCheckResult {
    const packet = this.db.getPacket(packetId);

    if (!packet) {
      return { valid: false, reason: 'Packet not found' };
    }

    return verifyProvenance(
      packet.provenance,
      this.policyHash,
      packet.toolCall
    );
  }

  getPolicies(): PolicyRule[] {
    return this.policyEngine.getRules();
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  close(): void {
    this.db.close();
  }
}
