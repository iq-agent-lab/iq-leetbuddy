// renderer.js — v0.2.4

const $ = (id) => document.getElementById(id);

const FETCH_PROGRESS_TEXT = {
  fetching: 'LeetCode에서 문제 가져오는 중...',
  translating: '한국어로 번역 중...',
};

const UPLOAD_PROGRESS_TEXT = {
  annotating: 'AI 회고 작성 중...',
  uploading: 'GitHub에 commit 중...',
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

  const defaultSlug = sorted.find((s) => s.langSlug === 'java')?.langSlug || sorted[0].langSlug;
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

function updateStarterCode() {
  if (!state.problem) return;
  const slug = state.selectedLang;
  const snip = state.problem.codeSnippets?.find((s) => s.langSlug === slug);
  const codeEl = $('starter-code');

  codeEl.textContent = snip ? snip.code : '// 해당 언어의 시작 코드가 없습니다';

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

async function handleFetch() {
  const input = $('problem-input').value.trim();
  if (!input) {
    setStatus('문제 URL 또는 slug를 입력해주세요', 'error');
    return;
  }

  setStatus('문제 가져오는 중...', 'busy');
  setButtonLoading('fetch-btn', '가져오는 중...');

  try {
    const result = await window.api.fetchProblem(input);
    if (!result.ok) throw new Error(result.error);

    state.problem = result.problem;
    state.translation = result.translation;

    $('translation-output').innerHTML = result.translationHtml;
    populateLanguageSelect(result.problem.codeSnippets);

    showStep(2);
    showStep(3);

    setStatus(`${state.problem.questionFrontendId}. ${state.problem.title} · 준비 완료`, 'ok');
  } catch (e) {
    setStatus(`에러: ${e.message}`, 'error');
  } finally {
    resetButton('fetch-btn', '불러오기');
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showUploadSuccess(result) {
  const out = $('result-output');
  out.classList.remove('error');
  out.innerHTML = `
    <strong>✓ 업로드 완료</strong>
    <div class="result-row"><span class="result-label">폴더</span><code class="inline-mono">${result.folder}</code></div>
    <div class="result-row"><span class="result-label">커밋</span><a href="${result.commitUrl}" target="_blank" rel="noopener">${result.commitSha.slice(0, 7)}</a></div>
  `;
  showStep(4);
  setStatus('완료 · 다음 문제 가져오기 가능', 'ok');
}

function showRepoMissingError(message) {
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
  $('code-input').value = '';
  $('translation-output').innerHTML = '';
  $('starter-code').textContent = '';
  $('result-output').innerHTML = '';
  ['step-2', 'step-3', 'step-4'].forEach((id) => $(id).classList.add('hidden'));
  $('starter-block').classList.add('hidden');
  $('problem-input').focus();
}

// ─── 설정 모달 ───
async function openSettings() {
  const settings = await window.api.getSettings();
  $('setting-anthropic-key').value = settings.ANTHROPIC_API_KEY || '';
  $('setting-anthropic-model').value = settings.ANTHROPIC_MODEL || '';
  $('setting-github-token').value = settings.GITHUB_TOKEN || '';
  $('setting-github-owner').value = settings.GITHUB_OWNER || '';
  $('setting-github-repo').value = settings.GITHUB_REPO || '';
  $('setting-github-branch').value = settings.GITHUB_BRANCH || '';
  $('pat-help-panel').classList.add('hidden'); // 매번 새로 열 때 접힌 상태로
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

// ─── listeners ───
$('fetch-btn').addEventListener('click', handleFetch);
$('upload-btn').addEventListener('click', handleUpload);
$('problem-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleFetch();
});
$('starter-lang-select').addEventListener('change', (e) => {
  state.selectedLang = e.target.value;
  updateStarterCode();
});
$('open-leetcode-btn').addEventListener('click', () => window.api.openLeetCode());
$('open-settings-btn').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', closeSettings);
$('cancel-settings').addEventListener('click', closeSettings);
$('save-settings').addEventListener('click', saveSettings);

$('pat-help-btn').addEventListener('click', () => {
  $('pat-help-panel').classList.toggle('hidden');
});

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
});
