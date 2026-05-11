# 🪐 iq-leetbuddy

> *a small companion in the iq-agent-lab system.*

LeetCode 문제 풀이를 **한국어로 번역해 보여주고**, 통과한 코드에 **AI 회고**를 붙여 **GitHub에 자동 정리**하는 데스크톱 에이전트.

iq-agent-lab 행성 중 하나. 매일 문제 풀이를 *기록 가능한 학습 자산*으로 바꾸는 것이 이 행성의 일.

---

## 📥 다운로드 & 설치 (macOS)

가장 빠른 길은 빌드 없이 그냥 받아 쓰는 것:

1. **[Releases](https://github.com/iq-agent-lab/iq-leetbuddy/releases/latest)** 페이지에서 본인 Mac에 맞는 zip 다운로드:
   - Apple Silicon (M1, M2, M3, M4) → `iq-leetbuddy-{version}-arm64-mac.zip`
   - Intel Mac → `iq-leetbuddy-{version}-mac.zip`
2. 다운로드한 zip을 **더블클릭** → macOS가 자동으로 압축 해제 → `iq-leetbuddy.app` 생성
3. 생성된 `iq-leetbuddy.app`을 **Applications 폴더로 드래그**
4. Launchpad 또는 Spotlight에서 `leetbuddy` 검색해 실행

### 처음 실행 — "확인되지 않은 개발자" 경고

코드 서명되지 않은 앱이라 macOS Gatekeeper가 막을 거야 (개인 도구라 Apple Developer cert 없음). 한 번만 우회하면 그 다음부턴 정상 실행:

**가장 쉬운 방법:**
1. Finder에서 leetbuddy 아이콘에 **우클릭** → **열기**
2. "확인되지 않은 개발자" 경고 → **열기** 버튼 클릭

**터미널로 한 번에:**
```bash
xattr -cr /Applications/iq-leetbuddy.app
```

그 후엔 일반 앱처럼 실행/Spotlight/Dock에서 켜기 가능. 메뉴바 우측 상단에 🪐 행성 아이콘이 자리잡고, 어디서든 `⌘⌥L`로 호출.

> Windows / Linux 빌드도 동일하게 Releases에 올라옴 (`.exe`, `.AppImage`). macOS 기준으로 1차 검증된 후에 다른 OS도 동일하게 동작 예상.
>
> *왜 .dmg 대신 .zip?* — electron-builder의 dmgbuild가 일부 Python 환경(특히 Anaconda)과 호환 안 되는 알려진 이슈가 있어. zip 더블클릭이 dmg 마운트보다 사실 더 단순해서 사용성 손해도 없음.

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

## 첫 사용 흐름

1. 앱 실행 후 헤더 우측 **⚙️ 설정** 클릭
2. **Anthropic API Key** 입력
   - https://console.anthropic.com → API Keys
3. **GitHub Personal Access Token** 입력
   - 토큰 라벨 옆 `?` 버튼 클릭 → 가이드 패널 열림
   - 안의 발급 링크 클릭하면 **scope `repo` 미리 체크된 페이지**가 열림
   - Generate token → 한 번만 보이는 토큰 복사 → 붙여넣기
4. **Owner / Repository** 입력 (예: `e9ua1` / `leetcode-solutions`)
5. **"GitHub 연결 확인"** 버튼 클릭 → 토큰/레포/브랜치 한 번에 진단
   - 레포 없으면 그 자리에서 **"지금 만들기"** 버튼으로 자동 생성
6. (선택) **"레포 없을 때 자동 생성"** 토글 켜기 → 다음번 업로드부터 모든 게 자동
7. 저장 → 메인 화면에서 `Symmetric Tree` 같은 문제 이름을 던지면 끝

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

### 친절한 에러 + 자동 복구

GitHub API 호출이 깨지면 **HTTP status code 별로 한국어 진단 메시지**를 던진다. 404 시 *"이 이름으로 새 레포 만들기"* 버튼이 자동 노출되고, 자동 생성 토글이 켜져 있으면 사용자 클릭 없이 *AI 회고 비용 추가 없이* 레포 만들고 retry까지 자동.

### 진행 상황 IPC streaming

긴 작업(번역, 회고, GitHub commit)은 단계별 진행 상황이 메인 → 렌더러로 IPC stream으로 흘러나온다. 버튼은 spinner와 함께 현재 단계 텍스트를 보여준다.

```
AI 회고 작성 중...     →     GitHub에 commit 중...     →     ✓ 업로드 완료
```

### 글로벌 단축키 + 메뉴바 통합

LeetCode 풀다가 leetbuddy로 돌아오는 경로:

- **글로벌 단축키** (`⌘⌥L` 우선 시도, 점유되어 있으면 `⌘⌥B → ⌘⌥J → ⌘⇧L` fallback) — 어떤 앱에 있든 한 번에 활성화
- macOS 메뉴바 우측의 🪐 트레이 아이콘 클릭
- 표준 메뉴바 `View → leetbuddy 보이기/포커스`

macOS의 *focus steal 제약*을 우회하기 위해 `setAlwaysOnTop(true) → focus() → moveTop() → setAlwaysOnTop(false)` 트릭이 들어가 있다.

---

## 결과물: GitHub에 이렇게 쌓인다

```
{owner}/{repo}/
├── 0001-two-sum/
│   ├── README.md             ← 한국어 번역 (공통, 모든 언어 풀이가 공유)
│   ├── python/
│   │   ├── solution.py
│   │   └── RETROSPECTIVE.md  ← Python 풀이 회고
│   └── java/
│       ├── solution.java
│       └── RETROSPECTIVE.md  ← Java 풀이 회고
│
├── 0094-binary-tree-inorder-traversal/
│   ├── README.md
│   └── cpp/
│       ├── solution.cpp
│       └── RETROSPECTIVE.md
│
└── 0101-symmetric-tree/
    ├── README.md
    └── java/
        ├── solution.java
        └── RETROSPECTIVE.md
```

- 폴더명 `{4자리 번호}-{titleSlug}` → GitHub 파일 브라우저에서 자연 정렬
- **언어별 하위 폴더**로 풀이/회고 분리 → 같은 문제를 여러 언어로 풀어도 회고가 덮어써지지 않음
- 한국어 번역 README는 공통 (매번 동일 내용으로 갱신)
- 한 문제+언어당 단일 commit: `feat: {번호}. {제목} ({언어}) 풀이 추가`

---

## 비용

문제당 Claude API 호출 = 번역 + 회고 = **2회**. Sonnet 4.6 기준 **문제당 약 $0.02~0.04**.
월 100문제 풀어도 $2~4 수준.

GitHub API는 시간당 5,000 requests 한도, 문제당 ~8 calls. 600문제까지 여유.

---

## 단축키

| 단축키 | 기능 |
|---|---|
| `⌘⌥L` (글로벌) | 어떤 앱에 있든 leetbuddy로 호출 |
| `⌘K` (앱 내) | 입력/결과 모두 초기화 |
| `Enter` (문제 입력란) | 불러오기 |
| `Esc` (설정 모달) | 모달 닫기 |
| `⌘Q` | 완전 종료 |

---

## ⚙️ 개발자용 — 소스에서 빌드

위 다운로드 섹션 안 보고 직접 코드로 굴리고 싶다면.

### 의존성

- Node.js 20+
- macOS 13+ (또는 Windows 10+ / Ubuntu 20.04+)

### 로컬 실행

```bash
git clone https://github.com/iq-agent-lab/iq-leetbuddy.git
cd iq-leetbuddy
npm install
npm start
```

`.env`는 처음 실행 시 자동으로 사용자 디렉토리에 생성됨. UI ⚙️ 모달에서 입력하면 끝.

### 직접 패키징 (배포 파일 만들기)

```bash
npm run dist:mac           # macOS .dmg + .zip (현재 아키텍처)
npm run dist:mac-universal # M-시리즈 + Intel 둘 다
npm run dist:win           # Windows .exe (Windows에서만)
npm run dist:linux         # Linux .AppImage (Linux에서만)
```

결과물은 `release/` 디렉토리에 생성됨.

### 자동 배포 (GitHub Actions)

git tag를 push하면 자동으로 macOS/Windows/Linux 빌드 후 GitHub Releases에 업로드:

```bash
git tag v0.3.0
git push origin v0.3.0
```

`.github/workflows/release.yml`이 모든 작업을 처리. Apple Developer cert는 필요 없음 (개인 도구).

### 폴더 구조

```
iq-leetbuddy/
├── src/
│   ├── main/         Electron 메인 (윈도우/트레이/단축키/IPC)
│   ├── preload/      contextBridge 안전 다리
│   ├── renderer/     UI (vanilla HTML/CSS/JS)
│   ├── services/     leetcode·translator·annotator·github·pipeline·markdown
│   ├── types/        공유 타입
│   └── util/         retry · langToExt · 입력 파싱
├── build/            앱 아이콘, macOS entitlements
├── assets/           트레이 아이콘 (메뉴바용)
├── scripts/          copy-assets, 아이콘 생성기
├── .github/workflows/  CI/CD
└── dist/, release/   빌드 산출물 (gitignore)
```

### 모듈 책임 분리

| 모듈 | 책임 |
|---|---|
| `leetcode.ts` | GraphQL — 문제 메타 + codeSnippets fetch |
| `translator.ts` | Claude API — HTML → 한국어 마크다운 |
| `annotator.ts` | Claude API — 회고 마크다운 |
| `markdown.ts` | marked로 마크다운 → HTML (dynamic import) |
| `github.ts` | Octokit git data API + 에러 변환 + 레포 생성 + 진단 |
| `pipeline.ts` | 단계별 onProgress 콜백 + auto-create retry |
| `main/settings.ts` | `.env` in-place 편집, secret-safe view, userData 분기 |
| `main/index.ts` | 윈도우, 트레이, 단축키, embedded LeetCode 라우팅 |

---

## 로드맵

### v0.3.x

- [x] 배포 가능한 `.dmg` 패키지
- [x] 코랄 행성 모티프 앱 아이콘
- [x] GitHub Actions 자동 빌드
- [ ] **OS keychain 통합** — `.env` 평문 대신 macOS Keychain
- [ ] **앱 자동 업데이트** — electron-updater로 새 버전 알림

### v0.4

- [ ] **CodeMirror 6 에디터** — textarea overlay → 진짜 코드 에디터
- [ ] **LeetCode 세션 활용** — `submissionList` GraphQL → 최근 Accepted 자동 fetch
- [ ] **문제 번호로 검색** — `1`, `2024` 입력 시 titleSlug 자동 해결
- [ ] **풀이 통계 SQLite** — 난이도/태그/언어별 카운트, 월별 트렌드
- [ ] **풀이 인덱스 자동 README** — 메인 레포에 풀이 목록 자동 갱신

### 장기

- [ ] Codeforces, BOJ 지원
- [ ] 풀이 레포 RAG 검색
- [ ] iq-blogger 연동 (RETROSPECTIVE → 블로그 포스트)

---

## 트러블슈팅

### "확인되지 않은 개발자" 또는 "손상되었습니다" 경고
macOS Gatekeeper가 unsigned 앱을 막은 것. Finder에서 우클릭 → 열기, 또는:
```bash
xattr -cr /Applications/iq-leetbuddy.app
```

### 업로드 실패: 404 Not Found
설정의 owner/repo가 실제 GitHub 레포와 불일치. ⚙️ 설정 → **"GitHub 연결 확인"** 클릭하면 진단됨. 레포 없으면 그 자리에서 "지금 만들기".

### globalShortcut 안 먹음
다른 앱이 키 점유 중. fallback 4개까지 시도하지만 모두 점유되면 등록 실패. 트레이 메뉴 또는 View 메뉴로 leetbuddy 복귀 가능.

### LeetCode embedded 윈도우 로그인 안 됨
`persist:leetcode` 파티션 손상 가능성. macOS: `~/Library/Application Support/iq-leetbuddy/Partitions/leetcode/` 폴더 삭제 후 재실행.

### 빌드 시 타입 에러
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
- [electron-builder](https://www.electron.build/) — 패키징/배포
- [Anthropic SDK](https://docs.anthropic.com/) — Claude Sonnet 4.6 API
- [Octokit](https://github.com/octokit/octokit.js) — GitHub git data API
- [highlight.js](https://highlightjs.org/) — syntax highlighting (atom-one-dark)
- [marked](https://marked.js.org/) — Markdown → HTML
- [LeetCode GraphQL](https://leetcode.com/graphql/) — 공개 문제 메타 endpoint

영감:
- [LeetHub](https://github.com/QasimWani/LeetHub) — 제출 후 GitHub commit 패턴의 원조
- [iq-blogger](https://github.com/iq-proof) — agent-lab의 다른 행성

---

*Built by IQ as one planet of [iq-agent-lab](https://github.com/iq-agent-lab).*
*Curiosity is the question, code is the answer.*
