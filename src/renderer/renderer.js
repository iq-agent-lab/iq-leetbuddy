// renderer.js
// 평범한 vanilla JS. window.api는 preload에서 노출됨.

const $ = (id) => document.getElementById(id);

const state = {
  problem: null,
  translation: '',
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

    $('translation-output').textContent = result.translation;
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
  const language = $('language-select').value;

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
      <div class="result-row"><span class="result-label">폴더</span><code style="font-family: var(--font-mono); font-size: 12px;">${result.folder}</code></div>
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
  $('problem-input').value = '';
  $('code-input').value = '';
  $('translation-output').textContent = '';
  $('result-output').innerHTML = '';
  ['step-2', 'step-3', 'step-4'].forEach((id) => $(id).classList.add('hidden'));
  $('problem-input').focus();
}

// listeners
$('fetch-btn').addEventListener('click', handleFetch);
$('upload-btn').addEventListener('click', handleUpload);
$('problem-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleFetch();
});

// Cmd+R / Ctrl+R 으로 초기화
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
