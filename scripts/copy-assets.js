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
