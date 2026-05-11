// Electron 메인 프로세스: 윈도우 + 트레이 + 생명주기 관리
// 트레이 아이콘에 상주, 클릭으로 토글

import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { registerIpcHandlers } from './ipc';

// .env 로드 (앱 root 기준)
dotenv.config({ path: path.join(__dirname, '../../.env') });

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 780,
    height: 900,
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

  // 창 닫기를 트레이로 숨기는 것으로 변경 (Cmd+Q 또는 메뉴에서 종료해야 진짜 종료)
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 개발 모드일 때 devtools 자동 열기
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function toggleWindow() {
  if (!mainWindow) {
    createWindow();
    const win = mainWindow as BrowserWindow | null;
    win?.once('ready-to-show', () => win?.show());
    return;
  }
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  let image = nativeImage.createFromPath(iconPath);
  if (!image.isEmpty()) {
    image = image.resize({ width: 18, height: 18 });
    // macOS 메뉴바에서 light/dark 모두 잘 보이게
    image.setTemplateImage(false);
  }
  tray = new Tray(image);

  const menu = Menu.buildFromTemplate([
    {
      label: 'iq-leetbuddy 열기',
      click: () => {
        if (!mainWindow) createWindow();
        mainWindow?.show();
        mainWindow?.focus();
      },
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

  tray.setToolTip('iq-leetbuddy');
  tray.setContextMenu(menu);
  tray.on('click', toggleWindow);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerIpcHandlers();

  // 보여줄 준비 됐을 때 show (깜빡임 방지)
  mainWindow?.once('ready-to-show', () => {
    mainWindow?.show();
  });

  app.on('activate', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });
});

// macOS에서는 모든 창이 닫혀도 앱 유지 (트레이 상주)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Windows/Linux는 트레이만 남기고 윈도우 없는 상태 OK
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
