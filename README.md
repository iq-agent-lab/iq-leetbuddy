# 🪐 iq-leetbuddy

> *a small companion in the iq-agent-lab system.*

LeetCode 문제 풀이를 **한국어로 번역해 보여주고**, 통과한 코드에 **AI 회고**를 붙여 **GitHub에 자동 정리**하는 데스크톱 에이전트.

iq-agent-lab 행성 중 하나. 매일 문제 풀이를 *기록 가능한 학습 자산*으로 바꾸는 것이 이 행성의 일.

---

## 무엇을 하는가

```
01 ─ leetbuddy에 LeetCode URL/slug/문제 이름을 던짐
02 ─ Claude가 문제를 자연스러운 한국어 마크다운으로 옮겨 보여줌
       (이미지·예시·제약조건·메타까지 보존, 시작 코드 템플릿 포함)
03 ─ LeetCode 사이트에서 직접 풀고 Accepted 받음
04 ─ 통과 코드를 leetbuddy에 붙여넣음
05 ─ Claude가 가독성 개선 코드 + 한국어 주석 + 복잡도 분석 + 다른 접근
       + 비슷한 문제까지 묶은 회고 마크다운 생성
06 ─ 단일 atomic commit으로 GitHub에 3개 파일이 묶여 올라감
       NNNN-title-slug/
         ├── README.md            (한국어 번역)
         ├── solution.{ext}       (통과 코드 원본)
         └── RETROSPECTIVE.md     (AI 회고)
```

문제 하나당 사용자 행동은 **두 번의 붙여넣기 + 두 번의 클릭**. 나머지는 다 알아서.

---

## 왜 만들었는가

LeetHub 계열 확장은 *제출 후 GitHub에 올리기*는 해주지만, 핵심이 다 빠져 있다:

- LeetCode 문제는 영어라 한국어 학습자에게 *이해 자체가 비용*이고,
- 코드만 commit되면 **나중에 그 풀이를 다시 꺼냈을 때 맥락을 잃는다.**
- 회고 없이 정답 코드만 쌓으면, 100문제 풀어도 95문제는 잊는다.

iq-leetbuddy는 *commit*이 아니라 *학습*을 자동화한다.

- **번역은 풀이 *전*에** — 영어 해독 시간 → 알고리즘 사고 시간으로 전환
- **회고는 풀이 *후*에** — 복잡도, 개선 코드(한국어 주석), 대안 접근, 유사 문제까지
- **레포는 *학습 노트*** — 미래의 본인이 들춰봤을 때 풀이뿐 아니라 *왜*가 같이 있음

장기적으로 풀이 레포 자체가 "내가 어떻게 사고했는가"의 아카이브가 된다.

---

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. (선택) .env 미리 채워두기 — 안 해도 됨, 앱 안 ⚙️ 모달에서 다 입력 가능
cp .env.example .env

