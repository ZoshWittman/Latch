import { PolicyRule, ToolCall, PolicyEvaluationResult, VerdictStatus } from '@/types';

export class PolicyEngine {
  private rules: PolicyRule[];

  constructor(rules: PolicyRule[]) {
    this.rules = rules;
  }

  evaluate(toolCall: ToolCall): PolicyEvaluationResult {
    for (const rule of this.rules) {
      if (this.matchesPattern(toolCall, rule.pattern)) {
        if (rule.spendCap !== undefined && this.exceedsSpendCap(toolCall, rule.spendCap)) {
          return {
            verdict: 'HOLD',
            matchedRule: rule,
            reason: `Spend amount exceeds cap of ${rule.spendCap}`
          };
        }

        return {
          verdict: rule.action,
          matchedRule: rule,
          reason: rule.description
        };
      }
    }

    return {
      verdict: 'HOLD',
      matchedRule: null,
      reason: 'No matching policy rule found; defaulting to HOLD for safety'
    };
  }

  private matchesPattern(toolCall: ToolCall, pattern: string): boolean {
    const toolString = JSON.stringify({
      tool: toolCall.tool,
      parameters: toolCall.parameters
    }).toLowerCase();

    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      const regex = new RegExp(regexPattern, 'i');
      return regex.test(toolCall.tool) || regex.test(toolString);
    }

    const patternLower = pattern.toLowerCase();
    return (
      toolCall.tool.toLowerCase().includes(patternLower) ||
      toolString.includes(patternLower)
    );
  }

  private exceedsSpendCap(toolCall: ToolCall, cap: number): boolean {
    const spendKeys = ['amount', 'cost', 'price', 'spend', 'value'];
    
    for (const key of spendKeys) {
      if (key in toolCall.parameters) {
        const value = parseFloat(toolCall.parameters[key]);
        if (!isNaN(value) && value > cap) {
          return true;
        }
      }
    }

    if (toolCall.metadata) {
      for (const key of spendKeys) {
        if (key in toolCall.metadata) {
          const value = parseFloat(toolCall.metadata[key]);
          if (!isNaN(value) && value > cap) {
            return true;
          }
        }
      }
    }

    return false;
  }

  getRules(): PolicyRule[] {
    return [...this.rules];
  }
}

export const DEFAULT_POLICIES: PolicyRule[] = [
  {
    id: 'clear-open',
    pattern: 'list_dir',
    riskClass: 'safe',
    action: 'OPEN',
    description: 'Read-only directory listing operations are safe'
  },
  {
    id: 'clear-read',
    pattern: 'read*',
    riskClass: 'safe',
    action: 'OPEN',
    description: 'Read operations are generally safe'
  },
  {
    id: 'deny-destructive',
    pattern: 'rm -rf',
    riskClass: 'destructive',
    action: 'CLOSED',
    description: 'Recursive force deletion is too dangerous'
  },
  {
    id: 'deny-format',
    pattern: 'format',
    riskClass: 'destructive',
    action: 'CLOSED',
    description: 'Format operations are destructive'
  },
  {
    id: 'hold-deploy',
    pattern: '*deploy*production*',
    riskClass: 'production',
    action: 'HOLD',
    description: 'Production deployments require human approval'
  },
  {
    id: 'hold-deploy-prod',
    pattern: '*prod*deploy*',
    riskClass: 'production',
    action: 'HOLD',
    description: 'Production deployments require human approval'
  },
  {
    id: 'spend-cap-100',
    pattern: '*purchase*',
    riskClass: 'moderate',
    action: 'OPEN',
    spendCap: 100,
    description: 'Purchases under cap are allowed; over cap requires approval'
  },
  {
    id: 'moderate-delete',
    pattern: 'delete',
    riskClass: 'moderate',
    action: 'HOLD',
    description: 'Delete operations should be reviewed'
  }
];
