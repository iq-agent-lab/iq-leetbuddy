// LeetCode 언어 slug를 파일 확장자로 매핑

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  python: 'py',
  python3: 'py',
  java: 'java',
  javascript: 'js',
  typescript: 'ts',
  cpp: 'cpp',
  c: 'c',
  csharp: 'cs',
  'c#': 'cs',
  go: 'go',
  golang: 'go',
  rust: 'rs',
  kotlin: 'kt',
  swift: 'swift',
  ruby: 'rb',
  scala: 'scala',
  php: 'php',
  dart: 'dart',
  elixir: 'ex',
  erlang: 'erl',
};

export function langToExt(langSlug: string): string {
  return LANGUAGE_EXTENSIONS[langSlug.toLowerCase()] ?? 'txt';
}

// retry helper - iq-blogger 패턴 차용
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1000;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// LeetCode 입력 파싱: URL (모든 형태), slug, 문제 이름까지 지원
// 지원하는 입력 예시:
//   - https://leetcode.com/problems/two-sum/
//   - https://leetcode.com/problems/two-sum/description/
//   - https://leetcode.com/problems/validate-binary-search-tree/description/?envType=problem-list-v2&envId=depth-first-search
//   - leetcode.com/problems/two-sum
//   - Symmetric Tree         (대소문자/공백 자유)
//   - symmetric tree
//   - SYMMETRIC-TREE
export function parseProblemInput(input: string): string {
  const trimmed = input.trim();

  // URL 패턴 매칭 - leetcode.com/cn, http(s) 선택, query/path 뒤는 무시
  const urlPattern = /leetcode\.(?:com|cn)\/problems\/([a-zA-Z0-9-]+)/i;
  const urlMatch = trimmed.match(urlPattern);
  if (urlMatch) return urlMatch[1].toLowerCase();

  // 자유 텍스트 → slug 정규화
  return trimmed
    .toLowerCase()
    .replace(/[\s_]+/g, '-')        // 공백/언더스코어 → dash
    .replace(/[^a-z0-9-]/g, '')     // 영숫자/dash만 남김
    .replace(/-+/g, '-')            // 연속 dash 하나로
    .replace(/^-+|-+$/g, '');       // 양끝 dash 제거
}
