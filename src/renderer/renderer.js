// renderer.js — vanilla JS. window.api는 preload에서 노출됨.

const $ = (id) => document.getElementById(id);

const state = {
  problem: null,
  translation: '',
  selectedLang: null,
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

async function checkConfig() {
  try {
    const cfg = await window.api.checkConfig();
    const el = $('config-status');
    if (cfg.anthropic && cfg.github) {
      el.textContent = `→ ${cfg.owner}/${cfg.repo}`;
      el.classList.add('ok');
    } else {
      const missing = [];
      if (!cfg.anthropic) missing.push('Anthropic');
      if (!cfg.github) missing.push('GitHub');
      el.textContent = `.env 누락: ${missing.join(', ')}`;
      el.classList.add('warning');
    }
  } catch (e) {
    $('config-status').textContent = '설정 확인 실패';
  }
}

// 언어 선택 셋업 — codeSnippets 기반으로 옵션 동적 생성
function populateLanguageSelect(snippets) {
  const select = $('starter-lang-select');
  select.innerHTML = '';

  if (!snippets || snippets.length === 0) {
    $('starter-block').classList.add('hidden');
    return;
  }

  // 자주 쓰이는 언어를 위로 정렬 (사용자 메모리 반영 가능)
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

  // 기본 선택: Java (있으면), 없으면 첫 번째
  const defaultSlug = sorted.find((s) => s.langSlug === 'java')?.langSlug || sorted[0].langSlug;
  select.value = defaultSlug;
  state.selectedLang = defaultSlug;

  updateStarterCode();
  $('starter-block').classList.remove('hidden');
}

function updateStarterCode() {
  if (!state.problem) return;
  const slug = state.selectedLang;
  const snip = state.problem.codeSnippets?.find((s) => s.langSlug === slug);
  $('starter-code').textContent = snip ? snip.code : '// 해당 언어의 시작 코드가 없습니다';
}

async function handleFetch() {
  const input = $('problem-input').value.trim();
  if (!input) {
    setStatus('문제 URL 또는 slug를 입력해주세요', 'error');
    return;
  }

  setStatus('문제 가져오는 중...', 'busy');
  $('fetch-btn').disabled = true;

  try {
    const result = await window.api.fetchProblem(input);
    if (!result.ok) throw new Error(result.error);

    state.problem = result.problem;
    state.translation = result.translation;

    // 마크다운을 HTML로 렌더링한 결과를 그대로 삽입
    $('translation-output').innerHTML = result.translationHtml;

    populateLanguageSelect(result.problem.codeSnippets);

    showStep(2);
    showStep(3);

    setStatus(`${state.problem.questionFrontendId}. ${state.problem.title} · 준비 완료`, 'ok');
  } catch (e) {
    setStatus(`에러: ${e.message}`, 'error');
  } finally {
    $('fetch-btn').disabled = false;
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

  setStatus('AI 회고 생성 중... (15-30초)', 'busy');
  $('upload-btn').disabled = true;

  try {
    const result = await window.api.uploadSolution({
      problem: state.problem,
      translation: state.translation,
      code,
      language,
    });

    if (!result.ok) throw new Error(result.error);

    const out = $('result-output');
    out.classList.remove('error');
    out.innerHTML = `
      <strong>✓ 업로드 완료</strong>
      <div class="result-row"><span class="result-label">폴더</span><code class="inline-mono">${result.folder}</code></div>
      <div class="result-row"><span class="result-label">커밋</span><a href="${result.commitUrl}" target="_blank" rel="noopener">${result.commitSha.slice(0, 7)}</a></div>
    `;
    showStep(4);

    setStatus('완료 · 다음 문제 가져오기 가능', 'ok');
  } catch (e) {
    const out = $('result-output');
    out.classList.add('error');
    out.innerHTML = `<strong>✗ 업로드 실패</strong><div>${e.message}</div>`;
    showStep(4);
    setStatus(`에러: ${e.message}`, 'error');
  } finally {
    $('upload-btn').disabled = false;
  }
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

// listeners
$('fetch-btn').addEventListener('click', handleFetch);
$('upload-btn').addEventListener('click', handleUpload);
$('problem-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleFetch();
});
$('starter-lang-select').addEventListener('change', (e) => {
  state.selectedLang = e.target.value;
  updateStarterCode();
});

// Cmd+K / Ctrl+K 으로 초기화
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    reset();
  }
});

// 초기화
window.addEventListener('DOMContentLoaded', () => {
  checkConfig();
  $('problem-input').focus();
});
