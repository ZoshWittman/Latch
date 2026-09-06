export type VerdictStatus = 'OPEN' | 'CLOSED' | 'HOLD';

export interface ToolCall {
  tool: string;
  parameters: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface PolicyRule {
  id: string;
  pattern: string;
  riskClass: 'safe' | 'moderate' | 'destructive' | 'production';
  action: VerdictStatus;
  spendCap?: number;
  description: string;
}

export interface Provenance {
  policyHash: string;
  toolCallHash: string;
  timestamp: number;
  boundHash: string;
}

export interface LatchPacket {
  id: string;
  toolCall: ToolCall;
  verdict: VerdictStatus;
  policyRuleId: string | null;
  provenance: Provenance;
  sealed: boolean;
  sealedBy?: string;
  sealedAt?: number;
  createdAt: number;
  reason: string;
}

export interface PolicyEvaluationResult {
  verdict: VerdictStatus;
  matchedRule: PolicyRule | null;
  reason: string;
}

export interface SealRequest {
  packetId: string;
  sealedBy: string;
}

export interface CreatePacketRequest {
  toolCall: ToolCall;
}

export interface TamperCheckResult {
  valid: boolean;
  reason?: string;
}
