// GitHub API로 한 번의 commit에 3개 파일 (README, solution, RETROSPECTIVE) 업로드
// Octokit git data API 사용 - createOrUpdateFileContents는 파일당 commit 1개라 비효율

import { Octokit } from '@octokit/rest';
import { LeetCodeProblem, UploadResult } from '../types';
import { langToExt, langToFolder } from '../util/language';

// GitHub API 에러를 진단 가능한 한국어 메시지로 변환 (원본 status는 보존)
function toGitHubError(
  err: unknown,
  context: { owner: string; repo: string; branch: string; stage: string }
): Error & { status?: number } {
  const e = err as { status?: number; message?: string };
  const where = `[${context.stage}] ${context.owner}/${context.repo} · ${context.branch}`;

  let message: string;
  if (e?.status === 404) {
    message = `GitHub 리소스를 찾을 수 없습니다 (404)
현재 설정: ${context.owner}/${context.repo} (브랜치: ${context.branch})

가능한 원인:
• 레포 자체가 없음 — 아래 "이 이름으로 새 레포 만들기" 버튼으로 자동 생성 가능
• 레포 이름 불일치 — 설정의 GITHUB_REPO 값과 실제 GitHub 레포 이름이 다름
• 브랜치 이름이 다름 — main이 아니라 master일 수도
• PAT 권한 부족 — fine-grained 토큰이면 이 레포가 허용 목록에 있는지 확인`;
  } else if (e?.status === 401) {
    message = 'GitHub 토큰이 유효하지 않습니다 (401)\n헤더 ⚙️ 설정에서 새 PAT를 입력해주세요.';
  } else if (e?.status === 403) {
    message = `GitHub 토큰 권한 부족 (403)\nPAT 발급 시 repo scope (또는 public_repo) 체크 필요.\n토큰: https://github.com/settings/tokens`;
  } else if (e?.status === 409) {
    message = `레포 충돌 상태 (409)\n${where}\n레포가 비어있을 가능성. README 하나 추가 후 재시도.`;
  } else if (e?.status === 422) {
    message = `요청 형식 오류 (422) ${where}\n${e.message || ''}`;
  } else {
    message = `${e?.message || String(err)} ${where}`;
  }

  const out = new Error(message) as Error & { status?: number };
  out.status = e?.status;
  return out;
}

let _octokit: Octokit | null = null;
function octokit(): Octokit {
  if (!_octokit) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN이 설정되지 않았습니다 — ⚙️ 설정에서 입력해주세요');
    }
    _octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return _octokit;
}

export function resetGithubClient() {
  _octokit = null;
}

interface CommitFile {
  path: string;
  content: string;
}

// ─── 풀이 레포 root README 자동 인덱스 ─────────────────────────────
// uploadSolution이 매 풀이마다 root README.md의 marker 영역만 update.
// 사용자가 README 위/아래에 자유 텍스트 추가 가능 (marker 밖 보존).

const INDEX_MARKER_START = '<!-- iq-leetbuddy:problems:start -->';
const INDEX_MARKER_END = '<!-- iq-leetbuddy:problems:end -->';

interface IndexEntry {
  frontendId: number;
  title: string;
  titleSlug: string;
  difficulty: string;
  languages: string[];
  savedAt: string; // YYYY-MM-DD
}

