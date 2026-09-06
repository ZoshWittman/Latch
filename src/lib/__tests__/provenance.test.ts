import { hashObject, createProvenance, verifyProvenance, getPolicyHash } from '../provenance';
import { ToolCall } from '@/types';

describe('Provenance', () => {
  describe('hashObject', () => {
    it('should produce consistent hashes for same object', () => {
      const obj = { a: 1, b: 2 };
      const hash1 = hashObject(obj);
      const hash2 = hashObject(obj);
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash regardless of key order', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, a: 1 };
      expect(hashObject(obj1)).toBe(hashObject(obj2));
    });

    it('should produce different hashes for different objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      expect(hashObject(obj1)).not.toBe(hashObject(obj2));
    });

    it('should handle nested objects', () => {
      const obj = { a: { b: { c: 1 } } };
      const hash = hashObject(obj);
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it('should produce 64 character SHA-256 hash', () => {
      const hash = hashObject({ test: 'value' });
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('createProvenance', () => {
    it('should create valid provenance structure', () => {
      const toolCall: ToolCall = {
        tool: 'test_tool',
        parameters: { param: 'value' }
      };
      const policyHash = 'abc123';
      
      const provenance = createProvenance(policyHash, toolCall);
      
      expect(provenance).toHaveProperty('policyHash', policyHash);
      expect(provenance).toHaveProperty('toolCallHash');
      expect(provenance).toHaveProperty('timestamp');
      expect(provenance).toHaveProperty('boundHash');
    });

    it('should generate unique bound hash', () => {
      const toolCall: ToolCall = {
        tool: 'test_tool',
        parameters: { param: 'value' }
      };
      
      const prov1 = createProvenance('hash1', toolCall);
      const prov2 = createProvenance('hash2', toolCall);
      
      expect(prov1.boundHash).not.toBe(prov2.boundHash);
    });

    it('should include timestamp in provenance', () => {
      const toolCall: ToolCall = {
        tool: 'test_tool',
        parameters: {}
      };
      
      const before = Date.now();
      const provenance = createProvenance('hash', toolCall);
      const after = Date.now();
      
      expect(provenance.timestamp).toBeGreaterThanOrEqual(before);
      expect(provenance.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('verifyProvenance', () => {
    it('should verify valid provenance', () => {
      const toolCall: ToolCall = {
        tool: 'test_tool',
        parameters: { param: 'value' }
      };
      const policyHash = 'test_hash';
      
      const provenance = createProvenance(policyHash, toolCall);
      const result = verifyProvenance(provenance, policyHash, toolCall);
      
      expect(result.valid).toBe(true);
    });

    it('should detect tampered tool call', () => {
      const originalToolCall: ToolCall = {
        tool: 'test_tool',
        parameters: { param: 'value' }
      };
      const tamperedToolCall: ToolCall = {
        tool: 'different_tool',
        parameters: { param: 'value' }
      };
      const policyHash = 'test_hash';
      
      const provenance = createProvenance(policyHash, originalToolCall);
      const result = verifyProvenance(provenance, policyHash, tamperedToolCall);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('tampered');
    });

    it('should detect modified policy', () => {
      const toolCall: ToolCall = {
        tool: 'test_tool',
        parameters: { param: 'value' }
      };
      const originalPolicyHash = 'original_hash';
      const newPolicyHash = 'new_hash';
      
      const provenance = createProvenance(originalPolicyHash, toolCall);
      const result = verifyProvenance(provenance, newPolicyHash, toolCall);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Policy');
    });

    it('should detect corrupted binding', () => {
      const toolCall: ToolCall = {
        tool: 'test_tool',
        parameters: { param: 'value' }
      };
      const policyHash = 'test_hash';
      
      const provenance = createProvenance(policyHash, toolCall);
      provenance.boundHash = 'corrupted_hash';
      
      const result = verifyProvenance(provenance, policyHash, toolCall);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('corrupted');
    });
  });

  describe('getPolicyHash', () => {
    it('should generate hash from policy rules array', () => {
      const rules = [
        { id: '1', pattern: 'test', action: 'OPEN' },
        { id: '2', pattern: 'test2', action: 'CLOSED' }
      ];
      
      const hash = getPolicyHash(rules);
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it('should produce same hash for same rules', () => {
      const rules = [{ id: '1', pattern: 'test' }];
      
      const hash1 = getPolicyHash(rules);
      const hash2 = getPolicyHash(rules);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash when rules change', () => {
      const rules1 = [{ id: '1', pattern: 'test' }];
      const rules2 = [{ id: '1', pattern: 'different' }];
      
      expect(getPolicyHash(rules1)).not.toBe(getPolicyHash(rules2));
    });
  });
});
