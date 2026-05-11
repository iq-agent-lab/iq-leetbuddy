// LeetCode GraphQL 응답 + 내부 도메인 타입

export interface LeetCodeTag {
  name: string;
  slug: string;
}

export interface LeetCodeProblem {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  content: string; // HTML
  difficulty: 'Easy' | 'Medium' | 'Hard';
  exampleTestcases: string;
  topicTags: LeetCodeTag[];
}

export interface UploadPayload {
  problem: LeetCodeProblem;
  translation: string;
  code: string;
  language: string; // langSlug (e.g., "python3", "java")
}

export interface UploadResult {
  folder: string;
  commitSha: string;
  commitUrl: string;
}

export interface FetchProblemResult {
  problem: LeetCodeProblem;
  translation: string;
}

export interface IpcError {
  error: string;
}
