// .env 파일을 안전하게 읽고/쓰는 헬퍼
// UI에서 들어온 설정을 process.env와 .env 양쪽에 반영

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

// 빌드 후 위치 기준: dist/main/settings.js → ../../.env
function envPath(): string {
  return path.join(__dirname, '../../.env');
}

const MANAGED_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'GITHUB_TOKEN',
  'GITHUB_OWNER',
  'GITHUB_REPO',
  'GITHUB_BRANCH',
] as const;

type ManagedKey = (typeof MANAGED_KEYS)[number];

export interface AppSettings {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
}

const MASK = '••••••••';

// 마스킹된 현재 설정 (UI 표시용)
export function getMaskedSettings(): Record<string, string> {
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? MASK : '',
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN ? MASK : '',
    GITHUB_OWNER: process.env.GITHUB_OWNER || '',
    GITHUB_REPO: process.env.GITHUB_REPO || '',
    GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',
  };
}

// .env 파일에 변경사항 반영. 마스킹된 값(••••)은 무시 (변경 안 함).
export async function saveSettings(updates: AppSettings): Promise<void> {
  const cleanUpdates: Record<string, string> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!MANAGED_KEYS.includes(key as ManagedKey)) continue;
    if (typeof value !== 'string') continue;
    if (value === MASK || value.includes('•')) continue; // 마스킹 그대로 → 변경 안 함
    cleanUpdates[key] = value;
  }

  // 현재 .env 읽기
  let content = '';
  try {
    content = await fs.readFile(envPath(), 'utf-8');
  } catch {
    // 없으면 새로 만듦
  }

  const lines = content.split('\n');
  const seen = new Set<string>();

  // 기존 키는 in-place 교체
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const match = trimmed.match(/^([A-Z_]+)=/);
    if (!match) return line;
    const key = match[1];
    if (cleanUpdates[key] !== undefined) {
      seen.add(key);
      return `${key}=${cleanUpdates[key]}`;
    }
    return line;
  });

  // 새 키는 끝에 append
  for (const [key, value] of Object.entries(cleanUpdates)) {
    if (!seen.has(key)) {
      newLines.push(`${key}=${value}`);
    }
  }

  await fs.writeFile(envPath(), newLines.join('\n'), 'utf-8');

  // process.env에도 즉시 반영
  Object.assign(process.env, cleanUpdates);
}
