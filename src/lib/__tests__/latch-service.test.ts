import { LatchService } from '../latch-service';
import { ToolCall, PolicyRule } from '@/types';

describe('LatchService', () => {
  let service: LatchService;

  beforeEach(() => {
    service = new LatchService(':memory:');
  });

  afterEach(() => {
    service.close();
  });

  describe('Packet Creation', () => {
    it('should create packet with auto-generated ID', () => {
      const toolCall: ToolCall = {
        tool: 'test_tool',
        parameters: { key: 'value' }
      };

      const packet = service.createPacket(toolCall);

      expect(packet.id).toBeTruthy();
      expect(packet.id.length).toBe(32);
      expect(packet.toolCall).toEqual(toolCall);
    });

    it('should include provenance in packet', () => {
      const toolCall: ToolCall = {
        tool: 'test',
        parameters: {}
      };

      const packet = service.createPacket(toolCall);

      expect(packet.provenance).toBeTruthy();
      expect(packet.provenance.policyHash).toBeTruthy();
      expect(packet.provenance.toolCallHash).toBeTruthy();
      expect(packet.provenance.boundHash).toBeTruthy();
    });

    it('should persist packet to database', () => {
      const toolCall: ToolCall = {
        tool: 'test',
        parameters: {}
      };

      const packet = service.createPacket(toolCall);
      const retrieved = service.getPacket(packet.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(packet.id);
    });
  });

  describe('Packet Retrieval', () => {
    it('should retrieve packet by ID', () => {
      const toolCall: ToolCall = {
        tool: 'test',
        parameters: {}
      };

      const created = service.createPacket(toolCall);
      const retrieved = service.getPacket(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent packet', () => {
      const packet = service.getPacket('non-existent-id');
      expect(packet).toBeNull();
    });

    it('should retrieve all packets', () => {
      service.createPacket({ tool: 'tool1', parameters: {} });
      service.createPacket({ tool: 'tool2', parameters: {} });

      const packets = service.getAllPackets();
      expect(packets.length).toBe(2);
    });

    it('should retrieve unsealed HOLD packets', () => {
      service.createPacket({ tool: 'list_dir', parameters: {} });
      service.createPacket({ tool: 'deploy_production', parameters: {} });

      const holds = service.getUnsealedHoldPackets();
      expect(holds.length).toBeGreaterThan(0);
      holds.forEach(p => {
        expect(p.verdict).toBe('HOLD');
        expect(p.sealed).toBe(false);
      });
    });
  });

  describe('Sealing', () => {
    it('should seal HOLD packet', () => {
      const packet = service.createPacket({
        tool: 'deploy',
        parameters: { environment: 'production' }
      });

      expect(packet.verdict).toBe('HOLD');

      const result = service.sealPacket({
        packetId: packet.id,
        sealedBy: 'admin'
      });

      expect(result.success).toBe(true);

      const sealed = service.getPacket(packet.id);
      expect(sealed?.sealed).toBe(true);
      expect(sealed?.sealedBy).toBe('admin');
    });

    it('should not seal non-HOLD packet', () => {
      const packet = service.createPacket({
        tool: 'list_dir',
        parameters: {}
      });

      expect(packet.verdict).toBe('OPEN');

      const result = service.sealPacket({
        packetId: packet.id,
        sealedBy: 'admin'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should not seal already sealed packet', () => {
      const packet = service.createPacket({
        tool: 'deploy',
        parameters: { environment: 'production' }
      });

      service.sealPacket({
        packetId: packet.id,
        sealedBy: 'admin1'
      });

      const result = service.sealPacket({
        packetId: packet.id,
        sealedBy: 'admin2'
      });

      expect(result.success).toBe(false);
    });

    it('should return error for non-existent packet', () => {
      const result = service.sealPacket({
        packetId: 'non-existent',
        sealedBy: 'admin'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Integrity Verification', () => {
    it('should verify untampered packet', () => {
      const packet = service.createPacket({
        tool: 'test',
        parameters: {}
      });

      const result = service.verifyPacketIntegrity(packet.id);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for non-existent packet', () => {
      const result = service.verifyPacketIntegrity('non-existent');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('Policy Management', () => {
    it('should return configured policies', () => {
      const policies = service.getPolicies();
      expect(policies.length).toBeGreaterThan(0);
    });

    it('should use custom policies when provided', () => {
      const customPolicies: PolicyRule[] = [{
        id: 'custom-1',
        pattern: 'custom_tool',
        riskClass: 'safe',
        action: 'OPEN',
        description: 'Custom policy'
      }];

      const customService = new LatchService(':memory:', customPolicies);
      const policies = customService.getPolicies();

      expect(policies.length).toBe(1);
      expect(policies[0].id).toBe('custom-1');

      customService.close();
    });
  });

  describe('FIXTURES - Required Test Cases', () => {
    describe('clear-open fixture', () => {
      it('should return OPEN for read-only list_dir', () => {
        const packet = service.createPacket({
          tool: 'list_dir',
          parameters: { path: '/home' }
        });

        expect(packet.verdict).toBe('OPEN');
        expect(packet.policyRuleId).toBe('clear-open');
      });

      it('should return OPEN for read operations', () => {
        const packet = service.createPacket({
          tool: 'read_file',
          parameters: { path: '/etc/config' }
        });

        expect(packet.verdict).toBe('OPEN');
      });
    });

    describe('deny-destructive fixture', () => {
      it('should return CLOSED for rm -rf /', () => {
        const packet = service.createPacket({
          tool: 'shell_execute',
          parameters: { command: 'rm -rf /' }
        });

        expect(packet.verdict).toBe('CLOSED');
        expect(packet.policyRuleId).toBe('deny-destructive');
      });

      it('should return CLOSED for format operations', () => {
        const packet = service.createPacket({
          tool: 'format_disk',
          parameters: { disk: '/dev/sda' }
        });

        expect(packet.verdict).toBe('CLOSED');
      });
    });

    describe('hold-deploy fixture', () => {
      it('should return HOLD for production deploy', () => {
        const packet = service.createPacket({
          tool: 'deploy',
          parameters: { environment: 'production' }
        });

        expect(packet.verdict).toBe('HOLD');
        expect(packet.sealed).toBe(false);
      });

      it('should be sealable by human', () => {
        const packet = service.createPacket({
          tool: 'prod_deploy',
          parameters: { app: 'main' }
        });

        expect(packet.verdict).toBe('HOLD');

        const result = service.sealPacket({
          packetId: packet.id,
          sealedBy: 'human-operator'
        });

        expect(result.success).toBe(true);

        const sealed = service.getPacket(packet.id);
        expect(sealed?.sealed).toBe(true);
        expect(sealed?.sealedBy).toBe('human-operator');
      });
    });

    describe('tampered-policy fixture', () => {
      it('should detect provenance mismatch when policy changes', () => {
        const originalPolicies: PolicyRule[] = [{
          id: 'original',
          pattern: 'test',
          riskClass: 'safe',
          action: 'OPEN',
          description: 'Original'
        }];

        const changedPolicies: PolicyRule[] = [{
          id: 'changed',
          pattern: 'test',
          riskClass: 'destructive',
          action: 'CLOSED',
          description: 'Changed'
        }];

        const customService = new LatchService(':memory:', originalPolicies);
        const packet = customService.createPacket({
          tool: 'test',
          parameters: {}
        });

        const originalVerification = customService.verifyPacketIntegrity(packet.id);
        expect(originalVerification.valid).toBe(true);

        const changedService = new LatchService(':memory:', changedPolicies);
        (changedService as any).db.savePacket(packet);

        const verification = changedService.verifyPacketIntegrity(packet.id);
        expect(verification.valid).toBe(false);
        expect(verification.reason).toContain('Policy');

        customService.close();
        changedService.close();
      });
    });

    describe('spend-over-cap fixture', () => {
      it('should return HOLD when spend exceeds cap', () => {
        const packet = service.createPacket({
          tool: 'purchase_api_call',
          parameters: { amount: 150 }
        });

        expect(packet.verdict).toBe('HOLD');
        expect(packet.reason).toContain('cap');
      });

      it('should return OPEN when spend is under cap', () => {
        const packet = service.createPacket({
          tool: 'purchase_api_call',
          parameters: { amount: 50 }
        });

        expect(packet.verdict).toBe('OPEN');
      });
    });
  });
});
