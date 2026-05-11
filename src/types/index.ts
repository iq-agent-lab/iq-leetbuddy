// LeetCode GraphQL 응답 + 내부 도메인 타입

export interface LeetCodeTag {
  name: string;
  slug: string;
}

export interface CodeSnippet {
  lang: string;        // 표시명 (e.g., "Python3", "Java")
  langSlug: string;    // 슬러그 (e.g., "python3", "java")
  code: string;        // 시작 코드 템플릿
}

export interface LeetCodeProblem {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  content: string; // HTML
  difficulty: 'Easy' | 'Medium' | 'Hard';
  exampleTestcases: string;
  topicTags: LeetCodeTag[];
  codeSnippets: CodeSnippet[];
}

export interface UploadPayload {
  problem: LeetCodeProblem;
  translation: string;
  code: string;
  language: string;
}

export interface UploadResult {
  folder: string;
  commitSha: string;
  commitUrl: string;
}

export interface FetchProblemResult {
  problem: LeetCodeProblem;
  translation: string;       // 원본 마크다운 (GitHub 업로드용)
  translationHtml: string;   // 렌더링된 HTML (UI 표시용)
}

export interface IpcError {
  error: string;
}
