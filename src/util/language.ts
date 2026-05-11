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

// LeetCode 입력 파싱: URL, slug, 둘 다 지원
export function parseProblemInput(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/leetcode\.com\/problems\/([^\/?#]+)/);
  if (urlMatch) return urlMatch[1];
  return trimmed.toLowerCase().replace(/\s+/g, '-');
}
