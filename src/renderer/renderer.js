// renderer.js — v0.2.4

const $ = (id) => document.getElementById(id);

const FETCH_PROGRESS_TEXT = {
  fetching: 'LeetCode에서 문제 가져오는 중...',
  translating: '한국어로 번역 중...',
  cached: '캐시에서 즉시 로드',
};

const UPLOAD_PROGRESS_TEXT = {
  annotating: 'AI 회고 작성 중...',
  uploading: 'GitHub에 commit 중...',
  'creating-repo': '레포 자동 생성 중...',
};

function setButtonLoading(btnId, loadingText) {
  const btn = $(btnId);
  btn.disabled = true;
  btn.querySelector('.btn-content').innerHTML = `<span class="spinner"></span>${loadingText}`;
}

function resetButton(btnId, originalText) {
  const btn = $(btnId);
  btn.disabled = false;
  btn.querySelector('.btn-content').textContent = originalText;
}

const state = {
  problem: null,
  translation: '',
  selectedLang: null,
  lastUploadPayload: null,
};

function setStatus(text, kind) {
  $('status').textContent = text;
  const dot = $('status-dot');
  dot.classList.remove('busy', 'ok', 'error');
  if (kind) dot.classList.add(kind);
}

function showStep(num) {
  $(`step-${num}`).classList.remove('hidden');
}

function formatShortcutForDisplay(sc) {
  if (!sc) return '';
  return sc
    .replace('CmdOrCtrl', '⌘')
    .replace('Cmd', '⌘')
    .replace('Ctrl', '⌃')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace(/\+/g, '');
}

// 첫 실행(둘 다 미설정) 시 한 번만 자동 모달.
// 매 부팅 동안 한 번만 — 사용자가 닫아도 같은 세션에선 다시 안 띄움.
let firstRunPromptShown = false;

