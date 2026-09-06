# Latch

**Action-boundary desk for agent tool calls**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests: 67 passing](https://img.shields.io/badge/tests-67%20passing-brightgreen)]()

Latch is a deterministic policy and provenance system for AI agent tool calls. Every side-effecting action becomes a Latch Packet that flows through policy evaluation, cryptographic binding, and human-controllable gating.

## Who Is This For?

- **AI Agent Operators** who need fine-grained control over what agents can do
- **Platform Teams** building agent infrastructure with safety guardrails
- **Compliance Teams** requiring tamper-evident audit trails for agent actions
- **Developers** integrating agents into production systems

## Benefits

- **Deterministic Policy**: First-match rule engine with pattern matching, risk classes, and spend caps
- **Cryptographic Provenance**: SHA-256 binding detects tampering of policies or tool calls
- **Human-in-the-Loop**: HOLD verdicts require explicit human seal; agents cannot bypass
- **Zero External Dependencies**: No paid APIs, no network calls for core functionality
- **Complete Solution**: UI + REST API + CLI for flexible integration

## What Latch Is NOT

| NOT | Description |
|-----|-------------|
| **Clearance** | Latch gates _actions_, not deliverable completion |
| **Induction** | Latch doesn't promote or train skills |
| **Drydock** | Latch operates at tool-call time, not PR ship time |
| **Fleetcourt** | Latch doesn't arbitrate multi-agent disputes |
| **Framelock** | Latch doesn't manage UI state merges |
| **Homefield/Redline** | Latch doesn't handle domain boundaries or weather conditions |

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/ZoshWittman/Latch.git
cd Latch

# Install dependencies
npm install

# Run tests
npm test

# Start the development server (port 43128)
npm run dev
```

### Basic Usage

#### 1. Via CLI

```bash
# Create a packet for a tool call
npm run cli create -t list_dir -p '{"path": "/home"}'
# ✓ Packet created
# Verdict: OPEN

# Create a dangerous operation
npm run cli create -t shell_execute -p '{"command": "rm -rf /"}'
# ✓ Packet created
# Verdict: CLOSED

# Create a production deployment (requires seal)
npm run cli create -t deploy -p '{"env": "production"}'
# ✓ Packet created
# Verdict: HOLD
# ⚠ This packet requires human seal

# List all unsealed HOLD packets
npm run cli hold

# Seal a HOLD packet (human only)
npm run cli seal <packet-id> -u alice
# ✓ Packet sealed by alice

# View all packets
npm run cli list

# Get specific packet
npm run cli get <packet-id>

# Verify packet integrity
npm run cli verify <packet-id>

# View active policies
npm run cli policies
```

#### 2. Via REST API

```bash
# Create a packet
curl -X POST http://localhost:43128/api/packets \\
  -H "Content-Type: application/json" \\
  -d '{
    "toolCall": {
      "tool": "list_dir",
      "parameters": {"path": "/home"}
    }
  }'

# Get all packets
curl http://localhost:43128/api/packets

# Get specific packet
curl http://localhost:43128/api/packets/<packet-id>

# Seal a HOLD packet
curl -X POST http://localhost:43128/api/packets/<packet-id>/seal \\
  -H "Content-Type: application/json" \\
  -d '{"sealedBy": "alice"}'

# Verify packet integrity
curl http://localhost:43128/api/packets/<packet-id>/verify