// 기존 root README의 marker 영역 표를 parse
function parseExistingIndex(content: string): IndexEntry[] {
  const start = content.indexOf(INDEX_MARKER_START);
  const end = content.indexOf(INDEX_MARKER_END);
  if (start < 0 || end < 0 || end < start) return [];

  const table = content.slice(start + INDEX_MARKER_START.length, end).trim();
  const lines = table.split('\n');
  const entries: IndexEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (/^\|\s*-+/.test(trimmed)) continue; // separator row
    if (/^\|\s*#\s*\|/i.test(trimmed)) continue; // header row

    const cells = trimmed.split('|').map((s) => s.trim()).filter((s, i, a) => {
      // 첫/마지막 빈 cell만 제거 (앞뒤 |로 인한)
      return !(i === 0 && s === '') && !(i === a.length - 1 && s === '');
    });
    if (cells.length < 5) continue;

    const [idCell, titleCell, diffCell, langCell, dateCell] = cells;
    const id = parseInt(idCell, 10);
    if (isNaN(id)) continue;

    // titleCell 형식: [Title](NNNN-slug/)
    const titleMatch = titleCell.match(/^\[(.+?)\]\((.+?)\/?\)\s*$/);
    if (!titleMatch) continue;
    const title = titleMatch[1];
    const folder = titleMatch[2].replace(/\/$/, '');
    const slugMatch = folder.match(/^\d+-(.+)$/);
    const titleSlug = slugMatch ? slugMatch[1] : folder;

    const languages = langCell.split(',').map((s) => s.trim()).filter(Boolean);

    entries.push({
      frontendId: id,
      title,
      titleSlug,
      difficulty: diffCell,
      languages,
      savedAt: dateCell,
    });
  }
  return entries;
}

function renderIndexTable(entries: IndexEntry[]): string {
  if (entries.length === 0) {
    return '_아직 풀이가 없습니다._';
  }
  const sorted = [...entries].sort((a, b) => a.frontendId - b.frontendId);
  const rows = sorted.map((e) => {
    const folder = `${String(e.frontendId).padStart(4, '0')}-${e.titleSlug}`;
    const langs = e.languages.join(', ');
    // 제목에 `|` 같은 문자 있으면 escape
    const safeTitle = e.title.replace(/\|/g, '\\|');
    return `| ${e.frontendId} | [${safeTitle}](${folder}/) | ${e.difficulty} | ${langs} | ${e.savedAt} |`;
  });
  return [
    '| # | 제목 | 난이도 | 언어 | 풀이 일자 |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function buildRootReadme(existingContent: string | null, entries: IndexEntry[]): string {
  const indexBlock = `${INDEX_MARKER_START}\n${renderIndexTable(entries)}\n${INDEX_MARKER_END}`;

  if (existingContent && existingContent.includes(INDEX_MARKER_START)) {
    // marker 영역만 교체 (사용자가 추가한 위/아래 텍스트 보존)
    const before = existingContent.slice(0, existingContent.indexOf(INDEX_MARKER_START));
    const afterIdx = existingContent.indexOf(INDEX_MARKER_END) + INDEX_MARKER_END.length;
    const after = existingContent.slice(afterIdx);
    return `${before}${indexBlock}${after}`;
  }

  if (existingContent && existingContent.trim()) {
    // marker가 없는 기존 README가 있으면 끝에 append
    return `${existingContent.trimEnd()}\n\n## 풀이 목록 (${entries.length}문제)\n\n${indexBlock}\n`;
  }

  // 처음 만드는 README (레포 자동 생성 직후엔 GitHub auto_init README가 있을 수도)
  return `# LeetCode 풀이 노트

> [iq-leetbuddy](https://github.com/iq-agent-lab/iq-leetbuddy)로 자동 정리되는 LeetCode 풀이 모음. 매 풀이마다 한국어 번역 + AI 회고 + 통과 코드가 단일 commit으로 올라옴.

## 풀이 목록 (${entries.length}문제)

${indexBlock}

---
*Generated by [iq-leetbuddy](https://github.com/iq-agent-lab/iq-leetbuddy)*
`;
}

// 파일 raw content fetch — getContent의 base64 decode
async function fetchFileContent(
  owner: string,
  repo: string,
  filePath: string,
  ref: string
): Promise<string | null> {
  try {
    const { data } = await octokit().repos.getContent({ owner, repo, path: filePath, ref });
    if (Array.isArray(data)) return null;
    if (data && 'content' in data && typeof data.content === 'string') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch (err) {
    const e = err as { status?: number };
    if (e?.status === 404) return null;
    // 권한/네트워크 등 다른 에러는 caller에서 잡지 않고 그냥 null (index update 실패해도 풀이 commit은 진행되도록 silent)
    return null;
  }
}

// 기존 파일 내용과 새 content를 비교 — 같으면 commit에서 제외 가능 (git noise 회피)
// 404 / 기타 에러 시엔 true 반환 (안전하게 새로 만듦)
async function fileNeedsUpdate(
  owner: string,
  repo: string,
  path: string,
  newContent: string,
  ref: string
): Promise<boolean> {
  try {
    const { data } = await octokit().repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data)) return true; // 디렉토리는 항상 update
    if (data && 'content' in data && typeof data.content === 'string') {
      const existing = Buffer.from(data.content, 'base64').toString('utf-8');
      return existing.trim() !== newContent.trim();
    }
    return true;
  } catch (err) {
    const e = err as { status?: number };
    if (e?.status === 404) return true; // 파일 없음 → 새로 만들어야 함
    // 권한/네트워크 등 다른 에러는 commit 흐름에서 잡히도록 true 반환
    return true;
  }
}

