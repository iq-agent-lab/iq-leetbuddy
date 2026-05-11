// Electron 메인 프로세스
// v0.2.4: embedded LeetCode 윈도우, 영속 세션, 링크 인터셉트, 강건한 단축키

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  screen,
  globalShortcut,
  shell,
  session,
} from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { registerIpcHandlers, setLeetCodeOpener, setShortcutGetter } from './ipc';

// .env 로드 — 패키지 모드는 userData, dev 모드는 프로젝트 루트
function loadEnv() {
  const envFile = app.isPackaged
    ? path.join(app.getPath('userData'), '.env')
    : path.join(__dirname, '../../.env');
  dotenv.config({ path: envFile });
}

let mainWindow: BrowserWindow | null = null;
let leetcodeWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let activeShortcut: string | null = null;

// LeetCode URL 판별
function isLeetCodeUrl(url: string): boolean {
  return /^https?:\/\/(?:www\.)?leetcode\.(?:com|cn)/i.test(url);
}

// 외부/embedded 라우팅
function routeUrl(url: string) {
  if (isLeetCodeUrl(url)) {
    openLeetCodeWindow(url);
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    shell.openExternal(url);
  }
}

// ─── LeetCode embedded 윈도우 ──────────────────────────────
function openLeetCodeWindow(url: string = 'https://leetcode.com/') {
  if (leetcodeWindow && !leetcodeWindow.isDestroyed()) {
    leetcodeWindow.loadURL(url);
    leetcodeWindow.show();
    leetcodeWindow.focus();
    if (process.platform === 'darwin') app.focus({ steal: true });
    return;
  }

  // 영속 세션 - 한 번 로그인하면 다음 실행까지 유지
  const lcSession = session.fromPartition('persist:leetcode');

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  leetcodeWindow = new BrowserWindow({
    width: Math.min(1400, Math.floor(sw * 0.7)),
    height: Math.min(1100, Math.floor(sh * 0.92)),
    title: 'LeetCode',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      session: lcSession,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  leetcodeWindow.loadURL(url);

  leetcodeWindow.on('closed', () => {
    leetcodeWindow = null;
  });

  // LeetCode 안의 외부 링크는 외부 브라우저로
  leetcodeWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    if (isLeetCodeUrl(openUrl)) {
      leetcodeWindow?.loadURL(openUrl);
    } else {
      shell.openExternal(openUrl);
    }
    return { action: 'deny' };
  });
}

// ─── 메인 윈도우 ──────────────────────────────
function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = Math.min(1100, Math.max(840, Math.floor(sw * 0.55)));
  const winHeight = Math.min(1100, Math.max(800, Math.floor(sh * 0.92)));

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 720,
    minHeight: 600,
    show: false,
    title: 'iq-leetbuddy',
    backgroundColor: '#0f0e0d',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 메인 윈도우 안에서 우리 file:// 외 navigation은 모두 차단하고 라우팅
  // 이게 핵심: 원문 링크 클릭해도 leetbuddy UI가 안 사라짐
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (navUrl.startsWith('file://')) return;
    event.preventDefault();
    routeUrl(navUrl);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    routeUrl(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// ─── 강제 활성화 (단축키, 트레이 클릭에서 사용) ──────────────────────────────
function showAndFocus() {
  if (!mainWindow) {
    createWindow();
    const win = mainWindow as BrowserWindow | null;
    win?.once('ready-to-show', () => {
      win?.show();
      win?.focus();
    });
    return;
  }

  if (!mainWindow.isVisible()) mainWindow.show();

  // macOS에서 background app이 강제로 앞으로 나오는 트릭:
  // 1) alwaysOnTop true (잠깐 최상위로)
  // 2) focus + moveTop
  // 3) alwaysOnTop false (붙박이 해제)
  mainWindow.setAlwaysOnTop(true);
  mainWindow.focus();
  if (process.platform === 'darwin') {
    app.focus({ steal: true });
  }
  mainWindow.moveTop();
  mainWindow.setAlwaysOnTop(false);
}

function toggleWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    showAndFocus();
  }
}

// ─── 단축키 등록 (fallback chain) ──────────────────────────────
function registerShortcuts() {
  // 충돌 가능성 낮은 순으로 시도
  const candidates = [
    'CmdOrCtrl+Alt+L',   // 1순위: Cmd+Option+L
    'CmdOrCtrl+Alt+B',   // 2순위: B for Buddy
    'CmdOrCtrl+Alt+J',   // 3순위
    'CmdOrCtrl+Shift+L', // 4순위 (Safari Reading List와 충돌)
  ];

  for (const sc of candidates) {
    try {
      const ok = globalShortcut.register(sc, showAndFocus);
      if (ok && globalShortcut.isRegistered(sc)) {
        activeShortcut = sc;
        console.log(`[shortcut] registered: ${sc}`);
        return;
      }
    } catch (e) {
      console.warn(`[shortcut] ${sc} 시도 실패:`, e);
    }
  }
  console.warn('[shortcut] 모든 단축키 등록 실패');
}

// ─── 트레이 ──────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  let image = nativeImage.createFromPath(iconPath);
  if (!image.isEmpty()) {
    image = image.resize({ width: 18, height: 18 });
    image.setTemplateImage(false);
  }
  tray = new Tray(image);

  const accelLabel = activeShortcut || '';

  const menu = Menu.buildFromTemplate([
    {
      label: 'iq-leetbuddy 보이기',
      accelerator: activeShortcut || undefined,
      click: showAndFocus,
    },
    {
      label: 'LeetCode 열기 (로그인)',
      click: () => openLeetCodeWindow(),
    },
    { type: 'separator' },
    {
      label: '종료',
      accelerator: 'Cmd+Q',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip(`iq-leetbuddy${accelLabel ? ` (${accelLabel})` : ''}`);
  tray.setContextMenu(menu);
  tray.on('click', toggleWindow);
}

// ─── 표준 메뉴바 ──────────────────────────────
function createAppMenu() {
  const isMac = process.platform === 'darwin';
  const menu = Menu.buildFromTemplate([
    ...(isMac
      ? [{
          label: 'iq-leetbuddy',
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'leetbuddy 보이기/포커스',
          accelerator: activeShortcut || undefined,
          click: showAndFocus,
        },
        {
          label: 'LeetCode 열기',
          click: () => openLeetCodeWindow(),
        },
        { type: 'separator' as const },
        { role: 'reload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' as const }, { role: 'close' as const }],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

// ─── 부트스트랩 ──────────────────────────────
app.whenReady().then(() => {
  loadEnv(); // app.isPackaged + app.getPath('userData') 사용 가능 시점

  // macOS Dock 아이콘 명시 (개발 모드에서도 코랄 행성 보이게)
  // 패키징된 앱은 .icns가 자동 사용됨
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, '../../build/icon.png');
    try {
      const dockImage = nativeImage.createFromPath(iconPath);
      if (!dockImage.isEmpty()) {
        app.dock.setIcon(dockImage);
      }
    } catch {
      // 무시 - 패키지된 앱은 어차피 .icns 사용
    }
  }

  registerShortcuts(); // 트레이/메뉴 빌드 전에 단축키 등록

  // IPC에 의존성 주입
  setLeetCodeOpener(openLeetCodeWindow);
  setShortcutGetter(() => activeShortcut);

  createAppMenu();
  createWindow();
  createTray();
  registerIpcHandlers();

  mainWindow?.once('ready-to-show', () => {
    mainWindow?.show();
  });

  app.on('activate', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 트레이 상주
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
