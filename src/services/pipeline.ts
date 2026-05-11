// 파이프라인 오케스트레이션: fetch → translate (+ render HTML) / annotate → upload

import { fetchProblem } from './leetcode';
import { translateProblem } from './translator';
import { annotateCode } from './annotator';
import { uploadSolution } from './github';
import { renderMarkdown } from './markdown';
import { parseProblemInput } from '../util/language';
import { FetchProblemResult, UploadResult, LeetCodeProblem } from '../types';

export async function fetchAndTranslate(input: string): Promise<FetchProblemResult> {
  const titleSlug = parseProblemInput(input);
  const problem = await fetchProblem(titleSlug);
  const translation = await translateProblem(problem);
  const translationHtml = await renderMarkdown(translation);
  return { problem, translation, translationHtml };
}

export async function annotateAndUpload(args: {
  problem: LeetCodeProblem;
  translation: string;
  code: string;
  language: string;
}): Promise<UploadResult> {
  const annotated = await annotateCode(
    args.problem,
    args.translation,
    args.code,
    args.language
  );
  return uploadSolution({
    problem: args.problem,
    translation: args.translation,
    code: args.code,
    language: args.language,
    annotated,
  });
}