async function commitFiles(
  owner: string,
  repo: string,
  branch: string,
  files: CommitFile[],
  message: string
): Promise<{ sha: string; url: string }> {
  const o = octokit();
  const ctx = { owner, repo, branch };

  let latestCommitSha: string;
  try {
    const { data: refData } = await o.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    latestCommitSha = refData.object.sha;
  } catch (err) {
    throw toGitHubError(err, { ...ctx, stage: 'getRef' });
  }

  let baseTreeSha: string;
  try {
    const { data: commitData } = await o.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha,
    });
    baseTreeSha = commitData.tree.sha;
  } catch (err) {
    throw toGitHubError(err, { ...ctx, stage: 'getCommit' });
  }

  let blobs;
  try {
    blobs = await Promise.all(
      files.map((f) =>
        o.git.createBlob({
          owner,
          repo,
          content: Buffer.from(f.content, 'utf-8').toString('base64'),
          encoding: 'base64',
        })
      )
    );
  } catch (err) {
    throw toGitHubError(err, { ...ctx, stage: 'createBlob' });
  }

  let newTree;
  try {
    const result = await o.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: files.map((f, i) => ({
        path: f.path,
        mode: '100644',
        type: 'blob',
        sha: blobs[i].data.sha,
      })),
    });
    newTree = result.data;
  } catch (err) {
    throw toGitHubError(err, { ...ctx, stage: 'createTree' });
  }

  let newCommit;
  try {
    const result = await o.git.createCommit({
      owner,
      repo,
      message,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });
    newCommit = result.data;
  } catch (err) {
    throw toGitHubError(err, { ...ctx, stage: 'createCommit' });
  }

  try {
    await o.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });
  } catch (err) {
    throw toGitHubError(err, { ...ctx, stage: 'updateRef' });
  }

  return {
    sha: newCommit.sha,
    url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
  };
}

