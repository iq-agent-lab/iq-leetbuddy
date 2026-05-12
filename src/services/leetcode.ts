// LeetCode GraphQL 공개 엔드포인트로 문제 메타 fetch
// 로그인 불필요 (공개 데이터만 사용)

import { LeetCodeProblem } from '../types';

const GRAPHQL_URL = 'https://leetcode.com/graphql/';

const QUESTION_QUERY = `
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    titleSlug
    content
    difficulty
    exampleTestcases
    topicTags { name slug }
    codeSnippets { lang langSlug code }
  }
}
`;

export async function fetchProblem(titleSlug: string): Promise<LeetCodeProblem> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: `https://leetcode.com/problems/${titleSlug}/`,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      query: QUESTION_QUERY,
      variables: { titleSlug },
    }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(`LeetCode 요청 제한 (HTTP 429) — 잠시 후 다시 시도해주세요`);
    }
    if (res.status >= 500) {
      throw new Error(`LeetCode 서버 응답 오류 (HTTP ${res.status}) — 잠시 후 다시 시도해주세요`);
    }
    throw new Error(`LeetCode 응답 오류 (HTTP ${res.status})`);
  }

  const json = (await res.json()) as {
    data?: { question: LeetCodeProblem | null };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(`LeetCode GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (!json.data?.question) {
    throw new Error(
      `LeetCode에서 "${titleSlug}" 문제를 찾을 수 없어요 — URL 또는 문제 이름을 확인해주세요`
    );
  }
  return json.data.question;
}
