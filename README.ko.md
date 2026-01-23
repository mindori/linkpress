<p align="center">
  <img src="assets/FullLogo_Transparent.png" alt="LinkPress" width="400">
</p>

<p align="center">
  <strong>슬랙 링크를 나만의 기술 매거진으로!</strong>
</p>

<p align="center">
  <a href="#빠른-시작">빠른 시작</a> · <a href="#기능">기능</a> · <a href="#명령어">명령어</a>
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/linkpress"><img src="https://img.shields.io/npm/v/linkpress.svg" alt="npm version"></a>
  <img src="https://img.shields.io/github/license/mindori/linkpress" alt="license">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="node version">
  <img src="https://img.shields.io/badge/AI-Claude-blueviolet" alt="AI powered by Claude">
</p>

<p align="center">
  <img src="assets/serve.gif" alt="LinkPress Demo" width="800">
</p>


---

## 왜 LinkPress인가요?

매일 슬랙에 좋은 기술 아티클이 공유됩니다. 하지만 쌓이기만 하고, 묻히고, 결국 읽지 못합니다.

**LinkPress가 이 문제를 해결합니다.** 슬랙 채널에서 링크를 수집하고, AI로 요약하고, 실제로 읽고 싶은 멋진 매거진을 생성합니다.

- 🤖 **AI 요약** — 클릭하기 전에 핵심 파악 (Claude 지원)
- 📰 **매거진 스타일 UI** — 지루한 목록이 아닌, 큐레이션된 읽기 경험
- 🔒 **100% 로컬** — 데이터가 내 컴퓨터에만 저장
- ⚡ **5분 설치** — 설치하고, 슬랙 연결하면 끝


## 요구 사항

- Node.js 18+
- AI API 키 (Anthropic)
- 슬랙 계정


## 빠른 시작

```bash
# 전역 설치
npm install -g linkpress

# 초기화 (AI 프로바이더 설정)
linkpress init

# 슬랙 워크스페이스 연결
linkpress source add slack

# 동기화, 생성, 실행!
linkpress sync
linkpress generate
linkpress serve
```


## Step 1: 슬랙 연결

자동 토큰 추출로 슬랙 워크스페이스를 연결합니다. 로그인만 하면 나머지는 자동으로 처리됩니다.

> **🚀 Coming Soon:** LinkPress SaaS에서 **Slack OAuth**를 지원할 예정입니다 — 원클릭으로 워크스페이스 연결이 가능해집니다.

```bash
linkpress source add slack
```

<p align="center">
  <img src="assets/add.gif" alt="Connect Slack" width="800">
</p>

> **⚠️ 중요:** 브라우저가 열리면 **슬랙 데스크톱 앱으로 열지 마세요**. 
> 반드시 **"브라우저에서 슬랙 사용"**을 클릭해야 합니다.
> 자동 토큰 추출은 브라우저에서만 작동합니다.

> **📝 참고:** **자동** 방식(기본값)을 권장합니다. 자동 추출이 실패하면 
> **수동** 모드를 선택하여 브라우저 DevTools에서 토큰을 복사할 수 있습니다. 
> CLI가 과정을 안내합니다.

실시간 자동완성으로 모니터링할 채널을 선택하세요. **저장된 메시지(나에게 보낸 DM)**가 기본으로 추가됩니다. 검색어를 입력하고, Enter로 선택하고, "Done"을 선택하면 완료됩니다.

<p align="center">
  <img src="assets/select.gif" alt="Channel Selection" width="800">
</p>

> **💡 팁:** 저장된 메시지가 링크 큐레이션의 가장 쉬운 방법입니다 — 슬랙에서 관심 있는 아티클을 나에게 전달하기만 하면 됩니다!


## Step 2: 링크 동기화

연결된 슬랙 채널에서 링크를 가져옵니다. AI가 자동으로 노이즈(내부 문서, 동영상 등)를 필터링하고 가치 있는 기술 콘텐츠만 남깁니다.

```bash
linkpress sync
```

<p align="center">
  <img src="assets/sync.gif" alt="Sync Links" width="800">
</p>


## Step 3: 매거진 생성

> **⚠️ 중요:** 슬랙 토큰은 주기적으로 만료됩니다. 동기화 중 `invalid_auth` 에러가 발생하면 `linkpress source add slack`을 다시 실행하여 토큰을 갱신하세요.

AI로 아티클을 처리하고 나만의 매거진을 생성합니다. 각 아티클에 다음이 포함됩니다:
- 눈길을 끄는 헤드라인
- TL;DR 요약
- 핵심 포인트
- 난이도
- 읽기 시간

```bash
linkpress generate
linkpress serve
```

<p align="center">
  <img src="assets/generate.gif" alt="Generate Magazine" width="800">
</p>

> **참고:** 봇 탐지가 있는 일부 웹사이트는 스크래핑에 실패할 수 있습니다 (HTTP 403). 이런 아티클은 처리 중 건너뛰지만, 원본 URL로 직접 접근할 수 있습니다.


## 기능

### 🤖 AI 기반
- **Anthropic** (Claude) - 현재 지원
- **OpenAI** (GPT) - 지원 예정
- **Google** (Gemini) - 지원 예정

### 📊 스마트 분류
아티클이 자동으로 태그되고 분류됩니다:
- 주제 (Frontend, Backend, DevOps, AI/ML 등)
- 난이도 (입문, 중급, 고급)
- 읽기 시간

### 🌙 라이트 & 다크 테마
라이트 모드와 다크 모드를 전환할 수 있습니다. 설정이 저장됩니다.

### ✅ 읽음/안읽음 추적
읽은 것을 추적합니다. 클릭 한 번으로 아티클을 읽음으로 표시할 수 있습니다.

### 👀 워치 모드
실시간 모니터링 — 새 아티클이 공유되면 자동으로 나타납니다.

```bash
linkpress serve --watch
```

### 🌍 다국어 지원
원하는 언어로 AI 요약을 받을 수 있습니다 (English, 한국어, 日本語, 中文 등)

## 명령어

| 명령어 | 설명 |
|--------|------|
| `linkpress init` | AI 프로바이더 및 설정 구성 |
| `linkpress source add slack` | 슬랙 워크스페이스 연결 |
| `linkpress source list` | 연결된 소스 목록 |
| `linkpress source remove slack` | 워크스페이스 제거 |
| `linkpress sync` | 슬랙에서 링크 가져오기 |
| `linkpress add <url>` | 수동으로 URL 추가 |
| `linkpress list` | 저장된 아티클 보기 |
| `linkpress generate` | 아티클 처리 및 매거진 생성 |
| `linkpress generate --skip-process` | AI 처리 없이 재생성 |
| `linkpress serve` | 로컬 서버 시작 (localhost:3000) |
| `linkpress serve --watch` | 실시간 모니터링으로 시작 |
| `linkpress clear` | 모든 아티클 삭제 |


## 설정

설정은 `~/.linkpress/config.yaml`에 저장됩니다:

```yaml
ai:
  provider: anthropic  # anthropic, openai, gemini
  model: claude-sonnet-4-5-20250929
  apiKey: sk-ant-...
  language: 한국어    # 요약 언어

sources:
  slack:
    - workspace: MyWorkspace
      channels:
        - id: C01234567
          name: tech-links

output:
  directory: ~/.linkpress/output
  format: html
```


## 기여하기

기여를 환영합니다!

- 🐛 버그 제보
- 💡 기능 제안
- 🔧 풀 리퀘스트


## 저자

[Changmin (Chris) Kang](https://github.com/mindori)