# 3. 실행
npm start
```

처음 띄우면:

1. macOS 메뉴바 트레이에 🪐 아이콘이 자리잡고, 메인 윈도우가 같이 열림.
2. 헤더 우측 **⚙️ 설정** 클릭 → API 키, GitHub PAT, owner/repo 입력.
   PAT 발급 가이드는 모달 안 `?` 버튼에 박혀있고, *scope가 미리 체크된 발급 URL*까지 클릭 한 번에 열림.
3. **"GitHub 연결 확인"** 버튼으로 토큰·레포·브랜치 한 번에 진단. 레포가 없으면 그 자리에서 만들기.
4. 메인 화면 01에 `Symmetric Tree` 같은 문제 이름을 던지면 끝.

---

## 핵심 기능

### 입력 robust 처리

`Symmetric Tree`, `symmetric-tree`, `symmetric tree`, 또는 LeetCode 페이지 URL을 **통째로 붙여넣어도** 잘 인식한다:

```
✓ https://leetcode.com/problems/two-sum/
✓ https://leetcode.com/problems/two-sum/description/
✓ https://leetcode.com/problems/regular-expression-matching/description/?envType=problem-list-v2&envId=depth-first-search
✓ leetcode.cn/problems/two-sum
✓ Two Sum
✓ TWO_SUM
```

문제 페이지에서 그냥 주소창 복사 → 붙여넣기 → 끝.

### Embedded LeetCode 브라우저

원문 링크를 클릭하면 **별도의 영속 세션 윈도우**(`persist:leetcode` 파티션)가 열린다. 한 번 로그인하면 앱을 껐다 켜도 세션이 유지되어 다음번 풀이부터는 즉시 *Accepted*까지 갈 수 있다. 메인 leetbuddy UI는 절대 navigate 되지 않는다 — 풀이 흐름 중에 작업 컨텍스트를 잃을 일이 없다.

### Syntax highlighting

시작 코드 + 통과 코드 입력란 둘 다 **highlight.js + atom-one-dark** 기반으로 색이 입혀진다. 통과 코드 textarea는 **overlay 트릭** (transparent textarea 위에 highlighted `<pre>`를 정확히 겹침)으로 *편집 가능한 상태에서도 syntax color가 유지된다.*

### AI 회고

`src/services/annotator.ts`의 프롬프트는 다음을 강제한다:

- **알고리즘 로직 100% 동일 유지** (개선이 아니라 *재해석*)
- 의미 없는 변수명 → 의미 있는 이름
- 핵심 단계마다 한국어 한 줄 주석
- 시간/공간 복잡도 + *왜* 그런지의 짧은 설명
- 대안 접근 1~2가지 (트레이드오프 포함)
- 비슷한 LeetCode 문제 추천 2~3개

결과물은 RETROSPECTIVE.md 파일로 풀이 폴더와 함께 commit된다.

### 단일 atomic commit

3개 파일이 따로 commit되지 않는다. **git data API**로 blob → tree → commit → ref 업데이트를 직접 호출해 한 번의 commit으로 묶는다.

```
feat: 101. Symmetric Tree 풀이 추가
```

`octokit.repos.createOrUpdateFileContents`로 파일마다 commit하던 LeetHub식 접근과 다르다. 풀이 레포 history가 깨끗해진다.

### 친절한 에러 + 자동 복구

GitHub API 호출이 깨지면 **HTTP status code 별로 한국어 진단 메시지**를 던진다:

- **404**: 어느 단계에서 실패했는지(`getRef`/`getCommit`/...) + 현재 owner/repo/branch + 원인 후보까지 보여줌. "이 이름으로 새 레포 만들기" 버튼이 자동 노출
- **401**: 토큰 무효 — 설정 모달 직행 안내
- **403**: scope 부족 — 발급 가이드 안내
- **409**: 빈 레포 — README 추가 권유

**자동 레포 생성 토글**을 켜두면 404 만나도 사용자 클릭 없이 *AI 회고 비용 추가 없이* 레포 만들고 retry까지 자동.

### 진행 상황 IPC streaming

긴 작업(번역, 회고)은 **단계별 진행 상황**이 메인 → 렌더러로 IPC stream으로 흘러나온다.

```
문제 가져오는 중...
한국어로 번역 중...
✓ 1. Two Sum · 준비 완료
```

```
AI 회고 작성 중...
GitHub에 commit 중...
✓ 업로드 완료 → 커밋 0bbfdfc
```

버튼은 spinner와 함께 현재 단계 텍스트를 보여준다. "어? 지금 돌아가고 있는 거 맞나?"를 묻게 하지 않는다.

### 글로벌 단축키 + 표준 메뉴바

LeetCode 풀다가 leetbuddy로 돌아오는 경로:

- **글로벌 단축키** (`⌘⌥L` 우선 시도, 점유되어 있으면 `⌘⌥B → ⌘⌥J → ⌘⇧L` fallback) — 어떤 앱에 있든 한 번에 활성화
- macOS 트레이 🪐 아이콘 클릭
- 표준 메뉴바 `View → leetbuddy 보이기/포커스`

macOS의 *focus steal 제약*을 우회하기 위해 `setAlwaysOnTop(true) → focus() → moveTop() → setAlwaysOnTop(false)` 트릭이 들어가 있다.

---

## 설정

키와 레포 정보는 **앱 안 ⚙️ 모달**에서 다 관리된다. 별도로 `.env`를 편집할 필요는 없지만, 원하면 직접 편집해도 동일하게 동작 (양쪽 sync).

| 키 | 의미 |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |
| `ANTHROPIC_MODEL` | 기본 `claude-sonnet-4-6` |
| `GITHUB_TOKEN` | PAT (아래 scope 안내) |
| `GITHUB_OWNER` | 본인 GitHub 사용자명 또는 조직명 |
| `GITHUB_REPO` | 풀이가 올라갈 레포 이름 |
| `GITHUB_BRANCH` | 기본 `main` |
| `GITHUB_AUTO_CREATE_REPO` | `true`면 레포 없을 때 자동 생성 |

### PAT scope

**`repo` 하나만 체크.** 클래식 PAT 발급 시 `repo`를 선택하면 sub-scope (`repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`)가 자동으로 같이 체크된다.

- private 레포까지 쓸 거면 → `repo`
- public만 쓸 거면 → `public_repo`만 체크해도 OK

다른 항목 (`workflow`, `admin:org`, `delete_repo`, `gist`, `user`, …) **전부 불필요**.

**미리 scope가 체크된 발급 URL**:

```
https://github.com/settings/tokens/new?scopes=repo&description=iq-leetbuddy
```

이 링크가 설정 모달의 `?` 버튼 안에 박혀 있다. 클릭 한 번이면 발급 페이지가 *이미 세팅된 채로* 열림.

### 시크릿 노출 정책

- 시크릿(`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`)은 **메인 프로세스 외부로 절대 나오지 않는다.** 설정 모달은 `hasAnthropicKey`/`hasGithubToken` boolean만 받아 ✓ 저장됨 / ⚠ 필요 배지를 표시
- 시크릿 입력란은 항상 비어 있고, 그대로 두면 기존 값 유지. 새 값을 입력해야 갱신
- `.env`는 `.gitignore`에 있어 commit되지 않음
- 로컬 파일 평문 보관 한계: OS keychain 통합은 v0.3 로드맵

---

## 아키텍처

```
┌────────────────────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                               │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  IPC handlers (src/main/ipc.ts)                          │  │
│  │   ├─ fetch-problem      → pipeline.fetchAndTranslate     │  │
│  │   ├─ upload-solution    → pipeline.annotateAndUpload     │  │
│  │   ├─ verify-github      → github.verifyConnection        │  │
│  │   ├─ create-repo        → github.createRepoIfMissing     │  │
│  │   ├─ get-settings       → settings.getSettingsView       │  │
│  │   ├─ save-settings      → settings.saveSettings (.env)   │  │
│  │   └─ open-leetcode      → embedded LeetCode window       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Services (src/services/)                                      │
│   ├─ leetcode.ts   GraphQL: question + codeSnippets            │
│   ├─ translator.ts Anthropic Messages API (번역)                │
│   ├─ annotator.ts  Anthropic Messages API (회고 생성)            │
│   ├─ github.ts     Octokit git data API + 친절한 에러             │
│   ├─ markdown.ts   marked로 hl 가능한 HTML 변환                   │
│   └─ pipeline.ts   오케스트레이션 + auto-create 재시도              │
└────────────────────────────────────────────────────────────────┘
                              ▲
                              │ contextBridge (preload)
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  Renderer Process (Chromium)                                   │
│  Vanilla HTML/CSS/JS — 의도적으로 React 없음                       │
│  highlight.js (로컬 vendor, CSP 'self')                         │
└────────────────────────────────────────────────────────────────┘
                              ▲
                              │ 별도 BrowserWindow
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  LeetCode Embedded Browser                                     │
│  session.fromPartition('persist:leetcode')                     │
│  쿠키/localStorage 영속 → 한 번 로그인하면 유지                       │
└────────────────────────────────────────────────────────────────┘
```

### 모듈 책임 분리

| 모듈 | 책임 |
|---|---|
| `leetcode.ts` | GraphQL 한 군데 (`/graphql`) — 문제 메타 + codeSnippets fetch |
| `translator.ts` | Claude API — HTML → 한국어 마크다운, 이미지 보존 강제 |
| `annotator.ts` | Claude API — 회고 마크다운 (복잡도/개선/대안/유사문제) |
| `markdown.ts` | marked로 마크다운 → HTML (dynamic import로 ESM 우회) |
| `github.ts` | Octokit git data API (blob/tree/commit/ref) + 에러 변환 + 레포 생성 + 진단 |
| `pipeline.ts` | 단계별 onProgress 콜백 + auto-create retry |
| `settings.ts` | `.env` in-place 편집, secret-safe view |
| `main/index.ts` | 윈도우, 트레이, 단축키, embedded LeetCode 라우팅 |

### 왜 React 없이 vanilla?

- 의존성 최소화 (Electron app은 가볍게)
- bundler 없이 빌드 (tsc + 정적 복사만)
- DOM 직접 다루기 충분히 작은 규모
- syntax highlight overlay 같은 픽셀 단위 트릭이 framework 추상화보다 쉬움

복잡도가 임계점을 넘기면 v0.3에서 재평가.

---

## 결과물: GitHub에 이렇게 쌓인다

```
{owner}/{repo}/
├── 0001-two-sum/
│   ├── README.md             ← 한국어 번역 (이미지 보존)
│   ├── solution.java         ← 통과 코드 원본
│   └── RETROSPECTIVE.md      ← AI 회고
│
├── 0002-add-two-numbers/
│   ├── README.md
│   ├── solution.py
│   └── RETROSPECTIVE.md
│
├── 0094-binary-tree-inorder-traversal/
│   ├── README.md
│   ├── solution.cpp
│   └── RETROSPECTIVE.md
│
└── 0101-symmetric-tree/
    ├── README.md
    ├── solution.java
    └── RETROSPECTIVE.md
