// renderer.ts — Electron renderer (contextIsolation)
// import는 type만 — 런타임 컴파일 후 erase되어 vanilla JS와 동일
import type { LeetCodeProblem, UploadPayload, SettingsView, CheckConfigResult } from '../types';

// ─── DOM helpers ─────────────────────────────────────────────
// id로 element 조회. 모두 보장된 id라서 cast 안전.
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as unknown as T;
}

// 자주 쓰는 specific element 단축
const $input = (id: string) => $<HTMLInputElement>(id);
const $btn = (id: string) => $<HTMLButtonElement>(id);
const $select = (id: string) => $<HTMLSelectElement>(id);

// CodeMirror 5 — global (UMD)
declare const CodeMirror: any;

// LeetCode langSlug → CodeMirror 5 MIME mode
// 미지원 lang은 text/plain fallback (syntax color 없음, 편집은 정상)
const CM5_MODE: Record<string, string> = {
  java: 'text/x-java',
  cpp: 'text/x-c++src',
  c: 'text/x-csrc',
  csharp: 'text/x-csharp',
  'c#': 'text/x-csharp',
  kotlin: 'text/x-kotlin',
  scala: 'text/x-scala',
  python: 'text/x-python',
  python3: 'text/x-python',
  javascript: 'text/javascript',
  typescript: 'application/typescript',
  go: 'text/x-go',
  golang: 'text/x-go',
  rust: 'text/x-rustsrc',
  swift: 'text/x-swift',
  ruby: 'text/x-ruby',
  dart: 'application/dart',
};

let cmEditor: any = null;

function initCodeEditor(): void {
  const container = $('code-editor');
  if (typeof CodeMirror === 'undefined') {
    console.warn('CodeMirror not loaded');
    return;
  }
  cmEditor = CodeMirror(container, {
    value: '',
    mode: 'text/plain',
    theme: 'material-darker',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    lineWrapping: false,
    placeholder: '// 여기에 통과한 코드를 붙여넣어주세요 (또는 위 버튼으로 자동 가져오기)',
  });
}

function setEditorLang(slug: string | null): void {
  if (!cmEditor) return;
  const mode = (slug && CM5_MODE[slug.toLowerCase()]) || 'text/plain';
  cmEditor.setOption('mode', mode);
}

function getEditorCode(): string {
  return cmEditor ? cmEditor.getValue() : '';
}

function setEditorCode(code: string): void {
  if (!cmEditor) return;
  cmEditor.setValue(code);
}

// ─── progress 메시지 ─────────────────────────────────────────
const FETCH_PROGRESS_TEXT: Record<string, string> = {
  resolving: '문제 번호로 검색 중...',
  fetching: 'LeetCode에서 문제 가져오는 중...',
  translating: '한국어로 번역 중...',
  cached: '캐시에서 즉시 로드',
};

const UPLOAD_PROGRESS_TEXT: Record<string, string> = {
  annotating: 'AI 회고 작성 중...',
  uploading: 'GitHub에 commit 중...',
  'creating-repo': '레포 자동 생성 중...',
};

function setButtonLoading(btnId: string, loadingText: string): void {
  const btn = $btn(btnId);
  btn.disabled = true;
  const content = btn.querySelector('.btn-content') as HTMLElement | null;
  if (content) content.innerHTML = `<span class="spinner"></span>${loadingText}`;
}

function resetButton(btnId: string, originalText: string): void {
  const btn = $btn(btnId);
  btn.disabled = false;
  const content = btn.querySelector('.btn-content') as HTMLElement | null;
  if (content) content.textContent = originalText;
}

// ─── app state ───────────────────────────────────────────────
interface AppState {
  problem: LeetCodeProblem | null;
  translation: string;
  selectedLang: string | null;
  lastUploadPayload: UploadPayload | null;
}

const state: AppState = {
  problem: null,
  translation: '',
  selectedLang: null,
  lastUploadPayload: null,
};

type StatusKind = 'busy' | 'ok' | 'error' | undefined;

function setStatus(text: string, kind?: StatusKind): void {
  $('status').textContent = text;
  const dot = $('status-dot');
  dot.classList.remove('busy', 'ok', 'error');
  if (kind) dot.classList.add(kind);
}

function showStep(num: number): void {
  $(`step-${num}`).classList.remove('hidden');
}

function formatShortcutForDisplay(sc: string | null): string {
  if (!sc) return '';
  return sc
    .replace('CmdOrCtrl', '⌘')
    .replace('Cmd', '⌘')
    .replace('Ctrl', '⌃')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace(/\+/g, '');
}

// ─── 첫 실행 자동 settings prompt ────────────────────────────
// 매 부팅 동안 한 번만 — 사용자가 닫아도 같은 세션에선 다시 안 띄움.
let firstRunPromptShown = false;

async function checkConfig(): Promise<void> {
  try {
    const cfg: CheckConfigResult = await window.api.checkConfig();
    const el = $('config-status');
    if (cfg.anthropic && cfg.github) {
      el.textContent = `→ ${cfg.owner}/${cfg.repo}`;
      el.classList.add('ok');
      el.classList.remove('warning');
    } else {
      const missing: string[] = [];
      if (!cfg.anthropic) missing.push('Anthropic');
      if (!cfg.github) missing.push('GitHub');
      el.textContent = `설정 필요: ${missing.join(', ')} (⚙️ 클릭)`;
      el.classList.add('warning');
      el.classList.remove('ok');

      // 둘 다 비어있으면 처음 켠 것 — settings 모달 자동 안내
      if (!cfg.anthropic && !cfg.github && !firstRunPromptShown) {
        firstRunPromptShown = true;
        setTimeout(() => {
          if ($('settings-modal').classList.contains('hidden')) {
            openSettings();
            setStatus('처음 설정 — Anthropic API Key와 GitHub Token을 입력해주세요', 'busy');
          }
        }, 500);
      }
    }
    // 단축키 표시
    const scEl = $('shortcut-status');
    if (cfg.shortcut) {
      const display = formatShortcutForDisplay(cfg.shortcut);
      scEl.textContent = `${display} 으로 어디서든 호출`;
      // step 2 hint도 함께 갱신
      const hint = $('step-2-hint');
      hint.innerHTML = `읽고 LeetCode에서 풀어. 풀고 나면 <kbd>${display}</kbd>로 돌아와.`;
    } else {
      scEl.textContent = '단축키 등록 실패';
    }
  } catch {
    $('config-status').textContent = '설정 확인 실패';
  }
}

