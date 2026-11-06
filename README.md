# 회의 코파일럿

내 메모와 회의 맥락을 보존하고, 실시간 요약·확인 질문·인사이트를 제공하는 Next.js 앱입니다.

## 실행

로컬의 녹음 오류나 `realtime-coach/realtime-coach` 중첩 폴더 문제는 [로컬 설정·정리 안내](docs/local-setup.md)를 먼저 확인하세요. `npm run setup:check`는 키 값 없이 실행 폴더와 설정 존재 여부를 진단합니다.

```bash
npm ci
npm run dev
```

`/`에서 회의를 작성하고 `/meetings`에서 브라우저에 저장한 기록을 검색합니다. 메모·수동 전사·회의록 초안·편집·Markdown 내보내기는 API 키 없이 사용할 수 있습니다. 새 기록은 로컬 브라우저 저장소에 보관되며 클라우드에 동기화되지 않습니다.

실시간 음성과 AI 분석은 `.env.example`을 참고해 런타임 환경변수를 설정하세요. Supabase anonymous sign-in과 실제 계정에서 사용 가능한 Gemini Live/코칭 모델이 필요합니다. 모델명을 임의로 고정하지 않습니다. 장기 키는 서버에만 두며 Live 연결은 인증된 단기 토큰을 사용합니다.

실제 음성 연결과 AI 품질·지연은 자격증명을 연결한 뒤 검증해야 합니다. MCP는 아직 직접 연결되지 않으며, 이전 미팅 노트와 참고자료를 직접 추가할 수 있습니다. `/history`는 기존 Supabase 기록용입니다.

## 검증

테스트는 Node 24를 사용합니다.

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

선택적 브라우저 스모크 테스트: Python Playwright와 `/usr/bin/chromium`이 설치된 환경에서 공급자 설정 없이 `npm run start -- --port 3100`을 실행한 뒤 `python tests/browser_smoke.py`를 실행합니다.

구현 범위·인증·데이터·제약은 [구현 문서](docs/implementation.md)를 참고하세요.

## 대면 화자 구분과 코칭 화면

한 마이크의 화자 구분은 서버의 `DEEPGRAM_API_KEY`가 추가로 필요합니다. `Gemini 기본 전사`는 화자 미분리 모드입니다. 화자별 전사에서 내 화자를 선택하면 개인 발언 코칭을 받을 수 있습니다. 질문·인사이트·중간 요약은 전체 회의 맥락을 사용합니다. [실제 기능 상태와 검증 한계](docs/speaker-ui-audit.md)를 확인하세요.
