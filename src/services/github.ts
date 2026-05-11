// GitHub API로 한 번의 commit에 3개 파일 (README, solution, RETROSPECTIVE) 업로드
// Octokit git data API 사용 - createOrUpdateFileContents는 파일당 commit 1개라 비효율

import { Octokit } from '@octokit/rest';
import { LeetCodeProblem, UploadResult } from '../types';
import { langToExt } from '../util/language';

// GitHub API 에러를 진단 가능한 한국어 메시지로 변환
function toGitHubError(
  err: unknown,
  context: { owner: string; repo: string; branch: string; stage: string }
): Error {
  const e = err as { status?: number; message?: string };
  const where = `[${context.stage}] ${context.owner}/${context.repo} · ${context.branch}`;

  if (e?.status === 404) {
    return new Error(
      `GitHub 리소스를 찾을 수 없습니다 (404)
현재 설정: ${context.owner}/${context.repo} (브랜치: ${context.branch})

가능한 원인:
• 레포 이름 불일치 — 설정의 GITHUB_REPO 값과 실제 GitHub 레포 이름이 다름
• 브랜치 이름이 다름 — main이 아니라 master일 수도
• 레포가 비어있음 — 첫 commit이 있어야 함 (README 하나 추가)
• PAT 권한 부족 — fine-grained 토큰이면 이 레포가 허용 목록에 있는지 확인

확인:
• https://github.com/${context.owner}/${context.repo} 접속 가능한지
• 헤더 우측 ⚙️ 클릭해 owner/repo/branch 정확한지 확인`
    );
  }
  if (e?.status === 401) {
    return new Error(
      'GitHub 토큰이 유효하지 않습니다 (401)\n헤더 ⚙️ 설정에서 새 PAT를 입력해주세요.'
    );
  }
  if (e?.status === 403) {
    return new Error(
      `GitHub 토큰 권한 부족 (403)\nPAT 발급 시 repo scope (또는 public_repo) 체크 필요.\n토큰: https://github.com/settings/tokens`
    );
  }
  if (e?.status === 409) {
    return new Error(
      `레포 충돌 상태 (409)\n${where}\n레포가 비어있을 가능성. README 하나 추가 후 재시도.`
    );
  }
  if (e?.status === 422) {
    return new Error(`요청 형식 오류 (422) ${where}\n${e.message || ''}`);
  }
  return new Error(`${e?.message || String(err)} ${where}`);
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
  const folder = `${num}-${args.problem.titleSlug}`;
  const ext = langToExt(args.language);

  const files: CommitFile[] = [
    {
      path: `${folder}/README.md`,
      content: args.translation,
    },
    {
      path: `${folder}/solution.${ext}`,
      content: args.code.endsWith('\n') ? args.code : args.code + '\n',
    },
    {
      path: `${folder}/RETROSPECTIVE.md`,
      content: args.annotated,
    },
  ];

  const message = `feat: ${args.problem.questionFrontendId}. ${args.problem.title} 풀이 추가`;

  const result = await commitFiles(owner, repo, branch, files, message);

  return {
    folder,
    commitSha: result.sha,
    commitUrl: result.url,
  };
}
