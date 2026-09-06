import { createHash } from 'crypto';
import { ToolCall, Provenance, TamperCheckResult } from '@/types';

function deepSort(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepSort);
  }
  
  const sorted: any = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = deepSort(obj[key]);
  });
  return sorted;
}

export function hashObject(obj: any): string {
  const normalized = JSON.stringify(deepSort(obj));
  return createHash('sha256').update(normalized).digest('hex');
}

export function createProvenance(
  policyHash: string,
  toolCall: ToolCall
): Provenance {
  const toolCallHash = hashObject(toolCall);
  const timestamp = Date.now();
  
  const boundData = {
    policyHash,
    toolCallHash,
    timestamp
  };
  
  const boundHash = hashObject(boundData);
  
  return {
    policyHash,
    toolCallHash,
    timestamp,
    boundHash
  };
}

export function verifyProvenance(
  provenance: Provenance,
  currentPolicyHash: string,
  toolCall: ToolCall
): TamperCheckResult {
  const currentToolCallHash = hashObject(toolCall);
  
  if (provenance.toolCallHash !== currentToolCallHash) {
    return {
      valid: false,
      reason: 'Tool call has been tampered with'
    };
  }
  
  if (provenance.policyHash !== currentPolicyHash) {
    return {
      valid: false,
      reason: 'Policy has been modified since packet creation'
    };
  }
  
  const reconstructedBoundData = {
    policyHash: provenance.policyHash,
    toolCallHash: provenance.toolCallHash,
    timestamp: provenance.timestamp
  };
  
  const reconstructedHash = hashObject(reconstructedBoundData);
  
  if (provenance.boundHash !== reconstructedHash) {
    return {
      valid: false,
      reason: 'Provenance binding has been corrupted'
    };
  }
  
  return { valid: true };
}

export function getPolicyHash(rules: any[]): string {
  return hashObject(rules);
}