# Get policies
curl http://localhost:43128/api/policies
```

#### 3. Via Web UI

Open http://localhost:43128 in your browser to:
- View all packets with filtering (All / Open / Closed / Hold)
- See real-time statistics
- Seal HOLD packets with human approval
- Inspect packet details and provenance

## Core Concepts

### Latch Packet

A Latch Packet represents a proposed tool call with its evaluation and provenance:

```typescript
{
  id: string;                    // Unique packet identifier
  toolCall: {                    // The proposed action
    tool: string;
    parameters: Record<string, any>;
  };
  verdict: 'OPEN' | 'CLOSED' | 'HOLD';  // Policy decision
  policyRuleId: string | null;   // Matched policy rule
  provenance: {                  // Cryptographic binding
    policyHash: string;          // SHA-256 of policy set
    toolCallHash: string;        // SHA-256 of tool call
    timestamp: number;           // Creation time
    boundHash: string;           // Combined binding hash
  };
  sealed: boolean;               // Human seal status
  sealedBy?: string;             // Who sealed it
  sealedAt?: number;             // When sealed
  createdAt: number;             // Creation timestamp
  reason: string;                // Verdict explanation
}
```

### Verdicts

- **OPEN**: Action is allowed; agent can proceed
- **CLOSED**: Action is denied; agent must not proceed
- **HOLD**: Action requires human approval; only sealable by humans

### Policy Engine

Policies are evaluated in order (first match wins):

```typescript
{
  id: string;                    // Unique policy identifier
  pattern: string;               // Match pattern (supports wildcards)
  riskClass: 'safe' | 'moderate' | 'destructive' | 'production';
  action: 'OPEN' | 'CLOSED' | 'HOLD';
  spendCap?: number;             // Optional spending limit
  description: string;           // Human-readable explanation
}
```

**Default Policies:**

1. `clear-open`: Read-only operations (list_dir, read*) → OPEN
2. `deny-destructive`: Dangerous operations (rm -rf, format) → CLOSED
3. `hold-deploy`: Production deployments → HOLD
4. `spend-cap-100`: Purchases over $100 → HOLD

### Cryptographic Provenance

Every packet is bound to its policy and tool call using SHA-256:

1. **Policy Hash**: Hash of the complete policy rule set
2. **Tool Call Hash**: Hash of the tool name and parameters
3. **Bound Hash**: Combined hash of policy + tool call + timestamp

Tampering detection:
- Modifying the tool call → provenance mismatch
- Changing policies after packet creation → provenance mismatch
- Corrupting the binding → provenance mismatch

### Human-Only Seal

HOLD packets cannot be released by agents. Only a human can seal:

```bash
npm run cli seal <packet-id> -u <your-name>
```

Attempting to seal non-HOLD or already-sealed packets fails gracefully.

## Architecture

See [docs/architecture/index.html](docs/architecture/index.html) for detailed architecture documentation including:

- System design and data flow
- Component interaction diagrams
- Security model
- Database schema
- API specifications

## Testing

Latch includes **67 comprehensive tests** covering:

- ✅ Policy engine pattern matching and evaluation
- ✅ Cryptographic provenance creation and verification
- ✅ Database operations and persistence
- ✅ Packet lifecycle (create → evaluate → seal)
- ✅ Required fixtures:
  - `clear-open` → OPEN for read-only operations
  - `deny-destructive` → CLOSED for dangerous operations
  - `hold-deploy` → HOLD for production deployments
  - `tampered-policy` → Provenance mismatch detection
  - `spend-over-cap` → HOLD when exceeding spend limits

Run tests:

```bash
npm test                # Run all tests with coverage
npm run test:watch      # Run tests in watch mode
```

## Integration Example

```typescript
import { LatchService } from './src/lib/latch-service';

const latch = new LatchService();

// Evaluate a tool call
const packet = latch.createPacket({
  tool: 'deploy',
  parameters: { environment: 'production' }
});

if (packet.verdict === 'OPEN') {
  // Execute the tool call
  await executeTool(packet.toolCall);
} else if (packet.verdict === 'CLOSED') {
  // Reject the tool call
  throw new Error(`Action denied: ${packet.reason}`);
} else if (packet.verdict === 'HOLD') {
  // Wait for human seal
  console.log(`Awaiting human approval for packet ${packet.id}`);
  // Human seals via UI or CLI
  // ... wait for seal ...
  await executeTool(packet.toolCall);
}

// Verify integrity before trusting historical packets
const verification = latch.verifyPacketIntegrity(packet.id);
if (!verification.valid) {
  throw new Error(`Tampering detected: ${verification.reason}`);
}
```

## Honest Limitations

1. **No Live LLM Integration**: Latch doesn't directly integrate with LLM providers
2. **Pattern Matching Only**: Policy engine uses string patterns, not semantic understanding
3. **Single-Node Only**: No distributed coordination or consensus
4. **In-Process Database**: SQLite is sufficient for single deployments but not for clusters
5. **No Audit Replay**: Packets are stored but not replayable or time-travel debuggable
6. **No Policy Versioning**: Changing policies doesn't version or migrate existing packets
7. **Simple Spend Detection**: Only checks hardcoded parameter names (amount, cost, price, spend, value)
8. **No Revocation**: Sealed packets cannot be unsealed or revoked

## Configuration

### Custom Policies

```typescript
import { LatchService } from './src/lib/latch-service';
import { PolicyRule } from './src/types';

const customPolicies: PolicyRule[] = [
  {
    id: 'allow-read',
    pattern: 'read*',
    riskClass: 'safe',
    action: 'OPEN',
    description: 'Allow all read operations'
  },
  {
    id: 'require-approval-for-writes',
    pattern: 'write*',
    riskClass: 'moderate',
    action: 'HOLD',
    description: 'Require human approval for writes'
  }
];

const latch = new LatchService(undefined, customPolicies);
```

### Custom Database Path

```typescript
const latch = new LatchService('./path/to/latch.db');
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Start production server
npm start

# Use CLI
npm run cli -- [command] [options]
```

## License

MIT License - see [LICENSE](LICENSE) for details

## Contributing

This is a reference implementation. For production use, consider:

- Adding authentication/authorization
- Implementing audit log streaming
- Building policy management UI
- Adding webhook notifications
- Integrating with your agent framework
- Scaling to distributed deployments

---

**Latch**: Because agent actions should be deliberate, transparent, and human-controllable.