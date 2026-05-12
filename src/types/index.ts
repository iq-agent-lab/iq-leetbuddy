// LeetCode GraphQL 응답 + 내부 도메인 타입 + IPC API 계약

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

// ─── Settings (main/settings.ts + renderer 양쪽에서 사용) ──────────────────

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
  hasAnthropicKey: boolean;
  hasGithubToken: boolean;
}

export interface CheckConfigResult {
  anthropic: boolean;
  github: boolean;
  owner: string;
  repo: string;
  shortcut: string | null;
}

export interface VerifyResult {
  authedAs: string;
  owner: string;
  repo: string;
  repoExists: boolean;
  repoUrl?: string;
  repoDefaultBranch?: string;
  configuredBranch: string;
  branchMatches?: boolean;
}

export interface CreateRepoResult {
  url: string;
  defaultBranch: string;
  scope: 'user' | 'org';
}

// ─── IPC API 계약 (preload.ts ↔ renderer.ts) ──────────────────────────────

type IpcOk<T> = { ok: true } & T;
type IpcErr = { ok: false; error: string; status?: number | null };
type IpcResult<T> = IpcOk<T> | IpcErr;

export interface IqApi {
  fetchProblem: (input: string) => Promise<IpcResult<FetchProblemResult>>;
  uploadSolution: (
    payload: UploadPayload
  ) => Promise<IpcResult<UploadResult & { annotatedHtml: string }>>;
  checkConfig: () => Promise<CheckConfigResult>;
  getSettings: () => Promise<SettingsView>;
  saveSettings: (settings: AppSettings) => Promise<{ ok: boolean; error?: string }>;
  openLeetCode: (url?: string) => Promise<{ ok: boolean }>;
  getLeetCodeUrl: () => Promise<{ ok: boolean; url: string | null }>;
  pullLeetCodeUrl: () => Promise<{ ok: boolean }>;
  createRepo: () => Promise<IpcResult<CreateRepoResult>>;
  verifyGithub: () => Promise<IpcResult<VerifyResult>>;
  onFetchProgress: (cb: (stage: string) => void) => () => void;
  onUploadProgress: (cb: (stage: string) => void) => () => void;
  onPullProblem: (cb: (url: string) => void) => () => void;
  onTranslateStream: (cb: (html: string) => void) => () => void;
  onAnnotateStream: (cb: (html: string) => void) => () => void;
}

declare global {
  interface Window {
    api: IqApi;
    hljs?: {
      highlightElement: (el: HTMLElement) => void;
    };
  }
}