export async function uploadSolution(args: {
  problem: LeetCodeProblem;
  translation: string;
  code: string;
  language: string;
  annotated: string;
}): Promise<UploadResult> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER 또는 GITHUB_REPO가 설정되지 않았습니다 — ⚙️ 설정에서 입력해주세요');
  }

  const num = String(args.problem.questionFrontendId).padStart(4, '0');
  const baseFolder = `${num}-${args.problem.titleSlug}`;
  const ext = langToExt(args.language);
  const langDir = langToFolder(args.language);

  const readmePath = `${baseFolder}/README.md`;
  const solutionPath = `${baseFolder}/${langDir}/solution.${ext}`;
  const retroPath = `${baseFolder}/${langDir}/RETROSPECTIVE.md`;

  // README는 모든 언어 풀이가 공유 — 같은 문제 다른 언어로 풀거나 같은 풀이 재upload 시
  // 동일 내용을 매번 push하면 git history noise. 기존 sha 내용과 비교해 같으면 skip.
  // solution / RETROSPECTIVE는 사용자 의도(개선 push)가 있을 수 있어 항상 commit.
  const readmeChanged = await fileNeedsUpdate(owner, repo, readmePath, args.translation, branch);

  const files: CommitFile[] = [];
  if (readmeChanged) {
    files.push({ path: readmePath, content: args.translation });
  }
  files.push(
    {
      path: solutionPath,
      content: args.code.endsWith('\n') ? args.code : args.code + '\n',
    },
    {
      path: retroPath,
      content: args.annotated,
    }
  );

  // ─── root README.md 자동 인덱스 ───────────────────────────────
  // 풀이 레포 root의 README에 marker 영역만 update — 사용자가 위/아래 자유 텍스트 추가 가능.
  // 같은 문제 다른 언어로 풀면 languages 합치고 savedAt 갱신.
  // 실패해도 silent — 풀이 자체 commit은 진행되어야 함.
  let indexUpdated = false;
  try {
    const existingRootReadme = await fetchFileContent(owner, repo, 'README.md', branch);
    const entries = parseExistingIndex(existingRootReadme || '');
    const newEntry: IndexEntry = {
      frontendId: parseInt(args.problem.questionFrontendId, 10),
      title: args.problem.title,
      titleSlug: args.problem.titleSlug,
      difficulty: args.problem.difficulty,
      languages: [langDir],
      savedAt: new Date().toISOString().slice(0, 10),
    };

    // dedup: 같은 slug 있으면 languages 합치고 entry 교체 (savedAt 갱신)
    const existingIdx = entries.findIndex((e) => e.titleSlug === newEntry.titleSlug);
    if (existingIdx >= 0) {
      const prev = entries[existingIdx];
      const langs = Array.from(new Set([...prev.languages, langDir])).sort();
      entries[existingIdx] = { ...newEntry, languages: langs };
    } else {
      entries.push(newEntry);
    }

    const newRootReadme = buildRootReadme(existingRootReadme, entries);
    if ((existingRootReadme || '') !== newRootReadme) {
      files.push({ path: 'README.md', content: newRootReadme });
      indexUpdated = true;
    }
  } catch {
    // 인덱스 update 실패는 silent — 풀이 자체는 commit 진행
  }

  const langLabel = readmeChanged ? `(${langDir})` : `(${langDir}, README 변경 없음)`;
  const indexLabel = indexUpdated ? ' + 인덱스 갱신' : '';
  const message = `feat: ${args.problem.questionFrontendId}. ${args.problem.title} ${langLabel} 풀이 추가${indexLabel}`;

  const result = await commitFiles(owner, repo, branch, files, message);

  return {
    folder: `${baseFolder}/${langDir}`,
    commitSha: result.sha,
    commitUrl: result.url,
  };
}

// 회고만 수정해서 다시 commit (RETROSPECTIVE.md 한 파일만).
// 자동 upload 후 사용자가 회고 내용 검토하다 잘못된 부분 발견 시 사용.
// amend가 아닌 새 commit — history 보존 + force push 불필요.
export async function updateRetrospective(args: {
  problem: LeetCodeProblem;
  language: string;
  annotated: string;
}): Promise<UploadResult> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER 또는 GITHUB_REPO가 설정되지 않았습니다 — ⚙️ 설정에서 입력해주세요');
  }

  const num = String(args.problem.questionFrontendId).padStart(4, '0');
  const baseFolder = `${num}-${args.problem.titleSlug}`;
  const langDir = langToFolder(args.language);
  const retroPath = `${baseFolder}/${langDir}/RETROSPECTIVE.md`;

  const files: CommitFile[] = [{ path: retroPath, content: args.annotated }];
  const message = `fix: ${args.problem.questionFrontendId}. ${args.problem.title} (${langDir}) 회고 수정`;

  const result = await commitFiles(owner, repo, branch, files, message);

  return {
    folder: `${baseFolder}/${langDir}`,
    commitSha: result.sha,
    commitUrl: result.url,
  };
}