// ─── 최근 풀이 5개 (localStorage chips) ──────────────────────
const RECENT_KEY = 'iq-leetbuddy:recent-problems';
const RECENT_MAX = 5;

interface RecentItem {
  frontendId: string;
  title: string;
  titleSlug: string;
  savedAt: number;
}

function readRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as RecentItem[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(problem: LeetCodeProblem): void {
  try {
    const item: RecentItem = {
      frontendId: problem.questionFrontendId,
      title: problem.title,
      titleSlug: problem.titleSlug,
      savedAt: Date.now(),
    };
    const filtered = readRecent().filter((p) => p.titleSlug !== item.titleSlug);
    filtered.unshift(item);
    const sliced = filtered.slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(sliced));
    renderRecent();
  } catch {
    // localStorage 사용 불가 시 무시
  }
}

function renderRecent(): void {
  const arr = readRecent();
  const wrap = $('recent-row');
  if (arr.length === 0) {
    wrap.classList.add('hidden');
    wrap.innerHTML = '';
    return;
  }
  const chips = arr
    .map((p) => {
      const slug = escapeHtml(p.titleSlug);
      const title = escapeHtml(p.title);
      const id = escapeHtml(String(p.frontendId));
      return `<button class="recent-chip" data-slug="${slug}" title="${id}. ${title}"><span class="recent-chip-id">${id}.</span>${title}</button>`;
    })
    .join('');
  wrap.innerHTML = `<span class="recent-label">최근</span>${chips}`;
  wrap.classList.remove('hidden');
}

// ─── 풀이 통계 (localStorage) ────────────────────────────────
const SOLUTIONS_KEY = 'iq-leetbuddy:solutions';

interface SolutionRecord {
  frontendId: number;
  title: string;
  titleSlug: string;
  language: string;
  difficulty: string;
  savedAt: number; // unix ms
}

function readSolutions(): SolutionRecord[] {
  try {
    const raw = localStorage.getItem(SOLUTIONS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SolutionRecord[]) : [];
  } catch {
    return [];
  }
}

