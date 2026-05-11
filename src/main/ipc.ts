// Renderer에서 호출하는 IPC 핸들러
// 모든 API 통신(LeetCode, Claude, GitHub)은 메인 프로세스에서 처리 (CORS/키 노출 회피)

import { ipcMain } from 'electron';
import { fetchAndTranslate, annotateAndUpload } from '../services/pipeline';

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function registerIpcHandlers() {
  ipcMain.handle('fetch-problem', async (_event, input: string) => {
    try {
      const result = await fetchAndTranslate(input);
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: toErrorMessage(err) };
    }
  });

  ipcMain.handle('upload-solution', async (_event, payload) => {
    try {
      const result = await annotateAndUpload(payload);
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: toErrorMessage(err) };
    }
  });

  ipcMain.handle('check-config', async () => {
    return {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      github: !!(
        process.env.GITHUB_TOKEN &&
        process.env.GITHUB_OWNER &&
        process.env.GITHUB_REPO
      ),
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
    };
  });
}
