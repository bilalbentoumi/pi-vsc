import * as vscode from 'vscode';
import type { ThinkingLevel } from '../shared/protocol';

export interface PiConfig {
  binaryPath: string;
  agentDir: string;
  defaultModel: string;
  thinkingLevel: ThinkingLevel;
  autoCompact: boolean;
  autoRetry: boolean;
  extraArgs: string[];
}

const SECTION = 'pintra';

export function readConfig(): PiConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    binaryPath: cfg.get<string>('binaryPath', 'pi').trim() || 'pi',
    agentDir: cfg.get<string>('agentDir', '').trim(),
    defaultModel: cfg.get<string>('defaultModel', '').trim(),
    thinkingLevel: cfg.get<ThinkingLevel>('thinkingLevel', 'medium'),
    autoCompact: cfg.get<boolean>('autoCompact', true),
    autoRetry: cfg.get<boolean>('autoRetry', true),
    extraArgs: cfg.get<string[]>('extraArgs', []),
  };
}

/** Config keys whose change should trigger a runtime restart. */
export const RESTART_KEYS = [
  `${SECTION}.binaryPath`,
  `${SECTION}.agentDir`,
  `${SECTION}.defaultModel`,
  `${SECTION}.extraArgs`,
];

export function affectsRestart(e: vscode.ConfigurationChangeEvent): boolean {
  return RESTART_KEYS.some((key) => e.affectsConfiguration(key));
}
