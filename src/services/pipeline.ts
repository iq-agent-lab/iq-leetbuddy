// 파이프라인 오케스트레이션: fetch → translate (+ render HTML) / annotate → upload

import { fetchProblem } from './leetcode';
import { translateProblem } from './translator';
import { annotateCode } from './annotator';
import { uploadSolution } from './github';
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
  onProgress?.('annotating');
  const annotated = await annotateCode(
    args.problem,
    args.translation,
    args.code,
    args.language
  );

  onProgress?.('uploading');
  return uploadSolution({
    problem: args.problem,
    translation: args.translation,
    code: args.code,
    language: args.language,
    annotated,
  });
}
