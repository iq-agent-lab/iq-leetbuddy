# 🪐 iq-leetbuddy

> A small companion in the **iq-agent-lab** system.

LeetCode 문제를 한국어로 번역해서 보여주고, 통과한 코드를 AI가 회고와 함께 정리해 GitHub에 자동으로 올리는 데스크톱 에이전트.

## 무엇을 하는가

```
1. LeetCode URL/slug 입력 →  GraphQL fetch
2. Claude가 문제를 자연스러운 한국어 마크다운으로 번역
3. 그걸 읽고 LeetCode에서 직접 풀기
4. 통과한 코드 붙여넣기 + 언어 선택
5. Claude가 가독성 개선 + 한국어 주석 + 복잡도 분석 회고 생성
6. 한 번의 atomic commit으로 GitHub에 3개 파일 업로드
   ├─ NNNN-title-slug/README.md        (한국어 번역)
   ├─ NNNN-title-slug/solution.{ext}   (원본 통과 코드)
   └─ NNNN-title-slug/RETROSPECTIVE.md (AI 회고 + 개선 코드)
```

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  IPC handlers                                  │  │
│  │   ├─ fetch-problem  ─── pipeline.fetchAndTranslate│
│  │   └─ upload-solution ── pipeline.annotateAndUpload│
│  └───────────────────────────────────────────────┘  │
│  Services:                                          │
│   ├─ leetcode.ts   (LeetCode GraphQL)               │
│   ├─ translator.ts (Anthropic Messages API)         │
│   ├─ annotator.ts  (Anthropic Messages API)         │
│   └─ github.ts     (Octokit git data API)           │
└─────────────────────────────────────────────────────┘
                          ▲
                          │ preload bridge (contextIsolation)
                          ▼
┌─────────────────────────────────────────────────────┐
│  Renderer Process (Chromium)                        │
│  Vanilla HTML/CSS/JS · Editorial dark theme         │
└─────────────────────────────────────────────────────┘
```

## 사전 준비

### 1. 풀이가 업로드될 대상 레포 만들기

GitHub에서 빈 레포 하나 만들어. 예: `iq-leetcode-solutions`. 반드시 한 번 이상 커밋이 있는 상태(README라도)여야 첫 업로드가 성공해. 새 레포 생성 시 "Initialize with README" 체크해주는 게 편함.

### 2. 토큰 발급

**Anthropic API key**: https://console.anthropic.com → API Keys 에서 발급. 이름은 `iq-leetbuddy` 추천.

**GitHub Personal Access Token**: https://github.com/settings/tokens → Generate new token (classic). 필요 scope:
- `repo` (private 레포라면 전체, public 이면 `public_repo` 만)

### 3. 의존성 설치 & 설정

```bash
npm install
cp .env.example .env
# .env 파일을 열어서 토큰들 채우기
```

## 실행

```bash
npm start        # 빌드 + 실행
npm run dev      # devtools 자동 열린 채로 실행
npm run typecheck  # TS 타입만 검사 (빌드 X)
```

처음 실행하면 macOS 메뉴바에 🪐 아이콘이 뜨고, 클릭하면 윈도우가 열려.

## 사용 흐름

1. 메뉴바 아이콘 클릭 → 창 열기
2. **01 문제 가져오기**: URL이나 slug 붙여넣고 `불러오기`
3. **02 번역**: 출력된 한국어를 읽고 LeetCode 가서 풀이
4. **03 통과한 코드**: Accepted 받은 코드를 붙여넣고 언어 선택 → `업로드`
5. **04 결과**: 커밋 링크가 뜸. 클릭하면 바로 GitHub로 이동
6. `Cmd+K`로 폼 초기화

## 폴더 구조

```
iq-leetbuddy/
├── src/
│   ├── main/        # Electron 메인 프로세스
│   ├── preload/     # contextBridge
│   ├── renderer/    # UI (vanilla HTML/CSS/JS)
│   ├── services/    # LeetCode, Anthropic, GitHub 통신
│   ├── types/       # 공유 타입
│   └── util/        # helpers (retry, lang map, input parse)
├── assets/          # tray 아이콘
├── scripts/         # 빌드 보조
└── dist/            # 빌드 산출물 (git ignore)
```

## 비용

문제 한 개 처리 시 Claude API 호출은 번역 + 회고 총 2회.
Sonnet 4.6 기준 입력 ~2-3K 토큰, 출력 ~1.5K 토큰 → **약 $0.02-0.04 / 문제**.

한 달에 100문제 풀어도 $2-4 수준.

## 로드맵 (v0.2+)

- [ ] LeetCode 세션 쿠키로 최근 Accepted submission 자동 가져오기 (코드 복붙 제거)
- [ ] 문제 번호(`1`, `2024`)로 검색 → titleSlug 자동 해결
- [ ] solution.annotated.{ext} 파일도 별도로 분리 (회고는 README 그대로, 코드는 실행 가능한 파일로)
- [ ] 풀이 통계 (난이도/태그별 카운트, 월별 트렌드) 로컬 SQLite 누적
- [ ] Solved.ac 티어와 동기화

## 라이선스

MIT
