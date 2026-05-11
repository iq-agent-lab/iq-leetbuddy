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
      throw new Error('GITHUB_TOKEN이 설정되지 않았습니다 (.env 확인)');
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
    throw new Error('GITHUB_OWNER 또는 GITHUB_REPO가 설정되지 않았습니다 (.env 확인)');
  }

  const num = String(args.problem.questionFrontendId).padStart(4, '0');
  const baseFolder = `${num}-${args.problem.titleSlug}`;
  const ext = langToExt(args.language);
  const langDir = langToFolder(args.language);

  const files: CommitFile[] = [
    {
      // 한국어 번역: 모든 언어 풀이가 공유 (root에 위치, 매번 갱신되지만 내용 동일)
      path: `${baseFolder}/README.md`,
      content: args.translation,
    },
    {
      // 통과 코드: 언어별 하위 폴더
      path: `${baseFolder}/${langDir}/solution.${ext}`,
      content: args.code.endsWith('\n') ? args.code : args.code + '\n',
    },
    {
      // AI 회고: 언어별 하위 폴더 (언어마다 다른 코드 → 다른 회고)
      path: `${baseFolder}/${langDir}/RETROSPECTIVE.md`,
      content: args.annotated,
    },
  ];

  const message = `feat: ${args.problem.questionFrontendId}. ${args.problem.title} (${langDir}) 풀이 추가`;

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
    throw new Error('GITHUB_OWNER 또는 GITHUB_REPO가 설정되지 않았습니다');
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
    throw new Error('GITHUB_OWNER 또는 GITHUB_REPO가 설정되지 않았습니다');
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