async function checkConfig() {
  try {
    const cfg = await window.api.checkConfig();
    const el = $('config-status');
    if (cfg.anthropic && cfg.github) {
      el.textContent = `→ ${cfg.owner}/${cfg.repo}`;
      el.classList.add('ok');
      el.classList.remove('warning');
    } else {
      const missing = [];
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
  } catch (e) {
    $('config-status').textContent = '설정 확인 실패';
  }
}

// ─── 최근 풀이 5개 (localStorage chips) ───
const RECENT_KEY = 'iq-leetbuddy:recent-problems';
const RECENT_MAX = 5;

function readRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function pushRecent(problem) {
  try {
    const item = {
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

function renderRecent() {
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

// 마지막 선택 언어 기억 — 사용자가 매번 java→python으로 바꾸는 마찰 제거
const PREFERRED_LANG_KEY = 'iq-leetbuddy:preferred-lang';

function getPreferredLang() {
  try {
    return localStorage.getItem(PREFERRED_LANG_KEY);
  } catch {
    return null;
  }
}

function setPreferredLang(slug) {
  try {
    localStorage.setItem(PREFERRED_LANG_KEY, slug);
  } catch {
    // localStorage 사용 불가 환경 무시
  }
}

function populateLanguageSelect(snippets) {
  const select = $('starter-lang-select');
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
  // 저장된 lang이 이 문제 snippet에 없으면 fallback
  const stored = getPreferredLang();
  const defaultSlug =
    (stored && sorted.find((s) => s.langSlug === stored)?.langSlug) ||
    sorted.find((s) => s.langSlug === 'java')?.langSlug ||
    sorted[0].langSlug;
  select.value = defaultSlug;
  state.selectedLang = defaultSlug;

  updateStarterCode();
  $('starter-block').classList.remove('hidden');
}

// LeetCode langSlug → highlight.js 언어명 매핑
const HLJS_LANG_MAP = {
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
function highlightCodeBlocks(container) {
  if (!container || !window.hljs) return;
  container.querySelectorAll('pre code').forEach((block) => {
    delete block.dataset.highlighted;
    try {
      window.hljs.highlightElement(block);
    } catch {
      // 알 수 없는 언어 등은 plaintext로 떨어짐 — 무시
    }
  });
}

function updateStarterCode() {
  if (!state.problem) return;
  const slug = state.selectedLang;
  const snip = state.problem.codeSnippets?.find((s) => s.langSlug === slug);
  const codeEl = $('starter-code');

  codeEl.textContent = snip ? snip.code : NO_SNIPPET_MESSAGE;

  // highlight.js 적용
  if (window.hljs && snip) {
    const hlLang = HLJS_LANG_MAP[slug] || 'plaintext';
    codeEl.className = `language-${hlLang}`;
    delete codeEl.dataset.highlighted;
    try {
      window.hljs.highlightElement(codeEl);
    } catch (e) {
      // 알 수 없는 언어 등은 plaintext로 떨어지면 됨
    }
  }
}

// 통과 코드 textarea의 hljs overlay 갱신
function updateCodeHighlight() {
  const code = $('code-input').value;
  const codeEl = $('code-highlight-content');
  // 끝 newline 처리 - textarea 마지막에 newline 없으면 overlay가 살짝 짧아짐
  codeEl.textContent = code.endsWith('\n') ? code + ' ' : code + '\n';

  if (window.hljs) {
    const slug = state.selectedLang || 'python3';
    const hlLang = HLJS_LANG_MAP[slug] || 'plaintext';
    codeEl.className = `language-${hlLang}`;
    delete codeEl.dataset.highlighted;
    try {
      window.hljs.highlightElement(codeEl);
    } catch (e) {}
  }
}

function syncCodeScroll() {
  const ta = $('code-input');
  const overlay = document.querySelector('.code-highlight-overlay');
  if (!overlay) return;
  overlay.scrollTop = ta.scrollTop;
  overlay.scrollLeft = ta.scrollLeft;
}

// credential 부재 에러 패턴 감지 — translator/annotator/github에서 throw하는 메시지에 매칭
// "ANTHROPIC_API_KEY가 설정되지 않았습니다", "GITHUB_TOKEN이 설정되지 않았습니다", "GITHUB_OWNER 또는 GITHUB_REPO가 설정되지 않았습니다"
function isCredentialError(msg) {
  if (!msg) return false;
  return /API_KEY|GITHUB_TOKEN|GITHUB_OWNER|GITHUB_REPO/i.test(msg) &&
    /설정되지 않았|미설정|not set/i.test(msg);
}

// 401 (토큰 무효)도 모달 안내 케이스
function isAuthError(msg) {
  if (!msg) return false;
  return /401|토큰이 유효하지 않/i.test(msg);
}

function offerSettingsOnCredentialError(msg) {
  if (!isCredentialError(msg) && !isAuthError(msg)) return false;
  setStatus('인증 정보가 필요해요 — 설정 모달을 열게요', 'error');
  setTimeout(() => {
    if ($('settings-modal').classList.contains('hidden')) {
      openSettings();
    }
  }, 600);
  return true;
}

// fetch 실패 시 input border red + shake 애니메이션
function flashInputError() {
  const el = $('problem-input');
  el.classList.remove('input-error');
  // reflow 강제 → 같은 클래스 재적용 시 애니메이션 재실행
  void el.offsetWidth;
  el.classList.add('input-error');
  setTimeout(() => el.classList.remove('input-error'), 1500);
}

async function handleFetch() {
  const input = $('problem-input').value.trim();
  if (!input) {
    setStatus('문제 URL 또는 slug를 입력해주세요', 'error');
    flashInputError();
    $('problem-input').focus();
    return;
  }

  setStatus('문제 가져오는 중...', 'busy');
  setButtonLoading('fetch-btn', '가져오는 중...');

  // streaming을 받을 영역을 미리 보여줌 (step-2)
  // starter-block은 codeSnippets 받기 전이라 hidden 유지
  $('translation-output').innerHTML = '<div class="streaming-loader">번역 진행 중...</div>';
  $('starter-block').classList.add('hidden');
  $('step-3').classList.add('hidden');
  $('step-4').classList.add('hidden');
  showStep(2);

  try {
    const result = await window.api.fetchProblem(input);
    if (!result.ok) throw new Error(result.error);

    state.problem = result.problem;
    state.translation = result.translation;

    // streaming 끝났으니 최종 (안정적인) HTML로 교체
    $('translation-output').innerHTML = result.translationHtml;
    highlightCodeBlocks($('translation-output'));
    populateLanguageSelect(result.problem.codeSnippets);

    showStep(3);
    pushRecent(state.problem);

    setStatus(`${state.problem.questionFrontendId}. ${state.problem.title} · 준비 완료`, 'ok');
  } catch (e) {
    setStatus(`에러: ${e.message}`, 'error');
    flashInputError();
    // 에러 시 step-2 다시 숨김 (사용자가 다시 시도하면 streaming 영역 새로)
    $('step-2').classList.add('hidden');
    $('translation-output').innerHTML = '';
    offerSettingsOnCredentialError(e.message);
  } finally {
    resetButton('fetch-btn', '불러오기');
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// step-4 result-pane을 stream(상단) + info(하단) 두 영역으로 초기화
// handleUpload 시작 시 호출 — 회고 streaming이 들어갈 자리 마련
function initResultPane() {
  const out = $('result-output');
  out.classList.remove('error');
  out.innerHTML = `
    <div id="annotation-stream" class="annotation-stream md-rendered streaming">
      <div class="streaming-loader">AI 회고 작성 중...</div>
    </div>
    <div id="upload-info" class="upload-info"></div>
  `;
}

function showUploadSuccess(result) {
  // streaming 끝났으니 final HTML로 한 번 더 교체 (incomplete markdown 클린업)
  const stream = $('annotation-stream');
  if (stream && result.annotatedHtml) {
    stream.innerHTML = result.annotatedHtml;
    stream.classList.remove('streaming'); // 좌측 코랄 라인 제거
    highlightCodeBlocks(stream);
  }

  $('upload-info').innerHTML = `
    <strong>✓ 업로드 완료</strong>
    <div class="result-row"><span class="result-label">폴더</span><code class="inline-mono">${result.folder}</code></div>
    <div class="result-row"><span class="result-label">커밋</span><a href="${result.commitUrl}" target="_blank" rel="noopener">${result.commitSha.slice(0, 7)}</a></div>
    <div class="action-row">
      <button class="primary" id="next-problem-btn">
        <span class="btn-content">다음 문제 가져오기<kbd class="kbd-inline">⌘K</kbd></span>
      </button>
    </div>
  `;
  $('next-problem-btn').addEventListener('click', reset);
  setStatus('완료 · 다음 문제 가져오기 가능', 'ok');
}

function showRepoMissingError(message) {
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
  $('create-repo-btn').addEventListener('click', handleCreateRepo);
  $('open-settings-from-error-btn').addEventListener('click', openSettings);
  showStep(4);
  setStatus('레포 없음 · 자동 생성 가능', 'error');
}

function showErrorPlain(message) {
  const out = $('result-output');
  out.classList.add('error');
  out.innerHTML = `<strong>✗ 업로드 실패</strong><pre class="error-detail">${escapeHtml(message)}</pre>`;
  showStep(4);
  setStatus('업로드 실패 · 메시지 확인', 'error');
}

async function performUpload() {
  setStatus('AI 회고 작성 중...', 'busy');
  setButtonLoading('upload-btn', 'AI 회고 작성 중...');

  // step-4 미리 보여줌 — annotation-stream에 streaming 텍스트가 점진 채워짐
  initResultPane();
  showStep(4);

  try {
    const result = await window.api.uploadSolution(state.lastUploadPayload);
    if (!result.ok) {
      const err = new Error(result.error);
      err.status = result.status;
      throw err;
    }
    showUploadSuccess(result);
  } catch (e) {
    if (e.status === 404) {
      showRepoMissingError(e.message);
    } else {
      showErrorPlain(e.message);
      offerSettingsOnCredentialError(e.message);
    }
  } finally {
    resetButton('upload-btn', 'AI 회고 생성 후 GitHub에 업로드');
  }
}

async function handleCreateRepo() {
  const btn = $('create-repo-btn');
  btn.disabled = true;
  btn.querySelector('.btn-content').innerHTML = `<span class="spinner"></span>레포 생성 중...`;
  setStatus('GitHub에 새 레포 만드는 중...', 'busy');

  try {
    const result = await window.api.createRepo();
    if (!result.ok) throw new Error(result.error);

    // 새 레포 만들어졌으니 잠깐 대기 후 자동으로 업로드 재시도
    // (auto_init된 README가 main 브랜치로 commit되기까지 약간의 propagation 시간 필요)
    setStatus(`레포 생성 완료 (${result.scope}) · 1.5초 후 업로드 재시도`, 'busy');
    await new Promise((r) => setTimeout(r, 1500));

    await performUpload();
  } catch (e) {
    showErrorPlain(`레포 생성 실패: ${e.message}`);
  }
}

async function handleUpload() {
  if (!state.problem) return;

  const code = $('code-input').value;
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

function reset() {
  state.problem = null;
  state.translation = '';
  state.selectedLang = null;
  $('problem-input').value = '';
  $('problem-input').classList.remove('input-error');
  $('clear-input-btn').classList.add('hidden');
  $('paste-preview').classList.add('hidden');
  $('code-input').value = '';
  $('translation-output').innerHTML = '';
  $('starter-code').textContent = '';
  $('code-highlight-content').textContent = '';
  $('result-output').innerHTML = '';
  ['step-2', 'step-3', 'step-4'].forEach((id) => $(id).classList.add('hidden'));
  $('starter-block').classList.add('hidden');
  $('problem-input').focus();
}

// ─── 설정 모달 ───
function setSectionStatus(elementId, hasValue) {
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
function setGitHubStatus(settings) {
  const el = $('github-status');
  const hasOwnerRepo = settings.GITHUB_OWNER && settings.GITHUB_REPO;
  if (settings.hasGithubToken && hasOwnerRepo) {
    el.textContent = '✓ 저장됨';
    el.dataset.state = 'saved';
  } else if (settings.hasGithubToken) {
    // 토큰은 있는데 owner/repo가 비어있는 흔한 케이스
    el.textContent = '⚠ Owner/Repo 입력 필요';
    el.dataset.state = 'partial';
  } else {
    el.textContent = '⚠ 토큰 필요';
    el.dataset.state = 'empty';
  }
}

async function openSettings() {
  const settings = await window.api.getSettings();
  $('setting-anthropic-key').value = ''; // 시크릿은 항상 비움
  $('setting-anthropic-model').value = settings.ANTHROPIC_MODEL || '';
  $('setting-github-token').value = ''; // 시크릿은 항상 비움
  $('setting-github-owner').value = settings.GITHUB_OWNER || '';
  $('setting-github-repo').value = settings.GITHUB_REPO || '';
  $('setting-github-branch').value = settings.GITHUB_BRANCH || '';
  $('setting-auto-create-repo').checked = !!settings.GITHUB_AUTO_CREATE_REPO;

  // 저장 상태 시각적 표시
  setSectionStatus('anthropic-status', settings.hasAnthropicKey);
  setGitHubStatus(settings);

  // 토큰 입력란 placeholder를 상태 반영
  $('setting-anthropic-key').placeholder = settings.hasAnthropicKey
    ? '(저장됨 · 변경하려면 새 키 입력)'
    : 'sk-ant-...';
  $('setting-github-token').placeholder = settings.hasGithubToken
    ? '(저장됨 · 변경하려면 새 토큰 입력)'
    : 'ghp_...';

  $('pat-help-panel').classList.add('hidden');
  $('verify-result').classList.add('hidden');
  $('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  $('settings-modal').classList.add('hidden');
}

async function saveSettings() {
  const payload = {
    ANTHROPIC_API_KEY: $('setting-anthropic-key').value,
    ANTHROPIC_MODEL: $('setting-anthropic-model').value,
    GITHUB_TOKEN: $('setting-github-token').value,
    GITHUB_OWNER: $('setting-github-owner').value,
    GITHUB_REPO: $('setting-github-repo').value,
    GITHUB_BRANCH: $('setting-github-branch').value,
    GITHUB_AUTO_CREATE_REPO: $('setting-auto-create-repo').checked ? 'true' : 'false',
  };

  $('save-settings').disabled = true;
  try {
    const result = await window.api.saveSettings(payload);
    if (!result.ok) throw new Error(result.error);
    setStatus('설정 저장됨', 'ok');
    closeSettings();
    checkConfig();
  } catch (e) {
    setStatus(`저장 실패: ${e.message}`, 'error');
  } finally {
    $('save-settings').disabled = false;
  }
}

async function handleVerifyGithub() {
  const btn = $('verify-github-btn');
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
      $('verify-create-btn').addEventListener('click', async () => {
        const cb = $('verify-create-btn');
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
        } catch (e) {
          result.classList.remove('warn');
          result.classList.add('fail');
          result.innerHTML = `<strong>✗ 레포 생성 실패</strong><div>${escapeHtml(e.message)}</div>`;
        }
      });
    }
  } catch (e) {
    result.classList.remove('busy');
    result.classList.add('fail');
    result.innerHTML = `<strong>✗ 실패</strong><div>${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'GitHub 연결 확인';
  }
}

// ─── listeners ───
$('fetch-btn').addEventListener('click', handleFetch);
$('upload-btn').addEventListener('click', handleUpload);
$('problem-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleFetch();
});

// src/util/language.ts의 parseProblemInput과 동일 로직 (renderer는 contextIsolation으로 import 불가)
// URL 정규화 결과를 input 아래에 미리보기로 표시 — 정규화가 원본과 다를 때만
function parseProblemInputClient(input) {
  const trimmed = input.trim();
  const urlPattern = /leetcode\.(?:com|cn)\/problems\/([a-zA-Z0-9-]+)/i;
  const urlMatch = trimmed.match(urlPattern);
  if (urlMatch) return urlMatch[1].toLowerCase();
  return trimmed
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function updatePastePreview() {
  const raw = $('problem-input').value.trim();
  const preview = $('paste-preview');
  if (!raw) {
    preview.classList.add('hidden');
    return;
  }
  const slug = parseProblemInputClient(raw);
  // 빈 slug거나 raw와 동일하면 미리보기 무의미 → hide
  if (!slug || slug === raw.toLowerCase()) {
    preview.classList.add('hidden');
    return;
  }
  preview.innerHTML = `<span class="preview-arrow">→</span><span class="preview-slug">${slug}</span> 으로 정규화`;
  preview.classList.remove('hidden');
}

// input clear(×) 버튼: input value 있을 때만 visible
$('problem-input').addEventListener('input', () => {
  const hasValue = $('problem-input').value.length > 0;
  $('clear-input-btn').classList.toggle('hidden', !hasValue);
  // 사용자가 입력 중이면 에러 상태 제거
  if (hasValue) $('problem-input').classList.remove('input-error');
  updatePastePreview();
});

$('clear-input-btn').addEventListener('click', () => {
  $('problem-input').value = '';
  $('problem-input').classList.remove('input-error');
  $('clear-input-btn').classList.add('hidden');
  $('paste-preview').classList.add('hidden');
  $('problem-input').focus();
});

// 최근 풀이 chip 클릭 → input 채우고 자동 fetch (이벤트 위임)
$('recent-row').addEventListener('click', (e) => {
  const chip = e.target.closest('.recent-chip');
  if (!chip) return;
  const slug = chip.dataset.slug;
  if (!slug) return;
  $('problem-input').value = slug;
  $('clear-input-btn').classList.remove('hidden');
  updatePastePreview();
  handleFetch();
});
$('starter-lang-select').addEventListener('change', (e) => {
  state.selectedLang = e.target.value;
  setPreferredLang(e.target.value); // 다음 fetch에서도 같은 언어로 시작
  updateStarterCode();
  updateCodeHighlight(); // 통과 코드도 같은 언어로 hl 갱신
});
$('open-leetcode-btn').addEventListener('click', () => window.api.openLeetCode());

// 번역 영역의 LeetCode 링크 (특히 "원문") 클릭 시 현재 선택된 시작 언어를
// URL hash에 담아 임베드 윈도우로 전달. main의 INJECT_SCRIPT가 hash를 읽어
// 토스트로 안내 + LeetCode lang dropdown 자동 클릭 시도(best-effort)
$('translation-output').addEventListener('click', (e) => {
  const a = e.target.closest('a');
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

// 임베드 LeetCode 윈도우의 현재 URL을 input에 채우고 자동 fetch
async function handlePullFromEmbed() {
  const btn = $('pull-embed-btn');
  btn.disabled = true;
  try {
    const r = await window.api.getLeetCodeUrl();
    if (!r.ok || !r.url) {
      setStatus('임베드 LeetCode 윈도우가 열려있지 않아요 — 헤더의 ↗ 버튼으로 먼저 열어주세요', 'error');
      return;
    }
    $('problem-input').value = r.url;
    $('clear-input-btn').classList.remove('hidden');
    updatePastePreview();
    handleFetch();
  } catch (e) {
    setStatus(`가져오기 실패: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

$('pull-embed-btn').addEventListener('click', handlePullFromEmbed);

$('open-settings-btn').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', closeSettings);
$('cancel-settings').addEventListener('click', closeSettings);
$('save-settings').addEventListener('click', saveSettings);

$('pat-help-btn').addEventListener('click', () => {
  $('pat-help-panel').classList.toggle('hidden');
});

$('verify-github-btn').addEventListener('click', handleVerifyGithub);

// textarea ↔ overlay 동기화
$('code-input').addEventListener('input', updateCodeHighlight);
$('code-input').addEventListener('scroll', syncCodeScroll);

$('settings-modal').addEventListener('click', (e) => {
  if (e.target.id === 'settings-modal') closeSettings();
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    reset();
  }
  if (e.key === 'Escape' && !$('settings-modal').classList.contains('hidden')) {
    closeSettings();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  checkConfig();
  renderRecent();
  $('problem-input').focus();

  // 진행 상황 listeners
  window.api.onFetchProgress((stage) => {
    const text = FETCH_PROGRESS_TEXT[stage];
    if (!text) return;
    setStatus(text, 'busy');
    setButtonLoading('fetch-btn', text);
  });

  window.api.onUploadProgress((stage) => {
    const text = UPLOAD_PROGRESS_TEXT[stage];
    if (!text) return;
    setStatus(text, 'busy');
    setButtonLoading('upload-btn', text);
  });

  // 임베드 LeetCode 윈도우의 플로팅 버튼/메뉴/단축키에서 push된 URL 받기
  // → input 채우고 자동 fetch (메인 윈도우가 안 보이면 main 프로세스에서 이미 showAndFocus 처리됨)
  window.api.onPullProblem((url) => {
    $('problem-input').value = url;
    $('clear-input-btn').classList.remove('hidden');
    updatePastePreview();
    handleFetch();
  });

  // 번역 streaming: main에서 throttle된 HTML이 들어옴 → translation-output 점진 갱신
  window.api.onTranslateStream((html) => {
    const el = $('translation-output');
    if (el) el.innerHTML = html;
  });

  // 회고 streaming: annotation-stream 점진 갱신
  // step-4가 hidden이거나 error로 result-output이 통째로 교체된 상태면 el이 null → skip
  window.api.onAnnotateStream((html) => {
    const el = $('annotation-stream');
    if (el) el.innerHTML = html;
  });
});