function recordSolution(rec: SolutionRecord): void {
  try {
    const all = readSolutions();
    // 같은 slug+language면 update (재upload 케이스) — 최신으로 갱신
    const filtered = all.filter((s) => !(s.titleSlug === rec.titleSlug && s.language === rec.language));
    filtered.unshift(rec);
    localStorage.setItem(SOLUTIONS_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage 사용 불가 환경 무시
  }
}

function findExistingSolution(titleSlug: string, language: string): SolutionRecord | undefined {
  return readSolutions().find((s) => s.titleSlug === titleSlug && s.language === language);
}

// step-3에 "이미 같은 언어로 풀이 있어요" 알림 표시
// localStorage 기반 — 다른 디바이스 풀이는 못 잡지만 같은 디바이스는 정확
function updateDuplicateWarning(): void {
  const el = $('duplicate-warning');
  if (!state.problem || !state.selectedLang) {
    el.classList.add('hidden');
    return;
  }
  const existing = findExistingSolution(state.problem.titleSlug, state.selectedLang);
  if (!existing) {
    el.classList.add('hidden');
    return;
  }
  const daysAgo = Math.floor((Date.now() - existing.savedAt) / 86400000);
  const when = daysAgo === 0 ? '오늘' : daysAgo === 1 ? '어제' : `${daysAgo}일 전`;
  el.innerHTML = `<span class="duplicate-icon">⚠</span><span><strong>${escapeHtml(state.selectedLang)}</strong>로 ${when} 풀이를 이미 올렸어요. 업로드하면 회고가 새로 생성되고 같은 폴더의 코드/회고가 갱신됩니다.<br><span class="duplicate-sub">— 의도된 동작이면 그대로 진행해주세요.</span></span>`;
  el.classList.remove('hidden');
}

// ─── 통계 dashboard 렌더링 ───────────────────────────────────
function ymKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ymdKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 연속 풀이 일수 (오늘 또는 어제부터 거꾸로 카운트)
function computeStreak(solutions: SolutionRecord[]): number {
  if (solutions.length === 0) return 0;
  const days = new Set(solutions.map((s) => ymdKey(s.savedAt)));
  let streak = 0;
  const now = new Date();
  // 오늘부터 시작 — 오늘이 없으면 어제부터 (시간대 보정 없이 단순)
  const start = days.has(ymdKey(now.getTime())) ? now : new Date(now.getTime() - 86400000);
  for (let i = 0; ; i++) {
    const d = new Date(start.getTime() - i * 86400000);
    if (days.has(ymdKey(d.getTime()))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function renderBarRow(label: string, count: number, max: number, extraClass = ''): string {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return `<div class="stats-bar-row">
    <span class="stats-bar-label">${escapeHtml(label)}</span>
    <div class="stats-bar-track"><div class="stats-bar-fill ${extraClass}" style="width: ${pct}%"></div></div>
    <span class="stats-bar-count">${count}</span>
  </div>`;
}

function renderStatsDashboard(): void {
  const solutions = readSolutions();
  const empty = $('stats-empty');
  const content = $('stats-content');

  if (solutions.length === 0) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  content.classList.remove('hidden');

  // 요약
  $('stats-total').textContent = String(solutions.length);

  const now = new Date();
  const thisYM = ymKey(now.getTime());
  const sevenDaysAgo = now.getTime() - 7 * 86400000;
  $('stats-this-month').textContent = String(solutions.filter((s) => ymKey(s.savedAt) === thisYM).length);
  $('stats-week').textContent = String(solutions.filter((s) => s.savedAt >= sevenDaysAgo).length);
  const streakValueEl = $('stats-streak');
  // streak는 숫자 + "일" suffix — innerHTML로 unit span 유지
  streakValueEl.innerHTML = `${computeStreak(solutions)}<span class="stats-value-unit">일</span>`;

  // 난이도 분포
  const diffOrder = ['Easy', 'Medium', 'Hard'];
  const diffClass: Record<string, string> = { Easy: 'easy', Medium: 'medium', Hard: 'hard' };
  const diffCounts: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 };
  for (const s of solutions) {
    if (diffCounts[s.difficulty] !== undefined) diffCounts[s.difficulty]++;
  }
  const maxDiff = Math.max(...Object.values(diffCounts), 1);
  $('stats-difficulty').innerHTML = diffOrder
    .map((d) => renderBarRow(d, diffCounts[d], maxDiff, diffClass[d]))
    .join('');

  // 언어 분포 (사용 언어만, 카운트 내림차순)
  const langCounts: Record<string, number> = {};
  for (const s of solutions) {
    langCounts[s.language] = (langCounts[s.language] || 0) + 1;
  }
  const sortedLangs = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);
  const maxLang = sortedLangs.length > 0 ? sortedLangs[0][1] : 1;
  $('stats-language').innerHTML = sortedLangs.map(([l, c]) => renderBarRow(l, c, maxLang)).join('');

  // 월별 (최근 6개월)
  const months: { ym: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getMonth() + 1}월`;
    months.push({ ym, label });
  }
  const monthCounts: Record<string, number> = {};
  for (const s of solutions) {
    monthCounts[ymKey(s.savedAt)] = (monthCounts[ymKey(s.savedAt)] || 0) + 1;
  }
  const maxMonth = Math.max(...months.map((m) => monthCounts[m.ym] || 0), 1);
  $('stats-monthly').innerHTML = months
    .map((m) => {
      const c = monthCounts[m.ym] || 0;
      const pct = (c / maxMonth) * 100;
      return `<div class="stats-month-col">
        <span class="stats-month-count">${c > 0 ? c : ''}</span>
        <div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: ${pct}%"></div></div>
        <span class="stats-month-label">${m.label}</span>
      </div>`;
    })
    .join('');

  // 최근 풀이 10개 (이미 unshift로 최신 우선)
  const recent = solutions.slice(0, 10);
  $('stats-recent').innerHTML = recent
    .map((s) => {
      const date = ymdKey(s.savedAt);
      return `<div class="stats-recent-row">
        <span class="stats-recent-id">#${s.frontendId}</span>
        <span class="stats-recent-title" title="${escapeHtml(s.title)}">${escapeHtml(s.title)}</span>
        <span class="stats-recent-lang">${escapeHtml(s.language)}</span>
        <span class="stats-recent-date">${date}</span>
      </div>`;
    })
    .join('');
}

function openStats(): void {
  renderStatsDashboard();
  $('stats-modal').classList.remove('hidden');
}

function closeStats(): void {
  $('stats-modal').classList.add('hidden');
}

// ─── 마지막 선택 언어 기억 ───────────────────────────────────
const PREFERRED_LANG_KEY = 'iq-leetbuddy:preferred-lang';

function getPreferredLang(): string | null {
  try {
    return localStorage.getItem(PREFERRED_LANG_KEY);
  } catch {
    return null;
  }
}

function setPreferredLang(slug: string): void {
  try {
    localStorage.setItem(PREFERRED_LANG_KEY, slug);
  } catch {
    // localStorage 사용 불가 환경 무시
  }
}

interface CodeSnippetLite {
  lang: string;
  langSlug: string;
  code: string;
}

function populateLanguageSelect(snippets: CodeSnippetLite[] | undefined): void {
  const select = $select('starter-lang-select');
  select.innerHTML = '';

  if (!snippets || snippets.length === 0) {
    $('starter-block').classList.add('hidden');
    return;
  }

  const PREFERRED_ORDER = ['java', 'python3', 'cpp', 'javascript', 'typescript', 'go', 'kotlin', 'rust'];
  const sorted = [...snippets].sort((a, b) => {
    const ai = PREFERRED_ORDER.indexOf(a.langSlug);
    const bi = PREFERRED_ORDER.indexOf(b.langSlug);
    if (ai === -1 && bi === -1) return a.lang.localeCompare(b.lang);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  sorted.forEach((snip) => {
    const opt = document.createElement('option');
    opt.value = snip.langSlug;
    opt.textContent = snip.lang;
    select.appendChild(opt);
  });

  // 우선순위: 마지막 선택 lang → java (보편 default) → 첫 번째
  const stored = getPreferredLang();
  const defaultSlug =
    (stored && sorted.find((s) => s.langSlug === stored)?.langSlug) ||
    sorted.find((s) => s.langSlug === 'java')?.langSlug ||
    sorted[0].langSlug;
  select.value = defaultSlug;
  state.selectedLang = defaultSlug;

  updateStarterCode();
  setEditorLang(defaultSlug);
  $('starter-block').classList.remove('hidden');
}

// LeetCode langSlug → highlight.js 언어명 매핑
const HLJS_LANG_MAP: Record<string, string> = {
  python: 'python',
  python3: 'python',
  java: 'java',
  javascript: 'javascript',
  typescript: 'typescript',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  'c#': 'csharp',
  go: 'go',
  golang: 'go',
  rust: 'rust',
  kotlin: 'kotlin',
  swift: 'swift',
  ruby: 'ruby',
  scala: 'scala',
  php: 'php',
  dart: 'dart',
  elixir: 'elixir',
  erlang: 'erlang',
};

const NO_SNIPPET_MESSAGE = `// 이 언어의 시작 코드가 LeetCode에 등록되어 있지 않아요.
//
// 다음 중 하나로 진행:
//   1) 위에서 다른 언어 선택
//   2) LeetCode 페이지에서 시작 코드를 직접 복사 → 03 단계에 붙여넣기`;

// 마크다운 렌더링된 영역(번역/회고)의 pre code 블록들에 syntax highlighting 적용.
// streaming 중 매 청크마다 호출하면 부하 — final HTML 교체 시점에만 한 번 호출.
//
// 회고 prompt에서 ```${language}로 코드 펜스 — language는 LeetCode langSlug
// (예: python3, golang, csharp 등). marked가 그대로 class="language-python3"
// 붙이지만 hljs는 'python3' 모름 → 아무 색도 안 입혀짐 (plain text 표시).
// HLJS_LANG_MAP으로 langSlug → hljs 표준 lang으로 변환해야 색이 적용됨.
function highlightCodeBlocks(container: HTMLElement | null): void {
  if (!container || !window.hljs) return;
  container.querySelectorAll<HTMLElement>('pre code').forEach((block) => {
    const cls = block.className || '';
    const match = cls.match(/language-(\S+)/);
    if (match) {
      const langSlug = match[1].toLowerCase();
      const hlLang = HLJS_LANG_MAP[langSlug] || langSlug;
      if (hlLang !== langSlug) {
        block.className = cls.replace(`language-${match[1]}`, `language-${hlLang}`);
      }
    }
    delete block.dataset.highlighted;
    try {
      window.hljs!.highlightElement(block);
    } catch {
      // 알 수 없는 언어 등은 plaintext로 떨어짐 — 무시
    }
  });
}

function updateStarterCode(): void {
  if (!state.problem) return;
  const slug = state.selectedLang;
  const snip = state.problem.codeSnippets?.find((s) => s.langSlug === slug);
  const codeEl = $('starter-code');

  codeEl.textContent = snip ? snip.code : NO_SNIPPET_MESSAGE;

  // highlight.js 적용
  if (window.hljs && snip && slug) {
    const hlLang = HLJS_LANG_MAP[slug] || 'plaintext';
    codeEl.className = `language-${hlLang}`;
    delete codeEl.dataset.highlighted;
    try {
      window.hljs.highlightElement(codeEl);
    } catch {
      // 알 수 없는 언어 등은 plaintext로 떨어지면 됨
    }
  }
}

// (구) textarea + hljs overlay 코드는 CodeMirror 5로 대체됨 — setEditorLang 사용

// ─── credential 에러 자동 모달 ───────────────────────────────
function isCredentialError(msg: string | undefined | null): boolean {
  if (!msg) return false;
  return /API_KEY|GITHUB_TOKEN|GITHUB_OWNER|GITHUB_REPO/i.test(msg) &&
    /설정되지 않았|미설정|not set/i.test(msg);
}

function isAuthError(msg: string | undefined | null): boolean {
  if (!msg) return false;
  return /401|토큰이 유효하지 않/i.test(msg);
}

function offerSettingsOnCredentialError(msg: string | undefined | null): boolean {
  if (!isCredentialError(msg) && !isAuthError(msg)) return false;
  setStatus('인증 정보가 필요해요 — 설정 모달을 열게요', 'error');
  setTimeout(() => {
    if ($('settings-modal').classList.contains('hidden')) {
      openSettings();
    }
  }, 600);
  return true;
}

// ─── input shake (fetch 실패 시) ─────────────────────────────
function flashInputError(): void {
  const el = $input('problem-input');
  el.classList.remove('input-error');
  // reflow 강제 → 같은 클래스 재적용 시 애니메이션 재실행
  void el.offsetWidth;
  el.classList.add('input-error');
  setTimeout(() => el.classList.remove('input-error'), 1500);
}

// ─── handleFetch ─────────────────────────────────────────────
async function handleFetch(): Promise<void> {
  const input = $input('problem-input').value.trim();
  if (!input) {
    setStatus('문제 URL 또는 slug를 입력해주세요', 'error');
    flashInputError();
    $input('problem-input').focus();
    return;
  }

  setStatus('문제 가져오는 중...', 'busy');
  setButtonLoading('fetch-btn', '가져오는 중...');

  // streaming을 받을 영역을 미리 보여줌 (step-2)
  $('translation-output').innerHTML = '<div class="streaming-loader">번역 진행 중...</div>';
  $('starter-block').classList.add('hidden');
  $('step-3').classList.add('hidden');
  $('step-4').classList.add('hidden');
  showStep(2);

  try {
    const result = await window.api.fetchProblem(input);
    if (!result.ok) throw new Error(result.error);

    state.problem = result.problem!;
    state.translation = result.translation!;

    // streaming 끝났으니 최종 (안정적인) HTML로 교체
    $('translation-output').innerHTML = result.translationHtml!;
    highlightCodeBlocks($('translation-output'));
    populateLanguageSelect(state.problem.codeSnippets);

    showStep(3);
    updateDuplicateWarning();
    pushRecent(state.problem);

    setStatus(`${state.problem.questionFrontendId}. ${state.problem.title} · 준비 완료`, 'ok');
  } catch (e: any) {
    const msg = e?.message || String(e);
    setStatus(`에러: ${msg}`, 'error');
    flashInputError();
    // 에러 시 step-2 다시 숨김
    $('step-2').classList.add('hidden');
    $('translation-output').innerHTML = '';
    offerSettingsOnCredentialError(msg);
  } finally {
    resetButton('fetch-btn', '불러오기');
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── step-4 result-pane ──────────────────────────────────────
function initResultPane(): void {
  const out = $('result-output');
  out.classList.remove('error');
  out.innerHTML = `
    <div id="annotation-stream" class="annotation-stream md-rendered streaming">
      <div class="streaming-loader">AI 회고 작성 중...</div>
    </div>
    <div id="upload-info" class="upload-info"></div>
  `;
}

interface UploadResultShape {
  folder?: string;
  commitSha?: string;
  commitUrl?: string;
  annotatedHtml?: string;
}

function showUploadSuccess(result: UploadResultShape): void {
  // streaming 끝났으니 final HTML로 한 번 더 교체 (incomplete markdown 클린업)
  const stream = $('annotation-stream') as HTMLElement | null;
  if (stream && result.annotatedHtml) {
    stream.innerHTML = result.annotatedHtml;
    stream.classList.remove('streaming'); // 좌측 코랄 라인 제거
    highlightCodeBlocks(stream);
  }

  $('upload-info').innerHTML = `
    <strong>✓ 업로드 완료</strong>
    <div class="result-row"><span class="result-label">폴더</span><code class="inline-mono">${result.folder}</code></div>
    <div class="result-row"><span class="result-label">커밋</span><a href="${result.commitUrl}" target="_blank" rel="noopener">${(result.commitSha || '').slice(0, 7)}</a></div>
    <div class="action-row">
      <button class="primary" id="next-problem-btn">
        <span class="btn-content">다음 문제 가져오기<kbd class="kbd-inline">⌘K</kbd></span>
      </button>
    </div>
  `;
  $btn('next-problem-btn').addEventListener('click', reset);

  // 풀이 통계에 기록 — state에 problem/language 보존되어 있음
  if (state.problem && state.selectedLang) {
    recordSolution({
      frontendId: parseInt(state.problem.questionFrontendId, 10),
      title: state.problem.title,
      titleSlug: state.problem.titleSlug,
      language: state.selectedLang,
      difficulty: state.problem.difficulty,
      savedAt: Date.now(),
    });
  }

  setStatus('완료 · 다음 문제 가져오기 가능', 'ok');
}

function showRepoMissingError(message: string): void {
  // 에러는 result-output 통째로 교체 (회고 partial은 사라지지만 에러가 우선)
  const out = $('result-output');
  out.classList.add('error');
  out.innerHTML = `
    <strong>✗ 업로드 실패 — 레포가 없는 것 같아</strong>
    <pre class="error-detail">${escapeHtml(message)}</pre>
    <div class="action-row">
      <button class="primary" id="create-repo-btn">
        <span class="btn-content">이 이름으로 새 레포 만들기 (public, README 자동 생성)</span>
      </button>
      <button class="secondary" id="open-settings-from-error-btn">
        <span class="btn-content">설정 열기</span>
      </button>
    </div>
  `;
  $btn('create-repo-btn').addEventListener('click', handleCreateRepo);
  $btn('open-settings-from-error-btn').addEventListener('click', openSettings);
  showStep(4);
  setStatus('레포 없음 · 자동 생성 가능', 'error');
}

function showErrorPlain(message: string): void {
  const out = $('result-output');
  out.classList.add('error');
  out.innerHTML = `<strong>✗ 업로드 실패</strong><pre class="error-detail">${escapeHtml(message)}</pre>`;
  showStep(4);
  setStatus('업로드 실패 · 메시지 확인', 'error');
}

async function performUpload(): Promise<void> {
  setStatus('AI 회고 작성 중...', 'busy');
  setButtonLoading('upload-btn', 'AI 회고 작성 중...');

  // step-4 미리 보여줌 — annotation-stream에 streaming 텍스트가 점진 채워짐
  initResultPane();
  showStep(4);

  try {
    if (!state.lastUploadPayload) throw new Error('upload payload 없음');
    const result = await window.api.uploadSolution(state.lastUploadPayload);
    if (!result.ok) {
      const err = new Error(result.error) as Error & { status?: number | null };
      err.status = result.status;
      throw err;
    }
    showUploadSuccess(result);
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (e?.status === 404) {
      showRepoMissingError(msg);
    } else {
      showErrorPlain(msg);
      offerSettingsOnCredentialError(msg);
    }
  } finally {
    resetButton('upload-btn', 'AI 회고 생성 후 GitHub에 업로드');
  }
}

async function handleCreateRepo(): Promise<void> {
  const btn = $btn('create-repo-btn');
  btn.disabled = true;
  const content = btn.querySelector('.btn-content') as HTMLElement | null;
  if (content) content.innerHTML = `<span class="spinner"></span>레포 생성 중...`;
  setStatus('GitHub에 새 레포 만드는 중...', 'busy');

  try {
    const result = await window.api.createRepo();
    if (!result.ok) throw new Error(result.error);

    // 새 레포 만들어졌으니 잠깐 대기 후 자동으로 업로드 재시도
    setStatus(`레포 생성 완료 (${result.scope}) · 1.5초 후 업로드 재시도`, 'busy');
    await new Promise((r) => setTimeout(r, 1500));

    await performUpload();
  } catch (e: any) {
    showErrorPlain(`레포 생성 실패: ${e?.message || String(e)}`);
  }
}

async function handleUpload(): Promise<void> {
  if (!state.problem) return;

  const code = getEditorCode();
  const language = state.selectedLang || 'python3';

  if (!code.trim()) {
    setStatus('코드를 붙여넣어주세요', 'error');
    return;
  }

  // 재시도용으로 페이로드 보관
  state.lastUploadPayload = {
    problem: state.problem,
    translation: state.translation,
    code,
    language,
  };

  await performUpload();
}

function reset(): void {
  state.problem = null;
  state.translation = '';
  state.selectedLang = null;
  $input('problem-input').value = '';
  $input('problem-input').classList.remove('input-error');
  $('clear-input-btn').classList.add('hidden');
  $('paste-preview').classList.add('hidden');
  $('duplicate-warning').classList.add('hidden');
  setEditorCode('');
  $('translation-output').innerHTML = '';
  $('starter-code').textContent = '';
  $('result-output').innerHTML = '';
  ['step-2', 'step-3', 'step-4'].forEach((id) => $(id).classList.add('hidden'));
  $('starter-block').classList.add('hidden');
  $input('problem-input').focus();
}

// ─── 설정 모달 ───────────────────────────────────────────────
function setSectionStatus(elementId: string, hasValue: boolean): void {
  const el = $(elementId);
  if (hasValue) {
    el.textContent = '✓ 저장됨';
    el.dataset.state = 'saved';
  } else {
    el.textContent = '⚠ 필요';
    el.dataset.state = 'empty';
  }
}

// GitHub은 token + owner + repo 세 가지 모두 필요해서 3단계 상태
function setGitHubStatus(settings: SettingsView): void {
  const el = $('github-status');
  const hasOwnerRepo = settings.GITHUB_OWNER && settings.GITHUB_REPO;
  if (settings.hasGithubToken && hasOwnerRepo) {
    el.textContent = '✓ 저장됨';
    el.dataset.state = 'saved';
  } else if (settings.hasGithubToken) {
    el.textContent = '⚠ Owner/Repo 입력 필요';
    el.dataset.state = 'partial';
  } else {
    el.textContent = '⚠ 토큰 필요';
    el.dataset.state = 'empty';
  }
}

async function openSettings(): Promise<void> {
  const settings = await window.api.getSettings();
  $input('setting-anthropic-key').value = ''; // 시크릿은 항상 비움
  $input('setting-anthropic-model').value = settings.ANTHROPIC_MODEL || '';
  $input('setting-github-token').value = ''; // 시크릿은 항상 비움
  $input('setting-github-owner').value = settings.GITHUB_OWNER || '';
  $input('setting-github-repo').value = settings.GITHUB_REPO || '';
  $input('setting-github-branch').value = settings.GITHUB_BRANCH || '';
  $input('setting-auto-create-repo').checked = !!settings.GITHUB_AUTO_CREATE_REPO;

  // 저장 상태 시각적 표시
  setSectionStatus('anthropic-status', settings.hasAnthropicKey);
  setGitHubStatus(settings);

  // 토큰 입력란 placeholder를 상태 반영
  $input('setting-anthropic-key').placeholder = settings.hasAnthropicKey
    ? '(저장됨 · 변경하려면 새 키 입력)'
    : 'sk-ant-...';
  $input('setting-github-token').placeholder = settings.hasGithubToken
    ? '(저장됨 · 변경하려면 새 토큰 입력)'
    : 'ghp_...';

  $('pat-help-panel').classList.add('hidden');
  $('verify-result').classList.add('hidden');
  const modal = $('settings-modal');
  modal.classList.remove('hidden');
  // closeSettings에서 inline display:none 강제 추가했으면 여기서 제거
  (modal as HTMLElement).style.display = '';
}

function closeSettings(): void {
  const modal = $('settings-modal');
  modal.classList.add('hidden');
  // 일부 환경에서 transition/animation 잔재로 화면 그대로 보이는 경우 강제 hide
  (modal as HTMLElement).style.display = 'none';
  // 다음 open 시 .hidden 제거 + inline display 제거
}

async function saveSettings(): Promise<void> {
  const payload = {
    ANTHROPIC_API_KEY: $input('setting-anthropic-key').value,
    ANTHROPIC_MODEL: $input('setting-anthropic-model').value,
    GITHUB_TOKEN: $input('setting-github-token').value,
    GITHUB_OWNER: $input('setting-github-owner').value,
    GITHUB_REPO: $input('setting-github-repo').value,
    GITHUB_BRANCH: $input('setting-github-branch').value,
    GITHUB_AUTO_CREATE_REPO: $input('setting-auto-create-repo').checked ? 'true' : 'false',
  };

  $btn('save-settings').disabled = true;
  try {
    const result = await window.api.saveSettings(payload);
    if (!result.ok) throw new Error(result.error);
    setStatus('설정 저장됨', 'ok');
    closeSettings();
    checkConfig();
  } catch (e: any) {
    setStatus(`저장 실패: ${e?.message || String(e)}`, 'error');
  } finally {
    $btn('save-settings').disabled = false;
  }
}

async function handleVerifyGithub(): Promise<void> {
  const btn = $btn('verify-github-btn');
  const result = $('verify-result');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>확인 중...';
  result.classList.remove('hidden', 'ok', 'warn', 'fail');
  result.classList.add('busy');
  result.textContent = '연결 확인 중...';

  try {
    const r = await window.api.verifyGithub();
    if (!r.ok) {
      result.classList.remove('busy');
      result.classList.add('fail');
      result.innerHTML = `<strong>✗ 실패</strong><div>${escapeHtml(r.error)}</div>`;
      return;
    }

    result.classList.remove('busy');
    if (r.repoExists) {
      const branchNote = r.branchMatches
        ? ''
        : ` <span class="result-warn">⚠ 설정 브랜치 '${r.configuredBranch}' ≠ 레포 default '${r.repoDefaultBranch}'</span>`;
      result.classList.add('ok');
      result.innerHTML = `
        <strong>✓ 연결 정상</strong>
        <div>인증: @${r.authedAs}</div>
        <div>레포: <a href="${r.repoUrl}" target="_blank" rel="noopener">${r.owner}/${r.repo}</a>${branchNote}</div>
      `;
    } else {
      result.classList.add('warn');
      result.innerHTML = `
        <strong>⚠ 레포가 없어요</strong>
        <div>인증: @${r.authedAs}</div>
        <div>설정: ${r.owner}/${r.repo}</div>
        <div class="action-row">
          <button class="primary" id="verify-create-btn">지금 이 이름으로 만들기 (public)</button>
        </div>
      `;
      $btn('verify-create-btn').addEventListener('click', async () => {
        const cb = $btn('verify-create-btn');
        cb.disabled = true;
        cb.innerHTML = '<span class="spinner"></span>레포 생성 중...';
        try {
          const createRes = await window.api.createRepo();
          if (!createRes.ok) throw new Error(createRes.error);
          result.classList.remove('warn');
          result.classList.add('ok');
          result.innerHTML = `
            <strong>✓ 레포 생성 완료</strong>
            <div>${createRes.scope === 'user' ? '본인 계정' : '조직'}에 public 레포 생성됨</div>
            <div><a href="${createRes.url}" target="_blank" rel="noopener">${r.owner}/${r.repo}</a></div>
          `;
        } catch (e: any) {
          result.classList.remove('warn');
          result.classList.add('fail');
          result.innerHTML = `<strong>✗ 레포 생성 실패</strong><div>${escapeHtml(e?.message || String(e))}</div>`;
        }
      });
    }
  } catch (e: any) {
    result.classList.remove('busy');
    result.classList.add('fail');
    result.innerHTML = `<strong>✗ 실패</strong><div>${escapeHtml(e?.message || String(e))}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'GitHub 연결 확인';
  }
}

// ─── parseProblemInput client (paste preview) ────────────────
// src/util/language.ts의 parseProblemInput과 동일 로직 (renderer는 import 불가)
// 숫자 입력은 client에서 미리보기만 — 실제 해결은 main의 GraphQL 호출
interface ClientParsed {
  kind: 'slug' | 'numeric' | 'empty';
  value: string;
}

function parseProblemInputClient(input: string): ClientParsed {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'empty', value: '' };

  // 숫자만 — frontendId
  if (/^\d+$/.test(trimmed)) {
    return { kind: 'numeric', value: trimmed };
  }

  // URL — cn 도메인도 같은 slug로 처리 (cn은 Cloudflare 직접 접근 불가, com에서 fetch)
  const urlPattern = /leetcode\.(?:com|cn)\/problems\/([a-zA-Z0-9-]+)/i;
  const urlMatch = trimmed.match(urlPattern);
  if (urlMatch) {
    return { kind: 'slug', value: urlMatch[1].toLowerCase() };
  }

  // 자유 텍스트
  const slug = trimmed
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return { kind: 'slug', value: slug };
}

function updatePastePreview(): void {
  const raw = $input('problem-input').value.trim();
  const preview = $('paste-preview');
  if (!raw) {
    preview.classList.add('hidden');
    return;
  }

  const parsed = parseProblemInputClient(raw);

  // 숫자 입력 — frontendId 검색 미리 안내
  if (parsed.kind === 'numeric') {
    preview.innerHTML = `<span class="preview-arrow">→</span><span class="preview-slug">문제 #${parsed.value}</span> 으로 검색`;
    preview.classList.remove('hidden');
    return;
  }

  // slug — 원본과 다르면 정규화 결과 표시
  if (parsed.kind === 'slug') {
    if (!parsed.value || parsed.value === raw.toLowerCase()) {
      preview.classList.add('hidden');
      return;
    }
    preview.innerHTML = `<span class="preview-arrow">→</span><span class="preview-slug">${parsed.value}</span> 으로 정규화`;
    preview.classList.remove('hidden');
    return;
  }

  preview.classList.add('hidden');
}

// ─── pull from embed ─────────────────────────────────────────
async function handlePullFromEmbed(): Promise<void> {
  const btn = $btn('pull-embed-btn');
  btn.disabled = true;
  try {
    const r = await window.api.getLeetCodeUrl();
    if (!r.ok || !r.url) {
      setStatus('임베드 LeetCode 윈도우가 열려있지 않아요 — 헤더의 ↗ 버튼으로 먼저 열어주세요', 'error');
      return;
    }
    $input('problem-input').value = r.url;
    $('clear-input-btn').classList.remove('hidden');
    updatePastePreview();
    handleFetch();
  } catch (e: any) {
    setStatus(`가져오기 실패: ${e?.message || String(e)}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─── listeners ───────────────────────────────────────────────
$btn('fetch-btn').addEventListener('click', handleFetch);
$btn('upload-btn').addEventListener('click', handleUpload);

$input('problem-input').addEventListener('keypress', (e: KeyboardEvent) => {
  if (e.key === 'Enter') handleFetch();
});

// input clear(×) 버튼: input value 있을 때만 visible
$input('problem-input').addEventListener('input', () => {
  const el = $input('problem-input');
  const hasValue = el.value.length > 0;
  $('clear-input-btn').classList.toggle('hidden', !hasValue);
  if (hasValue) el.classList.remove('input-error');
  updatePastePreview();
});

$btn('clear-input-btn').addEventListener('click', () => {
  $input('problem-input').value = '';
  $input('problem-input').classList.remove('input-error');
  $('clear-input-btn').classList.add('hidden');
  $('paste-preview').classList.add('hidden');
  $input('problem-input').focus();
});

// 최근 풀이 chip 클릭 → input 채우고 자동 fetch (이벤트 위임)
$('recent-row').addEventListener('click', (e: Event) => {
  const target = e.target as HTMLElement | null;
  const chip = target?.closest('.recent-chip') as HTMLElement | null;
  if (!chip) return;
  const slug = chip.dataset.slug;
  if (!slug) return;
  $input('problem-input').value = slug;
  $('clear-input-btn').classList.remove('hidden');
  updatePastePreview();
  handleFetch();
});

$select('starter-lang-select').addEventListener('change', (e: Event) => {
  const value = (e.target as HTMLSelectElement).value;
  state.selectedLang = value;
  setPreferredLang(value);
  updateStarterCode();
  setEditorLang(value);
  updateDuplicateWarning();
});

$btn('open-leetcode-btn').addEventListener('click', () => window.api.openLeetCode());

// 번역 영역의 LeetCode 링크 클릭 시 현재 선택된 시작 언어를 URL hash에 담아 임베드로
$('translation-output').addEventListener('click', (e: Event) => {
  const target = e.target as HTMLElement | null;
  const a = target?.closest('a') as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (!/leetcode\.com\/problems\//i.test(href)) return;
  e.preventDefault();
  let finalUrl = href;
  if (state.selectedLang) {
    try {
      const u = new URL(href);
      u.hash = `leetbuddy-lang=${state.selectedLang}`;
      finalUrl = u.toString();
    } catch {
      // URL 파싱 실패 시 원본 그대로
    }
  }
  window.api.openLeetCode(finalUrl);
});

$btn('pull-embed-btn').addEventListener('click', handlePullFromEmbed);

// step-3: LeetCode 최근 Accepted submission 자동 가져오기
async function handleFetchSubmission(): Promise<void> {
  if (!state.problem) {
    setStatus('먼저 문제를 가져와주세요', 'error');
    return;
  }
  const btn = $btn('fetch-submission-btn');
  const originalContent = (btn.querySelector('.btn-content') as HTMLElement)?.innerHTML || '';
  btn.disabled = true;
  setButtonLoading('fetch-submission-btn', 'LeetCode에서 코드 가져오는 중...');
  setStatus('LeetCode 세션으로 최근 통과 코드 fetch...', 'busy');

  try {
    const r = await window.api.fetchSubmission(state.problem.titleSlug);
    if (!r.ok) throw new Error(r.error);

    // 받은 lang에 맞춰 select 변경 (해당 lang snippet 있어야)
    const select = $select('starter-lang-select');
    const options = Array.from(select.options).map((o) => o.value);
    if (r.langSlug && options.includes(r.langSlug)) {
      select.value = r.langSlug;
      state.selectedLang = r.langSlug;
      setPreferredLang(r.langSlug);
      updateStarterCode();
      updateDuplicateWarning();
    }

    // code 채움 + editor mode 갱신
    setEditorCode(r.code!);
    setEditorLang(r.langSlug || state.selectedLang);

    setStatus(`✓ ${r.langName || r.langSlug} 코드 ${r.code!.split('\n').length}줄 가져왔어요 — 업로드 버튼 누르면 회고 생성`, 'ok');
  } catch (e: any) {
    setStatus(`가져오기 실패: ${e?.message || String(e)}`, 'error');
  } finally {
    btn.disabled = false;
    const content = btn.querySelector('.btn-content') as HTMLElement | null;
    if (content) content.innerHTML = originalContent;
  }
}

$btn('fetch-submission-btn').addEventListener('click', handleFetchSubmission);
$btn('open-stats-btn').addEventListener('click', openStats);
$btn('close-stats').addEventListener('click', (e: Event) => {
  e.stopPropagation();
  closeStats();
});
$('stats-modal').addEventListener('click', (e: Event) => {
  const target = e.target as HTMLElement | null;
  if (target?.id === 'stats-modal') closeStats();
});

$btn('open-settings-btn').addEventListener('click', openSettings);
// X / cancel button — bubble 허용. backdrop handler에 fallback 있어 두 번 호출되어도
// idempotent. stopPropagation 제거가 X 안 먹던 원인이었을 수 있음 (불명확하지만
// 명확한 fallback이 더 robust).
$btn('close-settings').addEventListener('click', closeSettings);
$btn('cancel-settings').addEventListener('click', closeSettings);
$btn('save-settings').addEventListener('click', saveSettings);

$btn('pat-help-btn').addEventListener('click', () => {
  $('pat-help-panel').classList.toggle('hidden');
});

$btn('verify-github-btn').addEventListener('click', handleVerifyGithub);

// (구) textarea ↔ overlay 동기화 — CodeMirror 5로 대체됨, 별도 listener 불필요

// settings-modal click handler — backdrop click + X/cancel button **fallback**
// 별도 X/cancel listener가 어떤 이유로 동작 안 해도 (예: stopPropagation 실패,
// listener 등록 race) 여기서 잡음. 진단 추적 + 동작 보장.
$('settings-modal').addEventListener('click', (e: Event) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  // backdrop 자체 클릭
  if (target.id === 'settings-modal') {
    closeSettings();
    return;
  }
  // X / cancel button (또는 그 안의 child element)
  if (target.closest('#close-settings') || target.closest('#cancel-settings')) {
    closeSettings();
    return;
  }
});

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    reset();
  }
  if (e.key === 'Escape' && !$('settings-modal').classList.contains('hidden')) {
    closeSettings();
  }
  if (e.key === 'Escape' && !$('stats-modal').classList.contains('hidden')) {
    closeStats();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  checkConfig();
  renderRecent();
  initCodeEditor();
  $input('problem-input').focus();

  // 진행 상황 listeners
  window.api.onFetchProgress((stage: string) => {
    const text = FETCH_PROGRESS_TEXT[stage];
    if (!text) return;
    setStatus(text, 'busy');
    setButtonLoading('fetch-btn', text);
  });

  window.api.onUploadProgress((stage: string) => {
    const text = UPLOAD_PROGRESS_TEXT[stage];
    if (!text) return;
    setStatus(text, 'busy');
    setButtonLoading('upload-btn', text);
  });

  // 임베드 LeetCode 윈도우의 플로팅 버튼/메뉴/단축키에서 push된 URL 받기
  window.api.onPullProblem((url: string) => {
    $input('problem-input').value = url;
    $('clear-input-btn').classList.remove('hidden');
    updatePastePreview();
    handleFetch();
  });

  // 번역 streaming: main에서 throttle된 HTML이 들어옴 → translation-output 점진 갱신
  window.api.onTranslateStream((html: string) => {
    const el = $('translation-output');
    if (el) el.innerHTML = html;
  });

  // 회고 streaming: annotation-stream 점진 갱신
  window.api.onAnnotateStream((html: string) => {
    const el = $('annotation-stream') as HTMLElement | null;
    if (el) el.innerHTML = html;
  });

  // 새 버전 release되면 footer에 pill 표시 — main의 checkForUpdates에서 push
  // 클릭 시 GitHub Releases 페이지 열림 (target="_blank"라 main 윈도우 navigate 가로채기 X)
  window.api.onUpdateAvailable((info: { tag: string; url: string }) => {
    const el = $('update-available') as HTMLAnchorElement;
    el.textContent = `↗ ${info.tag} 사용 가능`;
    el.href = info.url;
    el.title = `새 버전 ${info.tag} 다운로드`;
    el.classList.remove('hidden');
  });
});
