// 파이프라인 오케스트레이션

import { fetchProblem, resolveTitleSlugByFrontendId } from './leetcode';
import { translateProblem, StreamCallback } from './translator';
import { annotateCode } from './annotator';
import { uploadSolution, createRepoIfMissing } from './github';
import { renderMarkdown } from './markdown';
import { readTranslationCache, writeTranslationCache } from './cache';
import { parseProblemInput } from '../util/language';
import { FetchProblemResult, UploadResult, LeetCodeProblem } from '../types';

export type ProgressFn = (stage: string) => void;

export async function fetchAndTranslate(
  input: string,
  onProgress?: ProgressFn,
  onStream?: StreamCallback
): Promise<FetchProblemResult> {
  const parsed = parseProblemInput(input);

  // 숫자 입력 (예: "1") — frontendId → slug 해결 후 진행
  let titleSlug = parsed.titleSlug;
  const isCN = parsed.isCN;
  if (parsed.isNumericId && parsed.frontendId) {
    onProgress?.('resolving');
    titleSlug = await resolveTitleSlugByFrontendId(parsed.frontendId, isCN);
  }

  if (!titleSlug) {
    throw new Error('입력에서 문제 식별자를 찾지 못했어요 — URL/slug/문제 이름/번호 중 하나를 입력해주세요');
  }

  // 캐시 hit 시 LLM 호출 skip — chip 재클릭 / 같은 문제 다른 언어로 풀 때 즉시 로드
  // cn 도메인은 별도 캐시 키 (com/cn 번역 다를 수 있음)
  const cached = await readTranslationCache(titleSlug, isCN);
  if (cached) {
    onProgress?.('cached');
    return cached;
  }

  onProgress?.('fetching');
  const problem = await fetchProblem(titleSlug, isCN);

  onProgress?.('translating');
  const translation = await translateProblem(problem, onStream);
  const translationHtml = await renderMarkdown(translation);

  const result = { problem, translation, translationHtml };
  // 캐시 쓰기 실패해도 흐름엔 영향 X — fire-and-forget OK이지만 await로 순서 보장
  await writeTranslationCache(titleSlug, result, isCN);
  return result;
}

export async function annotateAndUpload(
  args: {
    problem: LeetCodeProblem;
    translation: string;
    code: string;
    language: string;
  },
  onProgress?: ProgressFn,
  onStream?: StreamCallback
): Promise<UploadResult & { annotatedHtml: string }> {
  // 1) AI 회고 생성 (가장 비싼 단계 - 한 번만 호출)
  onProgress?.('annotating');
  const annotated = await annotateCode(
    args.problem,
    args.translation,
    args.code,
    args.language,
    onStream
  );
  const annotatedHtml = await renderMarkdown(annotated);

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
    const result = await uploadSolution(uploadArgs);
    return { ...result, annotatedHtml };
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
      const result = await uploadSolution(uploadArgs);
      return { ...result, annotatedHtml };
    }
    throw err;
  }
}
