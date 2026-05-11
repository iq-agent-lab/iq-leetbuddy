// 메인 프로세스의 IPC를 renderer에 안전하게 노출

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  fetchProblem: (input: string) => ipcRenderer.invoke('fetch-problem', input),
  uploadSolution: (payload: {
    problem: unknown;
    translation: string;
    code: string;
    language: string;
  }) => ipcRenderer.invoke('upload-solution', payload),
  checkConfig: () => ipcRenderer.invoke('check-config'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Record<string, string>) =>
    ipcRenderer.invoke('save-settings', settings),
  openLeetCode: (url?: string) => ipcRenderer.invoke('open-leetcode', url),

  onFetchProgress: (cb: (stage: string) => void) => {
    const handler = (_e: unknown, stage: string) => cb(stage);
    ipcRenderer.on('fetch-progress', handler);
    return () => ipcRenderer.removeListener('fetch-progress', handler);
  },
  onUploadProgress: (cb: (stage: string) => void) => {
    const handler = (_e: unknown, stage: string) => cb(stage);
    ipcRenderer.on('upload-progress', handler);
    return () => ipcRenderer.removeListener('upload-progress', handler);
  },
});
