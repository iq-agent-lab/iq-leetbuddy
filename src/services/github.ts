// GitHub API로 한 번의 commit에 3개 파일 (README, solution, RETROSPECTIVE) 업로드
// Octokit git data API 사용 - createOrUpdateFileContents는 파일당 commit 1개라 비효율

import { Octokit } from '@octokit/rest';
import { LeetCodeProblem, UploadResult } from '../types';
import { langToExt } from '../util/language';

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

  // 1. 현재 브랜치의 최신 commit SHA
  const { data: refData } = await o.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const latestCommitSha = refData.object.sha;

  // 2. 그 commit의 tree SHA (base tree)
  const { data: commitData } = await o.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha,
  });
  const baseTreeSha = commitData.tree.sha;

  // 3. 각 파일을 blob으로 업로드
  const blobs = await Promise.all(
    files.map((f) =>
      o.git.createBlob({
        owner,
        repo,
        content: Buffer.from(f.content, 'utf-8').toString('base64'),
        encoding: 'base64',
      })
    )
  );

  // 4. 새 tree 생성 (base tree 위에 파일들 추가/덮어쓰기)
  const { data: newTree } = await o.git.createTree({
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

  // 5. 새 commit 생성
  const { data: newCommit } = await o.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [latestCommitSha],
  });

  // 6. 브랜치 ref 업데이트
  await o.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

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
