// LeetCode GraphQL 공개 엔드포인트로 문제 메타 fetch
// 로그인 불필요 (공개 데이터만 사용)
//
// leetcode.com vs leetcode.cn:
//   leetcode.cn은 Cloudflare bot protection 뒤에 있어 단순 GraphQL 접근 시 HTTP 403
//   ("Just a moment...") 반환. 우회하려면 브라우저 JS challenge 통과 필요 → 복잡.
//   → cn URL을 받아도 com endpoint로 fetch. 대부분 문제가 com/cn slug 공유하므로 동작.
//   cn-only 문제(매우 드물게)는 404로 fail.

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

// frontendId(예: "1") → titleSlug 해결용 — searchKeywords로 검색 후 정확 매칭
const SEARCH_QUERY = `
query problemsetQuestionList($filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: "all-code-essentials"
    limit: 20
    skip: 0
    filters: $filters
  ) {
    questions: data {
      questionFrontendId
      titleSlug
      title
    }
  }
}
`;

async function graphqlRequest(
  body: object,
  titleSlugForReferer?: string
): Promise<any> {
  const referer = titleSlugForReferer
    ? `https://leetcode.com/problems/${titleSlugForReferer}/`
    : `https://leetcode.com/`;
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: referer,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
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
    data?: any;
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(`LeetCode GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  return json.data;
}

export async function fetchProblem(titleSlug: string): Promise<LeetCodeProblem> {
  const data = await graphqlRequest(
    { query: QUESTION_QUERY, variables: { titleSlug } },
    titleSlug
  );
  if (!data?.question) {
    throw new Error(
      `LeetCode에서 "${titleSlug}" 문제를 찾을 수 없어요 — URL 또는 문제 이름을 확인해주세요`
    );
  }
  return data.question as LeetCodeProblem;
}

// frontendId(예: "1") → titleSlug 해결
// searchKeywords로 검색 후 정확히 일치하는 frontendId의 titleSlug 반환
export async function resolveTitleSlugByFrontendId(frontendId: string): Promise<string> {
  const data = await graphqlRequest({
    query: SEARCH_QUERY,
    variables: { filters: { searchKeywords: frontendId } },
  });
  const questions = data?.problemsetQuestionList?.questions as Array<{
    questionFrontendId: string;
    titleSlug: string;
    title: string;
  }> | undefined;

  if (!questions || questions.length === 0) {
    throw new Error(
      `LeetCode에서 문제 #${frontendId}을(를) 찾을 수 없어요 — 번호를 확인해주세요`
    );
  }

  // 정확히 같은 frontendId 매칭 (searchKeywords는 부분 매칭이라 "1" 검색 시 "10", "100"도 나옴)
  const exact = questions.find((q) => q.questionFrontendId === frontendId);
  if (!exact) {
    throw new Error(
      `LeetCode에서 문제 #${frontendId}을(를) 찾을 수 없어요 — 번호를 확인해주세요`
    );
  }
  return exact.titleSlug;
}
