// Claude API로 LeetCode 문제 HTML을 깔끔한 한국어 마크다운으로 번역

import Anthropic from '@anthropic-ai/sdk';
import { LeetCodeProblem } from '../types';
import { withRetry } from '../util/language';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다 (.env 확인)');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export function resetTranslatorClient() {
  _client = null;
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function buildPrompt(problem: LeetCodeProblem): string {
  const tags = problem.topicTags.map((t) => t.name).join(', ');
  return `너는 LeetCode 문제를 한국어로 옮기는 번역가야. 다음 문제를 자연스러운 한국어 마크다운으로 변환해줘.

[메타]
- 문제 번호: ${problem.questionFrontendId}
- 제목: ${problem.title}
- 난이도: ${problem.difficulty}
- 태그: ${tags}

[원문 HTML]
${problem.content}

[원문 예시 입출력]
${problem.exampleTestcases}

다음 형식으로만 출력해줘 (코드 블록이나 추가 설명 없이 바로 마크다운 본문):

# ${problem.questionFrontendId}. ${problem.title}

> **${problem.difficulty}** · ${tags} · [원문](https://leetcode.com/problems/${problem.titleSlug}/)

## 문제

(원문을 매끄러운 한국어로 옮긴 본문. HTML 태그는 마크다운으로 변환)

## 입출력 예시

### Example 1
\`\`\`
Input: ...
Output: ...
\`\`\`
**설명**: ...

(예시가 여러 개면 모두 포함)

## 제약 조건

- (constraints를 불릿으로)

---

규칙:
1. 변수명, 함수명, 클래스명, 자료구조명(예: array, hash map)은 영어 그대로 두기. 단, 자연스러우면 한국어 병기 가능 (예: "해시 맵(hash map)")
2. 수식은 \`$...$\` 또는 코드 백틱 사용
3. 영어 원문의 뉘앙스를 살리되 자연스러운 한국어 문장
4. 어색한 직역 금지 (예: "당신은 주어집니다" 같은 표현 X)
5. **이미지는 반드시 보존**: 원문 HTML에 \`<img src="...">\`가 있으면 마크다운 \`![설명](원본URL)\` 형식으로 변환. URL은 절대 변경/단축하지 말 것. alt 텍스트는 한국어로 짧게 (예: "예시 1 다이어그램")
6. 마크다운 외 다른 설명/주석 추가 금지`;
}

export type StreamCallback = (snapshot: string) => void;

function extractText(content: Array<{ type: string }>): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim();
}

export async function translateProblem(
  problem: LeetCodeProblem,
  onStream?: StreamCallback
): Promise<string> {
  return withRetry(async () => {
    if (onStream) {
      const stream = client().messages.stream({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: buildPrompt(problem) }],
      });
      stream.on('text', (_delta, snapshot) => {
        onStream(snapshot);
      });
      const final = await stream.finalMessage();
      const text = extractText(final.content as Array<{ type: string }>);
      if (!text) throw new Error('번역 결과가 비어있습니다');
      return text;
    }

    // non-streaming fallback (호환 유지)
    const response = await client().messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: buildPrompt(problem) }],
    });
    const text = extractText(response.content as Array<{ type: string }>);
    if (!text) throw new Error('번역 결과가 비어있습니다');
    return text;
  });
}
