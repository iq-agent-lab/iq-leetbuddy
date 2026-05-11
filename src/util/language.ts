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
//   - https://leetcode.com/problems/regular-expression-matching/description/?envType=...
//   - leetcode.com/problems/two-sum
//   - two-sum
//   - Two Sum            (공백 → dash 변환)
export function parseProblemInput(input: string): string {
  const trimmed = input.trim();

  // URL 패턴 매칭 - leetcode.com 또는 leetcode.cn, http(s) 선택, www 선택
  const urlPattern = /leetcode\.(?:com|cn)\/problems\/([a-zA-Z0-9-]+)/i;
  const urlMatch = trimmed.match(urlPattern);
  if (urlMatch) return urlMatch[1].toLowerCase();

  // 이미 slug 형태이거나 자유 텍스트
  return trimmed.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
}
