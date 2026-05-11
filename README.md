# 🪐 iq-leetbuddy

> *a small companion in the iq-agent-lab system.*

LeetCode 문제 풀이를 **한국어로 번역해 보여주고**, 통과한 코드에 **AI 회고**를 붙여 **GitHub에 자동 정리**하는 데스크톱 에이전트.

iq-agent-lab 행성 중 하나. 매일 문제 풀이를 *기록 가능한 학습 자산*으로 바꾸는 것이 이 행성의 일.

---

## 📥 다운로드 & 설치

빌드 없이 그냥 받아 쓰는 길.

### 1. 본인 Mac에 맞는 zip 다운로드

**[Releases](https://github.com/iq-agent-lab/iq-leetbuddy/releases/latest)** 페이지로 가서 다음 둘 중 하나 받기:

| Mac 종류 | 파일 |
|---|---|
| Apple Silicon (M1, M2, M3, M4) | `iq-leetbuddy-{version}-arm64-mac.zip` |
| Intel Mac | `iq-leetbuddy-{version}-mac.zip` |

> 본인 Mac이 어느 쪽인지 모르면: `메뉴 → 이 Mac에 관하여`. "Apple M*" 보이면 Apple Silicon, "Intel" 보이면 Intel.

### 2. ⚠️ 그냥 zip 풀어서 실행하면 — 이렇게 됨

![iq-leetbuddy은(는) 손상되었기 때문에 열 수 없습니다 경고](docs/images/gatekeeper-warning.png)

다운로드한 zip을 풀어서 `.app` 파일을 더블클릭하면 macOS가 위 같은 경고를 띄움:

> **'iq-leetbuddy'은(는) 손상되었기 때문에 열 수 없습니다. 해당 항목을 휴지통으로 이동해야 합니다.**

**진짜 손상된 게 아니야.** Chrome으로 다운받은 unsigned 앱에 macOS가 `com.apple.quarantine`이라는 "출처 모름" 꼬리표를 붙이고, Gatekeeper가 그걸 보고 *손상이라고 거짓말*하면서 차단하는 거. Apple Developer cert가 있는 *서명된* 앱이면 안 뜨는데, iq-leetbuddy는 개인 도구라 cert 없음.

휴지통으로 옮기지 말고 — **터미널 한 줄로 우회 가능**.

### 3. 터미널에서 한 번에 설치

새 터미널을 열고 (Spotlight → "터미널") 다음을 복사 붙여넣기:

```bash
cd /tmp && \
unzip -o ~/Downloads/iq-leetbuddy-*-mac.zip && \
xattr -cr iq-leetbuddy.app && \
mv -f iq-leetbuddy.app /Applications/ && \
open /Applications/iq-leetbuddy.app
```

각 줄이 하는 일:

| 명령 | 의미 |
|---|---|
| `cd /tmp` | 작업 디렉토리로 이동 |
| `unzip -o ~/Downloads/...` | Downloads의 zip 풀기 (Apple Silicon/Intel 자동 매칭) |
| `xattr -cr iq-leetbuddy.app` | quarantine 꼬리표 제거 (이게 핵심) |
| `mv -f ... /Applications/` | Applications 폴더로 옮기기 (기존 버전 덮어쓰기) |
| `open ...` | 실행 |

성공하면:
- Dock에 코랄 행성 아이콘이 떠오르고
- 메뉴바 우측 상단에도 🪐 트레이 아이콘 자리잡고
- iq-leetbuddy 창이 열림

다음번부터는 Launchpad / Spotlight / Dock에서 일반 앱처럼 켜기 가능.

### 4. 처음 사용 — 설정

앱 우상단 ⚙️ 클릭 → 모달 열림:

1. **Anthropic API Key**: https://console.anthropic.com → API Keys → 키 발급해 붙여넣기
2. **GitHub Personal Access Token**: 토큰 라벨 옆 `?` 버튼 → 가이드 패널 안의 발급 링크 클릭 → scope `repo` 미리 체크된 페이지 열림 → Generate token → 한 번만 보이는 토큰 복사 → 붙여넣기
3. **Owner / Repository**: 본인 GitHub 사용자명, 그리고 풀이가 올라갈 레포 이름 (예: `e9ua1` / `leetcode-solutions`)
4. **"GitHub 연결 확인"** 버튼 → 토큰/레포 한 번에 진단. 레포 없으면 그 자리에서 **"지금 만들기"** 클릭
5. (선택) **"레포 없을 때 자동 생성"** 토글 켜기

저장 후 메인 화면에서 LeetCode 문제 URL이나 문제 이름을 던지면 끝.

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
         ├── README.md            (한국어 번역, 공통)
         └── {language}/
             ├── solution.{ext}    (통과 코드)
             └── RETROSPECTIVE.md  (AI 회고)
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

### Embedded LeetCode 브라우저

원문 링크를 클릭하면 **별도의 영속 세션 윈도우**(`persist:leetcode` 파티션)가 열린다. 한 번 로그인하면 앱을 껐다 켜도 세션이 유지됨. 메인 leetbuddy UI는 절대 navigate 안 됨 — 풀이 흐름 중에 작업 컨텍스트를 잃을 일이 없다.

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

### 단일 atomic commit + 언어별 폴더 분리

3개 파일이 *하나의 commit*으로 올라간다. **git data API**로 blob → tree → commit → ref 업데이트를 직접 호출해 한 번의 commit으로 묶음. 같은 문제를 여러 언어로 풀어도 **언어별 하위 폴더**로 분리되어 회고가 덮어써지지 않음.

```
feat: 101. Symmetric Tree (java) 풀이 추가
```

### 친절한 에러 + 자동 복구

GitHub API 호출이 깨지면 **HTTP status code 별로 한국어 진단 메시지**. 404 시 *"이 이름으로 새 레포 만들기"* 버튼이 자동 노출. 자동 생성 토글이 켜져 있으면 사용자 클릭 없이 *AI 회고 비용 추가 없이* 레포 만들고 retry까지 자동.

### 글로벌 단축키

- **⌘⌥L** (글로벌, 점유 시 `⌘⌥B → ⌘⌥J → ⌘⇧L` fallback) — 어떤 앱에 있든 leetbuddy로 호출
- 메뉴바 🪐 트레이 아이콘 클릭
- `View → leetbuddy 보이기/포커스`

---

## 결과물: GitHub에 이렇게 쌓인다

```
{owner}/{repo}/
├── 0001-two-sum/
│   ├── README.md             ← 한국어 번역 (공통)
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
- **언어별 하위 폴더**로 풀이/회고 분리 → 같은 문제 여러 언어 풀어도 회고 보존
- 한 문제+언어당 단일 commit

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
npm run dist:mac           # macOS .zip (현재 아키텍처)
npm run dist:mac-universal # M-시리즈 + Intel 둘 다
npm run dist:win           # Windows .exe (Windows에서만)
npm run dist:linux         # Linux .AppImage (Linux에서만)
```

결과물은 `release/` 디렉토리에 생성됨.

### 자동 배포 (GitHub Actions)

git tag를 push하면 자동으로 macOS/Windows/Linux 빌드 후 GitHub Releases에 업로드:

```bash
# patch 버전 자동 bump + commit + tag + push 한 줄
npm run release

# 또는 수동
git tag v0.x.y
git push origin v0.x.y
```

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
└── .github/workflows/ CI/CD
```

---

## 로드맵

### v0.3.x (다음)

- [x] 배포 가능한 macOS `.zip` + Linux `.AppImage` + Windows `.exe`
- [x] 코랄 행성 모티프 앱 아이콘
- [x] GitHub Actions 자동 빌드 / 자동 Release
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

### "iq-leetbuddy은(는) 손상되었기 때문에 열 수 없습니다"

unsigned 앱에 macOS가 quarantine 꼬리표를 붙인 거. *진짜 손상 아님*. 위 [3. 터미널에서 한 번에 설치](#3-터미널에서-한-번에-설치) 절차의 한 줄 명령으로 해결. 또는 이미 Applications에 있는 .app만 처리하려면:

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
