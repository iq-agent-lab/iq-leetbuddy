// 번역 결과 캐시 — userData/cache/translations/{slug}.json
// 같은 titleSlug 두 번 fetch 시 LLM 호출 skip (비용/시간 절약).
// LeetCode 문제 자체가 거의 안 바뀌므로 만료 없음.
// 무효화 원할 시 userData/cache 폴더 삭제 (Troubleshooting에 명시).

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { FetchProblemResult } from '../types';

function cacheDir(): string {
  return path.join(app.getPath('userData'), 'cache', 'translations');
}

function cachePath(titleSlug: string): string {
  // titleSlug는 영숫자/dash만 (parseProblemInput에서 보장) — path traversal 안전
  return path.join(cacheDir(), `${titleSlug}.json`);
}

export async function readTranslationCache(
  titleSlug: string
): Promise<FetchProblemResult | null> {
  try {
    const data = await fs.readFile(cachePath(titleSlug), 'utf-8');
    const parsed = JSON.parse(data);
    // 최소 형태 검증 — 캐시 schema 변경 시 자동으로 invalidate
    if (!parsed.problem || !parsed.translation || !parsed.translationHtml) {
      return null;
    }
    return parsed as FetchProblemResult;
  } catch {
    // ENOENT (캐시 없음) / JSON 파싱 실패 / 권한 → 모두 cache miss로 처리
    return null;
  }
}

export async function writeTranslationCache(
  titleSlug: string,
  result: FetchProblemResult
): Promise<void> {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(
      cachePath(titleSlug),
      JSON.stringify(result, null, 2),
      'utf-8'
    );
  } catch {
    // 캐시 쓰기 실패해도 풀이 흐름엔 영향 X (silent)
  }
}
