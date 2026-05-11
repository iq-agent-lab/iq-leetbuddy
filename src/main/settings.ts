// .env 파일을 안전하게 읽고/쓰는 헬퍼
// UI에서 들어온 설정을 process.env와 .env 양쪽에 반영

import * as fs from 'fs/promises';
import * as path from 'path';

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
  'GITHUB_AUTO_CREATE_REPO',
] as const;

type ManagedKey = (typeof MANAGED_KEYS)[number];

export interface AppSettings {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  GITHUB_AUTO_CREATE_REPO?: string;
}

export interface SettingsView {
  ANTHROPIC_API_KEY: string;          // 항상 빈 문자열 (보안)
  ANTHROPIC_MODEL: string;
  GITHUB_TOKEN: string;                // 항상 빈 문자열 (보안)
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  GITHUB_AUTO_CREATE_REPO: boolean;
  hasAnthropicKey: boolean;            // 저장된 키가 존재하는가?
  hasGithubToken: boolean;
}

const SECRET_KEYS = new Set<string>(['ANTHROPIC_API_KEY', 'GITHUB_TOKEN']);

// 시크릿은 노출하지 않고 has-* 플래그로 존재 여부만 알림
export function getSettingsView(): SettingsView {
  return {
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    GITHUB_TOKEN: '',
    GITHUB_OWNER: process.env.GITHUB_OWNER || '',
    GITHUB_REPO: process.env.GITHUB_REPO || '',
    GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',
    GITHUB_AUTO_CREATE_REPO: process.env.GITHUB_AUTO_CREATE_REPO === 'true',
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasGithubToken: !!process.env.GITHUB_TOKEN,
  };
}

// .env 파일에 변경사항 반영
// 시크릿 키(API_KEY, TOKEN)의 빈 문자열은 "변경 안 함"으로 처리
export async function saveSettings(updates: AppSettings): Promise<void> {
  const cleanUpdates: Record<string, string> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!MANAGED_KEYS.includes(key as ManagedKey)) continue;
    if (typeof value !== 'string') continue;
    // 시크릿이 빈 문자열로 들어오면 기존 값 보존
    if (SECRET_KEYS.has(key) && value === '') continue;
    cleanUpdates[key] = value;
  }

  let content = '';
  try {
    content = await fs.readFile(envPath(), 'utf-8');
  } catch {}

  const lines = content.split('\n');
  const seen = new Set<string>();

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

  for (const [key, value] of Object.entries(cleanUpdates)) {
    if (!seen.has(key)) newLines.push(`${key}=${value}`);
  }

  await fs.writeFile(envPath(), newLines.join('\n'), 'utf-8');
  Object.assign(process.env, cleanUpdates);
}
