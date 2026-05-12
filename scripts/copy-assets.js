// 빌드 후 HTML/CSS/JS/assets를 dist/로 복사
const fs = require('fs');
const path = require('path');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${src} → ${dest}`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else {
      fs.copyFileSync(s, d);
      console.log(`  ✓ ${s} → ${d}`);
    }
  }
}

console.log('Copying assets...');
copyFile('src/renderer/index.html', 'dist/renderer/index.html');
copyFile('src/renderer/styles.css', 'dist/renderer/styles.css');
// renderer.ts는 tsc가 dist/renderer/renderer.js로 컴파일 (수동 복사 불필요)
copyDir('assets', 'dist/assets');

// ─── renderer.js 후처리 ────────────────────────────────────────────
// renderer.ts에 import type 한 줄만 있어도 tsc(commonjs target)는
//   "use strict";
//   Object.defineProperty(exports, "__esModule", { value: true });
// 코드를 prepend함. browser context엔 module system이 없어 exports가 undefined
// → ReferenceError 발생 → renderer.js 전체 실행 중단 → 모든 listener 등록 실패
// → 패키지 모드에서 버튼들이 안 먹는 증상.
//
// 해결: 컴파일 후 그 두 줄을 제거. 함수/타입에 영향 없음 (import type는 이미 erase).
(function postProcessRendererJs() {
  const rendererPath = path.join('dist', 'renderer', 'renderer.js');
  if (!fs.existsSync(rendererPath)) return;
  let content = fs.readFileSync(rendererPath, 'utf-8');
  const before = content.length;
  content = content.replace(
    /^"use strict";\s*\nObject\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*\n/,
    '"use strict";\n'
  );
  if (content.length !== before) {
    fs.writeFileSync(rendererPath, content, 'utf-8');
    console.log(`  ✓ dist/renderer/renderer.js — commonjs init 제거 (browser context 호환)`);
  }
})();

// highlight.js vendor 파일 — CDN 안 쓰고 로컬 번들 (CSP 깔끔, 오프라인 OK)
copyFile(
  'node_modules/@highlightjs/cdn-assets/highlight.min.js',
  'dist/vendor/highlight.min.js'
);
copyFile(
  'node_modules/@highlightjs/cdn-assets/styles/atom-one-dark.min.css',
  'dist/vendor/highlight-theme.css'
);

console.log('Done.');
