// 마크다운 → HTML 변환
// marked는 v9+부터 ESM-only라서 dynamic import로 우회
// (TS의 commonjs 컴파일은 await import()을 require()로 변환하므로 Function 트릭 필요)

const importDynamic = new Function('s', 'return import(s)') as (s: string) => Promise<any>;

let _marked: any = null;

async function getMarked() {
  if (_marked) return _marked;
  const mod = await importDynamic('marked');
  // marked v12+는 named export, v4-v5는 default export 둘 다 가능
  _marked = mod.marked || mod.default;
  if (_marked.setOptions) {
    _marked.setOptions({
      gfm: true,
      breaks: false,
    });
  }
  return _marked;
}

export async function renderMarkdown(md: string): Promise<string> {
  const m = await getMarked();
  if (typeof m === 'function') return m(md);
  if (typeof m.parse === 'function') return m.parse(md);
  throw new Error('marked 라이브러리를 로드하지 못했습니다');
}
