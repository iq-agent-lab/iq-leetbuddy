// Renderer에서 호출하는 IPC 핸들러

import { ipcMain, WebContents } from 'electron';
import { fetchAndTranslate, annotateAndUpload } from '../services/pipeline';
import { resetTranslatorClient } from '../services/translator';
import { resetAnnotatorClient } from '../services/annotator';
import { resetGithubClient, createRepoIfMissing, verifyConnection } from '../services/github';
import { renderMarkdown } from '../services/markdown';
import { getSettingsView, saveSettings, AppSettings } from './settings';

// streaming snapshot을 markdown → HTML로 변환해서 renderer에 push.
// throttle (120ms) + 순차 처리(renderPromise chain)로 race / 부하 회피.
function makeStreamForwarder(channel: string, sender: WebContents) {
  let pending = '';
  let timer: NodeJS.Timeout | null = null;
  let renderPromise: Promise<void> = Promise.resolve();

  const flush = () => {
    timer = null;
    const md = pending;
    renderPromise = renderPromise.then(async () => {
      if (!md) return;
      try {
        const html = await renderMarkdown(md);
        if (!sender.isDestroyed()) sender.send(channel, html);
      } catch {
        // marked가 incomplete markdown에서 throw하면 무시 (다음 flush에서 재시도)
      }
    });
  };

  const onStream = (snapshot: string) => {
    pending = snapshot;
    if (timer) return;
    timer = setTimeout(flush, 120);
  };

  const cleanup = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return { onStream, cleanup };
}

let leetcodeOpener: ((url?: string) => void) | null = null;
let leetcodeUrlGetter: (() => string | null) | null = null;
let pullCurrentUrl: (() => void) | null = null;
let shortcutGetter: (() => string | null) | null = null;

export function setLeetCodeOpener(fn: (url?: string) => void) {
  leetcodeOpener = fn;
}

export function setLeetCodeUrlGetter(fn: () => string | null) {
  leetcodeUrlGetter = fn;
}

export function setPullCurrentLeetCodeUrl(fn: () => void) {
  pullCurrentUrl = fn;
}

export function setShortcutGetter(fn: () => string | null) {
  shortcutGetter = fn;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function getStatus(err: unknown): number | null {
  const e = err as { status?: number };
  return typeof e?.status === 'number' ? e.status : null;
}

export function registerIpcHandlers() {
  ipcMain.handle('fetch-problem', async (event, input: string) => {
    const send = (stage: string) => event.sender.send('fetch-progress', stage);
    const { onStream, cleanup } = makeStreamForwarder('translate-stream', event.sender);
    try {
      const result = await fetchAndTranslate(input, send, onStream);
      cleanup();
      return { ok: true, ...result };
    } catch (err) {
      cleanup();
      return { ok: false, error: toErrorMessage(err), status: getStatus(err) };
    }
  });

  ipcMain.handle('upload-solution', async (event, payload) => {
    const send = (stage: string) => event.sender.send('upload-progress', stage);
    const { onStream, cleanup } = makeStreamForwarder('annotate-stream', event.sender);
    try {
      const result = await annotateAndUpload(payload, send, onStream);
      cleanup();
      return { ok: true, ...result };
    } catch (err) {
      cleanup();
      return { ok: false, error: toErrorMessage(err), status: getStatus(err) };
    }
  });

  ipcMain.handle('create-repo', async () => {
    try {
      const result = await createRepoIfMissing();
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: toErrorMessage(err), status: getStatus(err) };
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
      shortcut: shortcutGetter ? shortcutGetter() : null,
    };
  });

  // ── 설정 (시크릿은 노출하지 않고 hasXxx 플래그로) ──
  ipcMain.handle('get-settings', async () => {
    return getSettingsView();
  });

  // ── GitHub 연결 진단 (토큰 + 레포 존재 확인) ──
  ipcMain.handle('verify-github', async () => {
    try {
      const result = await verifyConnection();
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: toErrorMessage(err), status: getStatus(err) };
    }
  });

  // ── 설정 저장 ──
  ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
    try {
      await saveSettings(settings);
      // 클라이언트 캐시 무효화 → 새 키 즉시 반영
      resetTranslatorClient();
      resetAnnotatorClient();
      resetGithubClient();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: toErrorMessage(err) };
    }
  });

  // ── LeetCode embedded 윈도우 열기 ──
  ipcMain.handle('open-leetcode', async (_event, url?: string) => {
    if (leetcodeOpener) leetcodeOpener(url);
    return { ok: true };
  });

  // ── 임베드 LeetCode 윈도우의 현재 URL 조회 (메인 input '가져오기' 보조 버튼용) ──
  ipcMain.handle('get-leetcode-url', async () => {
    const url = leetcodeUrlGetter ? leetcodeUrlGetter() : null;
    return { ok: !!url, url };
  });

  // ── 임베드 LeetCode 윈도우 URL을 메인 input으로 끌어오기 (자동 fetch 트리거) ──
  ipcMain.handle('pull-leetcode-url', async () => {
    if (pullCurrentUrl) {
      pullCurrentUrl();
      return { ok: true };
    }
    return { ok: false };
  });
}
