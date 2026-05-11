# CLAUDE.md — convo·trace 작업 컨텍스트

> 외부 청자용은 README. 이 파일은 **작업 컨텍스트** (어떻게 작업·왜 이 결정·다음 어디로).
>
> **마지막 업데이트**: 2026-05-08 (마이크로 fix #3 직후, v2 재구성)

**기호**: ✦ 시그니처 / ✓ 유지 / ❌ 하지 말 것 / ~~취소선~~ = 결정상 안 함

---

## 프로젝트 한눈에

영어 회화 학습 모먼트 박제 도구. **Saga-Tales venture studio의 두 번째 tale.**
ChatGPT/Claude로 회화하면 끝나면 다 휘발된다는 페인을 직접 해결. 핵심 차별화는 **회상 폐쇄 루프** — 박제된 표현이 다음 회화에 자연스럽게 다시 등장.

- **로컬**: `/Users/ibm514/Saga-Tales/tale-02-convo-trace-iq`
- **GitHub**: https://github.com/Saga-Tales/tale-02-convo-trace-iq
- **Live**: https://saga-tales.github.io/tale-02-convo-trace-iq/
- **Studio prologue**: https://github.com/Saga-Tales/prologue
- **Tale-01 참조**: `/Users/ibm514/Saga-Tales/tale-01-personal-diary-iq`

Stack: Vite + React + TypeScript + Tailwind v4 + IndexedDB(Dexie) + BYOK + GH Pages + PWA.

---

## 세션 시작 체크리스트

새 Claude 세션은 이 순서로 부트업:

1. `git status`, `git log -5` — 현재 상태 / 마지막 사이클 확인
2. `npm install`, `npm run dev` — 동작 확인 (.npmrc에 `ignore-scripts=true`)
3. **STOP 트리거** + **결정 매트릭스** 훑기 (아래) — 사용자 의견 명시 결정 재확인
4. 무엇을 할지 사용자와 합의 — 다음 단계 후보에서 선택
5. `npx tsc -b && npx vite build` — 통과해야 zip 생성
6. **Saga-Tales 표준 사이클** (zip → unzip → push), **한국어 커밋 메시지**

---

## 개발 명령

### 로컬 개발
```bash
cd /Users/ibm514/Saga-Tales/tale-02-convo-trace-iq
npm install
npm run dev      # http://localhost:5173/tale-02-convo-trace-iq/
```

### 빌드 검증 (zip 만들기 전 필수)
```bash
npx tsc -b       # 타입체크 — 에러 0
npx vite build   # 성공해야 함 (warning은 OK)
```

### Saga-Tales 표준 한 사이클

```bash
# Anthropic Claude 측 (zip 생성):
cd /home/claude/tale-02-convo-trace-iq && rm -rf node_modules dist *.tsbuildinfo
cd /home/claude && rm -f tale-02-convo-trace-iq.zip
zip -r tale-02-convo-trace-iq.zip tale-02-convo-trace-iq -x "*.DS_Store" "*/node_modules/*" "*/dist/*"
mv tale-02-convo-trace-iq.zip /mnt/user-data/outputs/
# present_files로 사용자에게 전달

# 사용자 로컬 측:
cd /Users/ibm514/Saga-Tales/tale-02-convo-trace-iq && git status
unzip -q ~/Downloads/tale-02-convo-trace-iq.zip -d ~/Downloads/ \
  && cp -R ~/Downloads/tale-02-convo-trace-iq/. /Users/ibm514/Saga-Tales/tale-02-convo-trace-iq/ \
  && rm -rf ~/Downloads/tale-02-convo-trace-iq && rm -f ~/Downloads/tale-02-convo-trace-iq.zip
npm install && npm run dev
git add . && git commit -m "한국어 메시지" && git push
```

---

## STOP 트리거

**아래 패턴 감지하면 멈추고 결정 매트릭스의 해당 결정을 사용자에게 보여주고 재확인.** 표면적으로 합리적으로 들리지만 명시적 결정과 충돌하는 요청들:

| 트리거 키워드 | 충돌하는 결정 |
|---|---|
| "리뷰 페이지" / "복습 페이지" / "누적 정리" | 누적 리뷰 안 만듦 |
| "LLM으로 mastery 판정" / "회상 정확도 LLM으로 올리자" | LLM 호출 회피 |
| "페어 turn 25-40으로 좁히자" / "4-phase 강제하자" | 마이크로 #3 자율성 |
| "백엔드 추가" / "서버" / "DB on cloud" / "analytics" / "tracking" | BYOK + serverless |
| "iOS 자동 PWA 설치 버튼" | Apple 정책상 JS trigger 불가 |
| "양방향 P2P 동기화" | 호스트 중심 모델 |
| "primary 컬러 다른 색으로" / "rounded-2xl 말고 다른 radius" | 디자인 v2 정체성 |
| "금요일 스피치 모드" / "요일별 테마" | 명시 보류 |

---

## 결정 매트릭스

각 결정의 *왜* 만 여기 (코드에 없으니까). *언제/누가* 는 `git log`.

| 결정 | 상태 | Why | Anchor |
|---|---|---|---|
| 누적 리뷰 페이지 | 안 만듦 | 회상 폐쇄 루프(박제→자동등장→mastery)가 이미 누적 리뷰 역할. 별도 페이지는 의식적 review 강제 → 본질 깨뜨림 | "누적 리뷰는 알아서 하는 게 낫지 않나?" (사용자) |
| 금요일 숏 스피치 모드 | 보류 | 시나리오 모델(dialogue)과 모놀로그+3-Question Rule 형식 부적합 | "일단 금요일 모드 안 만들게" (사용자) |
| 요일별 테마 (월/수/금) | 보류 | 월·수는 현재 페어 모드로 커버. 금만 새 형식인데 보류. 동아리 운영 vs 도구 결합도 낮춤 | 사용자 명시 |
| LLM mastery 판정 | 안 함 | API 비용 + 회화 종료 후 판정 지연. substring 4글자/50% 매칭으로 충분, dogfooding 검증 | 초기 설계 + dogfooding |
| 정통 SM-2 (ef·interval·repetitions) | 안 함 | 게임화 부담(점수 chase). mastery 0-10 단일 스케일이 직관. 명시 review UI 없으니 정교 SRS 불필요 | 초기 설계 |
| 양방향 P2P 동기화 | 안 함 | N(N-1) vs 2(N-1) 스캔 (3명: 6→4). 호스트=마스터노트 모델 명확 | 초기 설계 |
| QR raw JSON | 안 함 | 4KB 한도 초과 (시나리오+캡처 ~4.5KB). pako gzip+base64+'CT1' magic으로 ~1.5KB | 한도 측정 |
| 페어 25-40 turn 강제 cap | 풀음 | cookie cutter (쇼핑에 4-phase 부자연 / 깊은 토론에 25 빈약). 8-50 LLM 자율로 변경 | 마이크로 #3, "상황마다 좀 바뀔 수도 있어서 확장성 여는 게 맞다" (사용자) |
| 4-phase 모든 페어 강제 | 풀음 | 짧은 거래 회화엔 부자연. 20+ turns 권장으로 | 마이크로 #3 |
| iOS 자동 PWA 설치 버튼 | 안 함 | Apple 정책상 JS trigger 절대 불가 → 사용자 혼란만 야기 | 플랫폼 제약 |
| 백엔드 / analytics / tracking | 추가 X | BYOK + serverless가 정체성. 사용자 데이터 외부 전송 X | 초기 설계 |
| vibrant pink primary | 유지 | 디자인 v2 정체성 (`#ec4899`) | Day 4 리뉴얼 |

새 결정 추가 시: 이 표 + 필요하면 STOP 트리거 두 곳만 update. **한 결정은 한 곳에서만 진술.**

---

## 핵심 메커니즘

### 1. 회상 폐쇄 루프 — tale-02 핵심 차별화

```
[회화 #1] phrase 박제 → mastery=0
       ↓
[회화 #2 시작] selectRecallPhrases (mastery 낮고 nextReviewAt 만료된 top 3)
       ↓
[scenario.ts prompt] recallPhrases를 hint로 주입 ("강제 X, 자연스럽게")
       ↓
[LLM이 시나리오에 자연스럽게 녹임]
       ↓
[회화 진행 → 종료 후 자동 mastery 업데이트]
  - user turns에 키워드 매칭 → 'used' (mastery +2)
  - 시나리오 텍스트 매칭만 → 'seen' (mastery +1)
  - 둘 다 X → 변화 없음
```

본질: **substring keyword match** (4글자 이상 키워드, threshold 비율 매칭). 정확한 비율은 [src/lib/recall.ts](file:///Users/ibm514/Saga-Tales/tale-02-convo-trace-iq/src/lib/recall.ts) 참조.

설계 원칙:
- 1시간 이내 캡처는 회상 후보 제외 (자연스러움 보장)
- SM-2 단순화 (mastery 0-10 + nextReviewAt만)

### 2. 페어 모드 호스트 중심 동기화

3명 시 4번 스캔 (양방향 6번 대비 절약):

```
시작:    호스트 QR → 게스트 N-1명 찍음          (N-1번)
회화:    음성 직접, 각자 디바이스 캡처
종료:    게스트 N-1명 자기 캡처 QR → 호스트     (N-1번)
         호스트 통합본 QR → 게스트 N-1명 찍음   (N-1번)
종료 동기화 합계: 2(N-1)
```

설계 원칙:
- `sessionUuid` 매칭 검증으로 다른 회화 QR 잘못 찍기 방지
- 받은 share는 `[expressionEn+intentKo]` 복합 unique 인덱스로 dedup
- `source='imported'` 마킹 (인덱스 안 됨, 메타데이터 용도)
- `MAX_ITEMS` cap + pako gzip + 'CT1' magic prefix — 정확한 값은 [src/lib/share.ts](file:///Users/ibm514/Saga-Tales/tale-02-convo-trace-iq/src/lib/share.ts)

### 3. 페어 시나리오 자율성 (마이크로 #3)

이전: 25-40 turns + 4-phase **강제** → cookie cutter
현재: **8-50 turns LLM 자율** + 4-phase는 20+ turns 권장

[src/lib/scenario.ts](file:///Users/ibm514/Saga-Tales/tale-02-convo-trace-iq/src/lib/scenario.ts):
- `validateScenario(raw, mode)` — mode별 다른 cap (솔로 3-10 / 페어 8-50)
- 균형 검증: 한쪽 80% 이상만 reject (인터뷰 70:30 등 허용)
- prompt에 상황별 권장 분량 hint (거래성 / 잡담 / 면접 / 깊은 토론)
- ScenarioPreview의 phase 마커는 20+ turns 한정 표시
- max-h scroll은 15+ turns일 때만

### 4. BYOK + serverless

- API 키: `localStorage('convo-trace-api-key')`
- 데이터: IndexedDB (Dexie)
- 외부 통신: Anthropic API + Google Fonts/jsdelivr CDN만
- 백엔드/분석/광고 없음
- PWA SW도 BYOK 유지: Anthropic API는 NetworkOnly로 가로채지 않음
- 백업은 사용자 디바이스 → 사용자 디바이스만 (클라우드 X)

### 5. PWA 설치 UX (마이크로 #2)

[src/lib/pwa.ts](file:///Users/ibm514/Saga-Tales/tale-02-convo-trace-iq/src/lib/pwa.ts) — `usePWAInstall` + `detectPlatform`:
- **iOS Safari**: JS trigger 절대 불가 → 3단계 수동 가이드 강조
- **Android Chrome / Desktop Chrome·Edge**: `beforeinstallprompt` 이벤트 잡아서 native prompt
- **이미 설치**: standalone 감지 → "✓ 이미 설치됨"
- iPadOS 13+ 데스크탑 위장: `navigator.maxTouchPoints > 1 && /Macintosh/`

---

## 아키텍처

### 주요 진입점 (전체 트리는 `tree -L 3 src` 또는 직접 ls)

| 파일 | 역할 |
|---|---|
| `src/db/schema.ts` | Dexie v4, 마이그레이션 history |
| `src/lib/recall.ts` | 회상 폐쇄 루프 핵심 (substring match, mastery 분포) |
| `src/lib/scenario.ts` | 시나리오 생성 + recall hint 주입 + 모드별 prompt |
| `src/lib/share.ts` | QR 페이로드 (pako gzip, magic 'CT1') |
| `src/lib/sync.ts` | 받은 share dedup 머지 |
| `src/lib/pwa.ts` | usePWAInstall + detectPlatform |
| `src/pages/Chat.tsx` | 호스트/게스트 흐름 분기 + state machine |
| `src/pages/Home.tsx` | 스트릭 + 회상 예고 + mastery 분포 |

### Session 핵심 필드 (페어 모델)

```typescript
interface Session {
  sessionUuid?: string         // crypto.randomUUID, 페어 매칭
  role?: 'host' | 'guest'
  participants?: string[]      // 호스트 자신 외 N-1명
  scenarioKeyExpressions?: DialogTurn[]  // {speaker, english, intentKo}
  mode: 'solo' | 'pair'
  partnerName?: string         // @deprecated v4 후, 하위호환만
}
```

Dexie 마이그레이션 history (v1→v4)는 [src/db/schema.ts](file:///Users/ibm514/Saga-Tales/tale-02-convo-trace-iq/src/db/schema.ts) 참조.

---

## 디자인 시스템 v2 (정체성만)

전체 토큰 표는 README + [src/index.css](file:///Users/ibm514/Saga-Tales/tale-02-convo-trace-iq/src/index.css). 변경 금지 핵심:

- **Primary**: vibrant pink (`--color-accent: #ec4899`)
- **Secondary**: deep teal (`--color-teal: #14787e`)
- **시그니처**: `✦` sig-star, `rounded-2xl`, `gradient-card`, `lift` hover, `animate-pop-in`, yellow `highlight`
- **Typography**: Pretendard Variable (body) + Fraunces italic (display)
- **로고**: convo(teal)·trace(pink)

변경 금기는 STOP 트리거 / 결정 매트릭스 참조.

---

## 사용자 컨텍스트

### IQ (한동희)
- 우테코 8기 백엔드, 중앙대 SW
- INTP, 매일 dogfooder
- 닉네임 표기: **"아이큐"** (한글, IQ 아님)
- 커밋 메시지 언어: **한국어** (tale-01의 영어 컨벤션과 다름)
- GitHub: [@e9ua1](https://github.com/e9ua1)

### 우테코 영어회화 동아리 'Talking About' v2
- **주 3회** (월/수/금) 1:00-1:30 (30분)
- **고정 페어제** (1주일 동안 같은 페어 또는 4인 그룹)
- 요일별 테마: 월(일상) / 수(상황극) / 금(스피치 + 3-Question Rule)
- **수요일 4단계** — 본 도구 핵심 fit:
  1. 표현 연습 (3-4분)
  2. 상황극 진행 (3-4분)
  3. 역할 바꿔서 (3-4분)
  4. 추가 상황 plot twist 후 ②③ 반복 (선택)
  5. 마무리 — 잘쓴 표현 정리 (5분)

### Saga-Tales venture studio
- IQ + 보욱 공동 founder
- 매주 한 tale, vibe-coding 방법론
- Promotion 기준: **3-of-4** (특정 4 criteria 중 3개 만족)
- prologue 레포: 모든 tale 진척 hub

### 작업 스타일
- 깊이 있는 분석 + 명확한 결정 + 트레이드오프 명시
- 한국어 first
- "깊게 고민해서" 자주 요청

---

## Source-of-truth 매핑

| 알고 싶은 것 | 어디 | 비고 |
|---|---|---|
| 결정의 *왜* | **이 파일** (결정 매트릭스) | |
| 결정의 *언제/누가* | `git log --oneline` | 한국어 커밋 메시지 |
| 코드 동작 / 정확한 임계값 | 코드 직접 | 이 문서에 hard-code 금지 |
| 빌드 사이즈 / 의존성 | `npm run build`, `package.json` | 시점 변동 |
| 사용자/외부용 설명 | README + mermaid 다이어그램 | |
| 디자인 토큰 전체 표 | README + `src/index.css` | |

---

## 다음 단계 후보

### 진행 가능
- **Dogfooding 사이클** (정기 진행 — 동아리 월/수/금)
  - 페어 시나리오 길이 적응 검증
  - QR 동기화 흐름 자연스러움
  - mastery 업데이트 precision
- **페어 고정** — 동아리 운영 방식(1주일 같은 페어) 직접 반영
  - 설정에 "내 페어" 등록 (이름 + 메모)
  - 시나리오 생성 시 자동 채움
  - /sessions 페어별 필터
- **Saga-Tales promotion 검토** — 3-of-4 기준 평가 (보욱과)

보류 / 안 함 결정은 **결정 매트릭스** 참조.

---

## Dogfooding 체크포인트

정기 활동 시 확인:

### 시나리오 quality
- 상황별 분량 적응이 자연스러운가?
- 쇼핑 짧게 / 깊은 토론 길게 잘 나오는가?
- Phase 마커(20+ turns)가 흐름과 매칭?
- 균형 검증 80% threshold가 너무 관대?
- "Alex" 같은 영어 이름 X / "대학 친구" 일반명사 잘 나오는가?

### 페어 동기화
- QR 사이즈가 한도 안에 들어오는가? (캡처 많을 때 ~4KB 근처)
- iOS Safari 카메라 권한 (https 한정)
- 호스트 중심 4번 스캔 흐름 자연스러운가?
- sessionUuid 매칭이 다른 회화 QR 막아주는가?

### 회상 폐쇄 루프
- 두 번째 회화에 첫 회화 phrase가 자연스럽게 녹는가?
- substring match threshold 적절한가?
- 1주일 사용 후 mastery 분포(Home 카드)가 의미 있는가?
- 너무 빠르게 마스터 / 너무 느리게 학습되는가?

### PWA + 백업
- iOS Safari 3단계 가이드가 명확한가?
- Android/Desktop "지금 설치" 버튼이 잘 동작하는가?
- 백업 export → 다른 디바이스 import (Merge / Replace) 정상 동작?

---

## Troubleshooting

| 증상 | 점검 |
|---|---|
| `npm install` native binary 에러 | `.npmrc`의 `ignore-scripts=true` 확인 |
| vite-plugin-pwa SW 캐시 stale | `dist/sw.js` 삭제 + 브라우저 캐시 clear |
| QR 사이즈 한도 초과 | `MAX_ITEMS` cap / 압축 비율 ([share.ts](file:///Users/ibm514/Saga-Tales/tale-02-convo-trace-iq/src/lib/share.ts)) |
| IndexedDB schema 불일치 | DevTools Application 탭 → IndexedDB 삭제 후 재진입 |
| 페어 sessionUuid 매칭 실패 | 호스트 QR 갱신 / 게스트 카메라 권한 / https 확인 |
| BYOK API 키 인식 X | `localStorage('convo-trace-api-key')` 확인 |

---

## 완성된 사이클 (요약)

상세 진척은 `git log` (한국어 커밋 메시지). 큰 줄기:
- **Day 1-7**: 기능 완성 — 스키마 → 회화(streaming, CEFR 9단계) → 캡처(ko→en, lookup) → 자동 추출 + 디자인 v2 → 회상 폐쇄 루프 → 페어 N명·QR → PWA·백업
- **마이크로 #1**: 페어 라벨 + 시나리오 quality + 4단계 가이드
- **마이크로 #2**: PWA 설치 UX (`beforeinstallprompt` + 플랫폼 분기)
- **마이크로 #3**: 페어 시나리오 자율성 (강제 cap → LLM 자율)

---

## 이 문서 유지 원칙

v1에서 확인된 안티패턴 (재발 방지):

- ❌ **코드와 sync 강제되는 spec hard-code** — 빌드 사이즈, 정확한 임계값, 전체 디렉토리 트리, 디자인 토큰 표는 drift 시한폭탄. 이 문서엔 *원리*만, *값*은 코드/README에서 읽을 것
- ❌ **같은 결정 다중 진술** — v1엔 "누적 리뷰 안 만듦"이 4곳에 반복됐었음. **한 결정은 결정 매트릭스 한 곳**
- ❌ **상대 일자** ("현재 진행 중", "다음 동아리") — 절대 일자 또는 evergreen 표현
- ✓ 결정의 *왜* 만 담기. *언제/누가* 는 git log
- ✓ 사용자 quote anchor 보존 — "누적 리뷰는 알아서 하는 게 낫지 않나?" 같은 원본 문장이 변경 금기 신뢰도의 핵심
- ✓ 새 결정 추가 시 결정 매트릭스 + 필요하면 STOP 트리거 두 곳만 update
