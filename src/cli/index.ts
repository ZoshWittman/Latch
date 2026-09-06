#!/usr/bin/env node

import { Command } from 'commander';
import { LatchService } from '../lib/latch-service';
import { ToolCall } from '../types';

const program = new Command();

program
  .name('latch')
  .description('CLI for Latch - Action-boundary desk for agent tool calls')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new latch packet')
  .requiredOption('-t, --tool <tool>', 'Tool name')
  .requiredOption('-p, --parameters <json>', 'Tool parameters as JSON')
  .action((options) => {
    try {
      const parameters = JSON.parse(options.parameters);
      const toolCall: ToolCall = {
        tool: options.tool,
        parameters
      };

      const service = new LatchService();
      const packet = service.createPacket(toolCall);
      
      console.log('\n✓ Packet created');
      console.log('─────────────────');
      console.log(`ID:      ${packet.id}`);
      console.log(`Verdict: ${packet.verdict}`);
      console.log(`Reason:  ${packet.reason}`);
      console.log(`Tool:    ${packet.toolCall.tool}`);
      
      if (packet.verdict === 'HOLD') {
        console.log('\n⚠ This packet requires human seal. Use: latch seal ' + packet.id);
      }
      
      service.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all packets')
  .option('-v, --verdict <verdict>', 'Filter by verdict (OPEN, CLOSED, HOLD)')
  .action((options) => {
    try {
      const service = new LatchService();
      let packets = service.getAllPackets();

      if (options.verdict) {
        packets = packets.filter(p => p.verdict === options.verdict);
      }

      if (packets.length === 0) {
        console.log('No packets found.');
        service.close();
        return;
      }

      console.log(`\nFound ${packets.length} packet(s)`);
      console.log('═══════════════════════════════════════════════════════════\n');

      for (const packet of packets) {
        const sealed = packet.sealed ? ' [SEALED]' : '';
        console.log(`${packet.verdict}${sealed} - ${packet.toolCall.tool}`);
        console.log(`  ID: ${packet.id}`);
        console.log(`  ${packet.reason}`);
        console.log(`  Created: ${new Date(packet.createdAt).toLocaleString()}\n`);
      }

      service.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('get')
  .description('Get a specific packet')
  .argument('<id>', 'Packet ID')
  .action((id) => {
    try {
      const service = new LatchService();
      const packet = service.getPacket(id);

      if (!packet) {
        console.error('Packet not found');
        service.close();
        process.exit(1);
      }

      console.log('\nPacket Details');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`ID:          ${packet.id}`);
      console.log(`Verdict:     ${packet.verdict}`);
      console.log(`Sealed:      ${packet.sealed ? 'Yes' : 'No'}`);
      console.log(`Tool:        ${packet.toolCall.tool}`);
      console.log(`Reason:      ${packet.reason}`);
      console.log(`Created:     ${new Date(packet.createdAt).toLocaleString()}`);
      
      if (packet.policyRuleId) {
        console.log(`Policy Rule: ${packet.policyRuleId}`);
      }
      
      if (packet.sealed) {
        console.log(`Sealed By:   ${packet.sealedBy}`);
        console.log(`Sealed At:   ${new Date(packet.sealedAt!).toLocaleString()}`);
      }

      console.log('\nParameters:');
      console.log(JSON.stringify(packet.toolCall.parameters, null, 2));

      service.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('seal')
  .description('Seal a HOLD packet (human-only)')
  .argument('<id>', 'Packet ID')
  .requiredOption('-u, --user <name>', 'Name of person sealing the packet')
  .action((id, options) => {
    try {
      const service = new LatchService();
      const result = service.sealPacket({
        packetId: id,
        sealedBy: options.user
      });

      if (!result.success) {
        console.error('✗ Failed to seal packet:', result.error);
        service.close();
        process.exit(1);
      }

      console.log(`\n✓ Packet ${id} has been sealed by ${options.user}`);
      service.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('Verify packet integrity')
  .argument('<id>', 'Packet ID')
  .action((id) => {
    try {
      const service = new LatchService();
      const result = service.verifyPacketIntegrity(id);

      if (result.valid) {
        console.log('\n✓ Packet integrity verified');
        console.log('  No tampering detected');
      } else {
        console.log('\n✗ Packet integrity check FAILED');
        console.log(`  Reason: ${result.reason}`);
      }

      service.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('policies')
  .description('List all policy rules')
  .action(() => {
    try {
      const service = new LatchService();
      const policies = service.getPolicies();

      console.log(`\nPolicy Rules (${policies.length})`);
      console.log('═══════════════════════════════════════════════════════════\n');

      for (const policy of policies) {
        console.log(`[${policy.id}]`);
        console.log(`  Pattern:    ${policy.pattern}`);
        console.log(`  Risk Class: ${policy.riskClass}`);
        console.log(`  Action:     ${policy.action}`);
        if (policy.spendCap) {
          console.log(`  Spend Cap:  ${policy.spendCap}`);
        }
        console.log(`  ${policy.description}\n`);
      }

      service.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('hold')
  .description('List all unsealed HOLD packets')
  .action(() => {
    try {
      const service = new LatchService();
      const packets = service.getUnsealedHoldPackets();

      if (packets.length === 0) {
        console.log('No unsealed HOLD packets.');
        service.close();
        return;
      }

      console.log(`\n${packets.length} packet(s) awaiting seal`);
      console.log('═══════════════════════════════════════════════════════════\n');

      for (const packet of packets) {
        console.log(`${packet.toolCall.tool}`);
        console.log(`  ID:      ${packet.id}`);
        console.log(`  Reason:  ${packet.reason}`);
        console.log(`  Created: ${new Date(packet.createdAt).toLocaleString()}`);
        console.log(`  Seal:    latch seal ${packet.id} -u <your-name>\n`);
      }

      service.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parse();