// 레포 자동 생성: owner가 본인 계정이면 createForAuthenticatedUser,
// 아니면 조직(org)으로 간주하고 createInOrg
export async function createRepoIfMissing(): Promise<{
  url: string;
  defaultBranch: string;
  scope: 'user' | 'org';
}> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER 또는 GITHUB_REPO가 설정되지 않았습니다 — ⚙️ 설정에서 입력해주세요');
  }

  const o = octokit();

  // 1) 인증된 사용자 username 확인 → 본인/조직 판별
  let authedLogin: string;
  try {
    const { data: user } = await o.users.getAuthenticated();
    authedLogin = user.login;
  } catch (err) {
    throw toGitHubError(err, { owner, repo, branch: 'main', stage: 'getAuthenticated' });
  }

  const isPersonal = authedLogin.toLowerCase() === owner.toLowerCase();

  // 2) 레포 생성
  const body = {
    name: repo,
    description: 'LeetCode solutions managed by iq-leetbuddy',
    private: false,
    auto_init: true, // README 자동 생성 → main 브랜치 보장
  };

  try {
    if (isPersonal) {
      const { data } = await o.repos.createForAuthenticatedUser(body);
      return {
        url: data.html_url,
        defaultBranch: data.default_branch || 'main',
        scope: 'user',
      };
    } else {
      const { data } = await o.repos.createInOrg({ org: owner, ...body });
      return {
        url: data.html_url,
        defaultBranch: data.default_branch || 'main',
        scope: 'org',
      };
    }
  } catch (err) {
    throw toGitHubError(err, { owner, repo, branch: 'main', stage: 'createRepo' });
  }
}

// ─── 풀이 통계 backfill — root README 인덱스에서 풀이 entry 추출 ─
// 사용자가 다른 디바이스에서 풀이했거나 v0.5 이전 풀이 (localStorage stats가
// 없던 시점)도 통계에 포함하기 위함. UI의 stats 모달 "GitHub에서 동기화"
// 버튼 → 이 함수 호출 → 결과를 localStorage solutions에 merge.
export async function fetchIndexFromGithub(): Promise<{
  entries: Array<{
    frontendId: number;
    title: string;
    titleSlug: string;
    difficulty: string;
    languages: string[];
    savedAt: string;
  }>;
}> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER 또는 GITHUB_REPO가 설정되지 않았습니다 — ⚙️ 설정에서 입력해주세요');
  }

  const readme = await fetchFileContent(owner, repo, 'README.md', branch);
  if (!readme) return { entries: [] };

  // parseExistingIndex는 이미 있음 (v0.5 root README 인덱스 update용)
  const entries = parseExistingIndex(readme);
  return { entries };
}

// 연결 진단: 토큰 유효성 + 레포 존재 확인 + 브랜치 일치 여부
export async function verifyConnection(): Promise<{
  authedAs: string;
  owner: string;
  repo: string;
  repoExists: boolean;
  repoUrl?: string;
  repoDefaultBranch?: string;
  configuredBranch: string;
  branchMatches?: boolean;
}> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER 또는 GITHUB_REPO가 설정되지 않았습니다 — ⚙️ 설정에서 입력해주세요');
  }

  const o = octokit();

  let authedAs: string;
  try {
    const { data } = await o.users.getAuthenticated();
    authedAs = data.login;
  } catch (err) {
    throw toGitHubError(err, { owner, repo, branch, stage: 'verify/auth' });
  }

  try {
    const { data } = await o.repos.get({ owner, repo });
    return {
      authedAs,
      owner,
      repo,
      repoExists: true,
      repoUrl: data.html_url,
      repoDefaultBranch: data.default_branch,
      configuredBranch: branch,
      branchMatches: data.default_branch === branch,
    };
  } catch (err) {
    const e = err as { status?: number };
    if (e?.status === 404) {
      return {
        authedAs,
        owner,
        repo,
        repoExists: false,
        configuredBranch: branch,
      };
    }
    throw toGitHubError(err, { owner, repo, branch, stage: 'verify/repo' });
  }
}
