// renderer.js — v0.2.4

const $ = (id) => document.getElementById(id);

const FETCH_PROGRESS_TEXT = {
  fetching: 'LeetCode에서 문제 가져오는 중...',
  translating: '한국어로 번역 중...',
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

const NO_SNIPPET_MESSAGE = `// 이 언어의 시작 코드가 LeetCode에 등록되어 있지 않아요.
//
// 다음 중 하나로 진행:
//   1) 위에서 다른 언어 선택
//   2) LeetCode 페이지에서 시작 코드를 직접 복사 → 03 단계에 붙여넣기`;

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
    flashInputError();
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
    <div class="action-row">
      <button class="primary" id="next-problem-btn">
        <span class="btn-content">다음 문제 가져오기<kbd class="kbd-inline">⌘K</kbd></span>
      </button>
    </div>
  `;
  $('next-problem-btn').addEventListener('click', reset);
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
  $('problem-input').classList.remove('input-error');
  $('clear-input-btn').classList.add('hidden');
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

// input clear(×) 버튼: input value 있을 때만 visible
$('problem-input').addEventListener('input', () => {
  const hasValue = $('problem-input').value.length > 0;
  $('clear-input-btn').classList.toggle('hidden', !hasValue);
  // 사용자가 입력 중이면 에러 상태 제거
  if (hasValue) $('problem-input').classList.remove('input-error');
});

$('clear-input-btn').addEventListener('click', () => {
  $('problem-input').value = '';
  $('problem-input').classList.remove('input-error');
  $('clear-input-btn').classList.add('hidden');
  $('problem-input').focus();
});
$('starter-lang-select').addEventListener('change', (e) => {
  state.selectedLang = e.target.value;
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
    handleFetch();
  });
});
