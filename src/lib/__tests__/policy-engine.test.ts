import { PolicyEngine, DEFAULT_POLICIES } from '../policy-engine';
import { ToolCall, PolicyRule } from '@/types';

describe('PolicyEngine', () => {
  describe('Pattern Matching', () => {
    it('should match exact tool name', () => {
      const rules: PolicyRule[] = [{
        id: 'test-read',
        pattern: 'list_dir',
        riskClass: 'safe',
        action: 'OPEN',
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const toolCall: ToolCall = {
        tool: 'list_dir',
        parameters: {}
      };
      
      const result = engine.evaluate(toolCall);
      expect(result.verdict).toBe('OPEN');
      expect(result.matchedRule?.id).toBe('test-read');
    });

    it('should match partial tool name', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'read',
        riskClass: 'safe',
        action: 'OPEN',
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const result = engine.evaluate({
        tool: 'read_file',
        parameters: {}
      });
      
      expect(result.verdict).toBe('OPEN');
    });

    it('should match wildcard patterns', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'read*',
        riskClass: 'safe',
        action: 'OPEN',
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      
      expect(engine.evaluate({ tool: 'read_file', parameters: {} }).verdict).toBe('OPEN');
      expect(engine.evaluate({ tool: 'read_dir', parameters: {} }).verdict).toBe('OPEN');
    });

    it('should be case insensitive', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'DELETE',
        riskClass: 'moderate',
        action: 'HOLD',
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const result = engine.evaluate({ tool: 'delete', parameters: {} });
      
      expect(result.verdict).toBe('HOLD');
    });

    it('should match patterns in parameters', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'production',
        riskClass: 'production',
        action: 'HOLD',
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const result = engine.evaluate({
        tool: 'deploy',
        parameters: { environment: 'production' }
      });
      
      expect(result.verdict).toBe('HOLD');
    });

    it('should use first matching rule', () => {
      const rules: PolicyRule[] = [
        {
          id: 'first',
          pattern: 'test',
          riskClass: 'safe',
          action: 'OPEN',
          description: 'First'
        },
        {
          id: 'second',
          pattern: 'test',
          riskClass: 'moderate',
          action: 'CLOSED',
          description: 'Second'
        }
      ];
      
      const engine = new PolicyEngine(rules);
      const result = engine.evaluate({ tool: 'test', parameters: {} });
      
      expect(result.matchedRule?.id).toBe('first');
      expect(result.verdict).toBe('OPEN');
    });
  });

  describe('Spend Cap Enforcement', () => {
    it('should allow operations under spend cap', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'purchase',
        riskClass: 'moderate',
        action: 'OPEN',
        spendCap: 100,
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const result = engine.evaluate({
        tool: 'purchase',
        parameters: { amount: 50 }
      });
      
      expect(result.verdict).toBe('OPEN');
    });

    it('should hold operations over spend cap', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'purchase',
        riskClass: 'moderate',
        action: 'OPEN',
        spendCap: 100,
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const result = engine.evaluate({
        tool: 'purchase',
        parameters: { amount: 150 }
      });
      
      expect(result.verdict).toBe('HOLD');
      expect(result.reason).toContain('cap');
    });

    it('should check cost parameter', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'buy',
        riskClass: 'moderate',
        action: 'OPEN',
        spendCap: 100,
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const result = engine.evaluate({
        tool: 'buy',
        parameters: { cost: 200 }
      });
      
      expect(result.verdict).toBe('HOLD');
    });

    it('should check price parameter', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'order',
        riskClass: 'moderate',
        action: 'OPEN',
        spendCap: 50,
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const result = engine.evaluate({
        tool: 'order',
        parameters: { price: 75 }
      });
      
      expect(result.verdict).toBe('HOLD');
    });

    it('should check metadata for spend values', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'transaction',
        riskClass: 'moderate',
        action: 'OPEN',
        spendCap: 100,
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const result = engine.evaluate({
        tool: 'transaction',
        parameters: {},
        metadata: { amount: 150 }
      });
      
      expect(result.verdict).toBe('HOLD');
    });
  });

  describe('Default Behavior', () => {
    it('should default to HOLD for unmatched patterns', () => {
      const engine = new PolicyEngine([]);
      const result = engine.evaluate({
        tool: 'unknown_tool',
        parameters: {}
      });
      
      expect(result.verdict).toBe('HOLD');
      expect(result.matchedRule).toBeNull();
      expect(result.reason).toContain('No matching');
    });
  });

  describe('Default Policies', () => {
    const engine = new PolicyEngine(DEFAULT_POLICIES);

    it('should allow list_dir operations', () => {
      const result = engine.evaluate({
        tool: 'list_dir',
        parameters: { path: '/home' }
      });
      
      expect(result.verdict).toBe('OPEN');
    });

    it('should block rm -rf operations', () => {
      const result = engine.evaluate({
        tool: 'shell',
        parameters: { command: 'rm -rf /' }
      });
      
      expect(result.verdict).toBe('CLOSED');
    });

    it('should hold production deploys', () => {
      const result = engine.evaluate({
        tool: 'deploy',
        parameters: { environment: 'production' }
      });
      
      expect(result.verdict).toBe('HOLD');
    });

    it('should allow read operations', () => {
      const result = engine.evaluate({
        tool: 'read_file',
        parameters: {}
      });
      
      expect(result.verdict).toBe('OPEN');
    });
  });

  describe('getRules', () => {
    it('should return copy of rules', () => {
      const rules: PolicyRule[] = [{
        id: 'test',
        pattern: 'test',
        riskClass: 'safe',
        action: 'OPEN',
        description: 'Test'
      }];
      
      const engine = new PolicyEngine(rules);
      const returned = engine.getRules();
      
      expect(returned).toEqual(rules);
      expect(returned).not.toBe(rules);
    });
  });
});
