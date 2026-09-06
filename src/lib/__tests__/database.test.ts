import { LatchDatabase } from '../database';
import { LatchPacket, PolicyRule } from '@/types';

describe('LatchDatabase', () => {
  let db: LatchDatabase;

  beforeEach(() => {
    db = new LatchDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('Packet Operations', () => {
    it('should save and retrieve packet', () => {
      const packet: LatchPacket = {
        id: 'test-123',
        toolCall: { tool: 'test_tool', parameters: { key: 'value' } },
        verdict: 'OPEN',
        policyRuleId: 'rule-1',
        provenance: {
          policyHash: 'hash1',
          toolCallHash: 'hash2',
          timestamp: Date.now(),
          boundHash: 'hash3'
        },
        sealed: false,
        createdAt: Date.now(),
        reason: 'Test reason'
      };

      db.savePacket(packet);
      const retrieved = db.getPacket('test-123');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(packet.id);
      expect(retrieved?.verdict).toBe(packet.verdict);
      expect(retrieved?.toolCall.tool).toBe('test_tool');
    });

    it('should return null for non-existent packet', () => {
      const packet = db.getPacket('non-existent');
      expect(packet).toBeNull();
    });

    it('should retrieve all packets', () => {
      const packet1: LatchPacket = {
        id: 'test-1',
        toolCall: { tool: 'tool1', parameters: {} },
        verdict: 'OPEN',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: false,
        createdAt: Date.now(),
        reason: 'Test'
      };

      const packet2: LatchPacket = {
        id: 'test-2',
        toolCall: { tool: 'tool2', parameters: {} },
        verdict: 'CLOSED',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: false,
        createdAt: Date.now() + 1000,
        reason: 'Test'
      };

      db.savePacket(packet1);
      db.savePacket(packet2);

      const packets = db.getAllPackets();
      expect(packets.length).toBe(2);
    });

    it('should filter packets by verdict', () => {
      const openPacket: LatchPacket = {
        id: 'open-1',
        toolCall: { tool: 'tool', parameters: {} },
        verdict: 'OPEN',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: false,
        createdAt: Date.now(),
        reason: 'Test'
      };

      const closedPacket: LatchPacket = {
        id: 'closed-1',
        toolCall: { tool: 'tool', parameters: {} },
        verdict: 'CLOSED',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: false,
        createdAt: Date.now(),
        reason: 'Test'
      };

      db.savePacket(openPacket);
      db.savePacket(closedPacket);

      const openPackets = db.getPacketsByVerdict('OPEN');
      expect(openPackets.length).toBe(1);
      expect(openPackets[0].verdict).toBe('OPEN');

      const closedPackets = db.getPacketsByVerdict('CLOSED');
      expect(closedPackets.length).toBe(1);
      expect(closedPackets[0].verdict).toBe('CLOSED');
    });
  });

  describe('Seal Operations', () => {
    it('should seal unsealed HOLD packet', () => {
      const packet: LatchPacket = {
        id: 'hold-1',
        toolCall: { tool: 'tool', parameters: {} },
        verdict: 'HOLD',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: false,
        createdAt: Date.now(),
        reason: 'Test'
      };

      db.savePacket(packet);
      const result = db.sealPacket('hold-1', 'test-user');

      expect(result).toBe(true);

      const sealed = db.getPacket('hold-1');
      expect(sealed?.sealed).toBe(true);
      expect(sealed?.sealedBy).toBe('test-user');
      expect(sealed?.sealedAt).toBeTruthy();
    });

    it('should not seal non-HOLD packet', () => {
      const packet: LatchPacket = {
        id: 'open-1',
        toolCall: { tool: 'tool', parameters: {} },
        verdict: 'OPEN',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: false,
        createdAt: Date.now(),
        reason: 'Test'
      };

      db.savePacket(packet);
      const result = db.sealPacket('open-1', 'test-user');

      expect(result).toBe(false);
    });

    it('should not seal already sealed packet', () => {
      const packet: LatchPacket = {
        id: 'hold-1',
        toolCall: { tool: 'tool', parameters: {} },
        verdict: 'HOLD',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: true,
        sealedBy: 'first-user',
        sealedAt: Date.now(),
        createdAt: Date.now(),
        reason: 'Test'
      };

      db.savePacket(packet);
      const result = db.sealPacket('hold-1', 'second-user');

      expect(result).toBe(false);
    });

    it('should return false for non-existent packet', () => {
      const result = db.sealPacket('non-existent', 'test-user');
      expect(result).toBe(false);
    });

    it('should retrieve unsealed HOLD packets', () => {
      const holdUnsealed: LatchPacket = {
        id: 'hold-unsealed',
        toolCall: { tool: 'tool', parameters: {} },
        verdict: 'HOLD',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: false,
        createdAt: Date.now(),
        reason: 'Test'
      };

      const holdSealed: LatchPacket = {
        id: 'hold-sealed',
        toolCall: { tool: 'tool', parameters: {} },
        verdict: 'HOLD',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: true,
        sealedBy: 'user',
        sealedAt: Date.now(),
        createdAt: Date.now(),
        reason: 'Test'
      };

      const openPacket: LatchPacket = {
        id: 'open',
        toolCall: { tool: 'tool', parameters: {} },
        verdict: 'OPEN',
        policyRuleId: null,
        provenance: {
          policyHash: 'h1',
          toolCallHash: 'h2',
          timestamp: Date.now(),
          boundHash: 'h3'
        },
        sealed: false,
        createdAt: Date.now(),
        reason: 'Test'
      };

      db.savePacket(holdUnsealed);
      db.savePacket(holdSealed);
      db.savePacket(openPacket);

      const unsealed = db.getUnsealedHoldPackets();
      expect(unsealed.length).toBe(1);
      expect(unsealed[0].id).toBe('hold-unsealed');
    });
  });

  describe('Policy Rules', () => {
    it('should save and retrieve policy rules', () => {
      const rules: PolicyRule[] = [
        {
          id: 'rule-1',
          pattern: 'test*',
          riskClass: 'safe',
          action: 'OPEN',
          description: 'Test rule'
        },
        {
          id: 'rule-2',
          pattern: 'dangerous',
          riskClass: 'destructive',
          action: 'CLOSED',
          spendCap: 100,
          description: 'Dangerous rule'
        }
      ];

      db.savePolicyRules(rules);
      const retrieved = db.getPolicyRules();

      expect(retrieved.length).toBe(2);
      expect(retrieved[0].id).toBe('rule-1');
      expect(retrieved[1].spendCap).toBe(100);
    });

    it('should replace existing rules when saving', () => {
      const rules1: PolicyRule[] = [{
        id: 'rule-1',
        pattern: 'test',
        riskClass: 'safe',
        action: 'OPEN',
        description: 'Test'
      }];

      const rules2: PolicyRule[] = [{
        id: 'rule-2',
        pattern: 'new',
        riskClass: 'moderate',
        action: 'HOLD',
        description: 'New'
      }];

      db.savePolicyRules(rules1);
      db.savePolicyRules(rules2);

      const retrieved = db.getPolicyRules();
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].id).toBe('rule-2');
    });
  });
});