```

- 폴더명 `{4자리 번호}-{titleSlug}` → GitHub 파일 브라우저에서 자연 정렬
- 한 문제당 단일 commit: `feat: {번호}. {제목} 풀이 추가`
- README.md엔 원문 메타(난이도 / 태그 / 원문 링크), 한국어 번역, 입출력 예시, 제약 조건이 모두 포함됨
- RETROSPECTIVE.md엔 풀이의 핵심 아이디어, 자료구조/알고리즘 태그, 시간·공간 복잡도, **개선된 코드 (한국어 주석 포함)**, 다른 접근, 비슷한 문제가 들어감

---

## 비용

문제 하나당 Claude API 호출은 **번역 + 회고 = 2회**.

Sonnet 4.6 기준:
- 입력 ~2~3K 토큰
- 출력 ~1.5K 토큰
- **문제당 약 $0.02~0.04**

월 100문제 풀어도 $2~4 수준. iq-blogger의 폴더당 단가($0.20대)와 비교해도 훨씬 적다 — 입력 길이가 짧기 때문.

GitHub API는 PAT 인증 시 시간당 5,000 requests. 우리는 한 문제당 6 calls (`getRef` + `getCommit` + `createBlob` × 3 + `createTree` + `createCommit` + `updateRef`) ≒ 8 calls. 600문제 풀어도 한도 한참 남는다.

---

## 단축키

| 단축키 | 기능 |
|---|---|
| `⌘⌥L` (글로벌, 점유 시 fallback) | 어떤 앱에 있든 leetbuddy로 |
| `⌘K` (앱 내) | 입력/결과 모두 초기화 (다음 문제 모드) |
| `Enter` (문제 입력란) | 불러오기 trigger |
| `Esc` (설정 모달) | 모달 닫기 |
| `⌘Q` | 완전 종료 (트레이도 제거) |

윈도우 닫기(`⌘W` 또는 빨간 X)는 *숨기기*로 동작. 트레이 🪐는 계속 살아 있어 단축키로 부를 수 있음.

---

## 개발

### 스크립트

```bash
npm start         # tsc 빌드 + asset 복사 + electron 실행
npm run dev       # 위와 동일 + devtools 자동 열림
npm run build     # 빌드만
npm run typecheck # 타입만 검사 (빌드 X)
npm run clean     # dist 청소
```

### 폴더 구조

```
iq-leetbuddy/
├── src/
│   ├── main/         Electron 메인 (윈도우/트레이/단축키)
│   ├── preload/      contextBridge 안전 다리
│   ├── renderer/     UI (vanilla HTML/CSS/JS)
│   ├── services/     leetcode·translator·annotator·github·pipeline·markdown
│   ├── types/        공유 타입
│   └── util/         retry · langToExt · 입력 파싱
├── assets/           트레이 아이콘 (코럴 행성 모티프)
├── scripts/          copy-assets · gen_icon
└── dist/             빌드 산출물 (git ignore)
```

### 디자인 시스템

- **색**: warm dark (`#0d0c0b` 베이스) + Anthropic Coral (`#cc785c`)
- **타이포**: Fraunces (display, italic) + IBM Plex Sans KR (body) + JetBrains Mono (code)
- **모션**: pulse spinner, fade-up step transition, planet drift animation
- **세부**: 그레인 텍스처 오버레이, kbd 키캡, sectioned border-left에서 accent strip

