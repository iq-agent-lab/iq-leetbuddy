// 파이프라인 오케스트레이션

import { fetchProblem } from './leetcode';
import { translateProblem } from './translator';
import { annotateCode } from './annotator';
import { uploadSolution, createRepoIfMissing } from './github';
import { renderMarkdown } from './markdown';
import { parseProblemInput } from '../util/language';
import { FetchProblemResult, UploadResult, LeetCodeProblem } from '../types';

export type ProgressFn = (stage: string) => void;

export async function fetchAndTranslate(
  input: string,
  onProgress?: ProgressFn
): Promise<FetchProblemResult> {
  onProgress?.('fetching');
  const titleSlug = parseProblemInput(input);
  const problem = await fetchProblem(titleSlug);

  onProgress?.('translating');
  const translation = await translateProblem(problem);
  const translationHtml = await renderMarkdown(translation);
  return { problem, translation, translationHtml };
}

export async function annotateAndUpload(
  args: {
    problem: LeetCodeProblem;
    translation: string;
    code: string;
    language: string;
  },
  onProgress?: ProgressFn
): Promise<UploadResult> {
  // 1) AI 회고 생성 (가장 비싼 단계 - 한 번만 호출)
  onProgress?.('annotating');
  const annotated = await annotateCode(
    args.problem,
    args.translation,
    args.code,
    args.language
  );

  const uploadArgs = {
    problem: args.problem,
    translation: args.translation,
    code: args.code,
    language: args.language,
    annotated,
  };

  // 2) GitHub 업로드 시도
  onProgress?.('uploading');
  try {
    return await uploadSolution(uploadArgs);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const autoCreate = process.env.GITHUB_AUTO_CREATE_REPO === 'true';

    // 자동 생성 옵션이 켜져 있고 404면, 레포 만들고 한 번 더 시도
    // 핵심: annotated 결과를 재사용 → AI 호출 비용 추가 발생 X
    if (autoCreate && status === 404) {
      onProgress?.('creating-repo');
      await createRepoIfMissing();
      await new Promise((r) => setTimeout(r, 1500)); // propagation 대기
      onProgress?.('uploading');
      return uploadSolution(uploadArgs);
    }
    throw err;
  }
}