---

## 로드맵

### v0.3 (다음)

- [ ] **OS keychain 통합** — 시크릿을 `.env` 평문 대신 macOS Keychain / Windows Credential Manager로
- [ ] **CodeMirror 6 에디터** — textarea overlay 트릭 → 진짜 코드 에디터 (다중 커서, 정확한 selection, intellisense 가능성)
- [ ] **LeetCode 세션 활용** — 본인 쿠키로 `submissionList` GraphQL → 최근 Accepted submission 자동 fetch (코드 복붙 제거)
- [ ] **문제 번호로 검색** — `1`, `2024` 입력하면 titleSlug 자동 해결

### v0.4

- [ ] **풀이 통계 SQLite** — 난이도/태그/언어별 카운트, 월별 트렌드, 평균 풀이 시간
- [ ] **Solved.ac 티어 동기화** — 백준 푼 문제까지 한 곳에서 집계
- [ ] **풀이 인덱스 자동 README** — 메인 레포에 풀이 목록 자동 갱신 (LeetHub-v3 패턴)
- [ ] **회고 품질 옵션** — `--depth=light|standard|deep`로 회고 길이/깊이 조절

### 장기

- [ ] **다른 PS 사이트** — Codeforces, BOJ
- [ ] **회고 검색** — 풀이 레포 전체 RAG 검색 ("DP 문제 중 *동전 교환* 패턴 쓴 풀이")
- [ ] **iq-blogger 연동** — RETROSPECTIVE.md를 블로그 포스트로 자동 발행

---

## 트러블슈팅

### 업로드 실패: 404 Not Found

설정의 owner/repo가 실제 GitHub 레포와 불일치. 해결:
1. ⚙️ 설정 → **"GitHub 연결 확인"** 클릭. 진단 결과가 그 자리에 뜸
2. 레포가 없으면 같은 패널에서 "지금 만들기"
3. *또는* "레포 없을 때 자동 생성" 토글을 켜고 그냥 업로드

### globalShortcut 안 먹음

이미 다른 앱이 해당 키를 점유 중. fallback chain이 4번째까지 시도하지만 모두 점유되면 등록 실패. 트레이 메뉴 또는 View 메뉴로 leetbuddy 복귀 가능.

### LeetCode embedded 윈도우 로그인 안 됨

`persist:leetcode` 파티션이 깨졌을 가능성. macOS 기준: `~/Library/Application Support/iq-leetbuddy/Partitions/leetcode/` 폴더 삭제 후 재실행 → 새 세션으로 다시 로그인.

### 빌드 시 타입 에러

`npm install` 한 번 더 + `node_modules/dist` 청소 후 재빌드:

```bash
rm -rf node_modules dist package-lock.json
npm install
npm run build
```

---

## 라이선스 & 크레딧

MIT.

빌딩 블록:
- [Electron](https://www.electronjs.org/) — 데스크톱 쉘
- [Anthropic SDK](https://docs.anthropic.com/) — Claude Sonnet 4.6 API
- [Octokit](https://github.com/octokit/octokit.js) — GitHub git data API
- [highlight.js](https://highlightjs.org/) — syntax highlighting (atom-one-dark)
- [marked](https://marked.js.org/) — Markdown → HTML
- [LeetCode GraphQL](https://leetcode.com/graphql/) — 공개 문제 메타 endpoint

영감:
- [LeetHub](https://github.com/QasimWani/LeetHub) — 제출 후 GitHub commit 패턴의 원조
- [iq-blogger](https://github.com/iq-proof) — agent-lab의 다른 행성, validator 패턴 차용

---

*Built by IQ as one planet of [iq-agent-lab](https://github.com/iq-agent-lab).*
*Curiosity is the question, code is the answer.*
