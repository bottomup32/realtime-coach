# 대면 회의 코치 — 기능·UI/UX 점검

## 사용자에게 확인한 핵심 상황

한 마이크로 여러 사람이 참여하는 대면 회의. Speaker A/B/C 구분 후 내가 누구인지 지정하고, 내 발언에 대한 코칭, 회의 맥락에 따른 질문·인사이트, 중간 요약을 받는다.

## 리서치 방법

- 공식 Impeccable 4.8.0 스킬의 context/init/Operate/craft-floor를 읽고 적용했다. 공식 소스: https://github.com/pbakaus/impeccable/tree/main/plugin/skills/impeccable
- 독립된 디자인 검토(A), 탐지기·브라우저 근거 검토(B), 별도 최종 검토와 문서화를 수행했다. 탐지기는 한 번 실행했다.
- shadcn/ui의 기존 Button, Input, Card, Tabs, Switch 구성요소를 사용했다. 참고: https://ui.shadcn.com/docs/components/tabs
- 화자 분리는 Deepgram 공식 문서 https://developers.deepgram.com/docs/diarization 와 설치된 SDK의 LiveTranscriptionEvent.words[].speaker, auth.grantToken, accessToken 지원을 확인했다.
- Gemini inputAudioTranscription에는 화자 ID가 없다. 기존의 혼합 음성 전사에 A/B를 임의로 붙이는 접근은 제외했다.

## 발견한 문제와 개선

기존 화면은 큰 헤드라인과 메모가 먼저 보이고 녹음·전사가 아래에 있었다. 화자 정보, 내 화자 선택, 개인 코칭 유형, 이전 중간 요약이 없었다.

현재 화면은 상단에 녹음/전사 방식/종료, 왼쪽 화자별 전사와 내 화자 선택, 오른쪽 내 코칭·추천 질문·인사이트를 배치한다. 메모·참고자료·중간 요약은 탭으로 이동했다. 모바일은 대화/도움/요약에 바로 접근한다. 근거 링크로 전사를 확인하고 잘못 배정된 화자는 수동 수정할 수 있다.

## 요구사항별 실제 상태

| 요구사항 | 구현 | 검증 |
|---|---|---|
| 한 마이크의 A/B/C 자동 구분 | Deepgram diarize=true, 단어별 화자 그룹화, 세션별 화자 ID, 미확인 화자 유지 | 그룹화/재연결 ID 단위 테스트 통과. 실제 공급자 키가 없어 음성 정확도는 미검증 |
| 내가 누구인지 지정 | 내 화자 선택, 나 표시, 재연결 때 재지정 | 브라우저에서 B 지정·강조·보존 확인 |
| 내 발언 코칭 | COACH 유형과 targetSpeakerId, 서버/클라이언트 근거 제한 | 실제 Gemini 호출에서 B만 근거로 쓰는 개인 코칭 생성 확인 |
| 회의 맥락 질문 | QUESTION 유형·별도 필터 | 실제 Gemini 호출에서 질문 카드 확인 |
| 인사이트 | INSIGHT 유형·별도 필터 | 실제 Gemini 호출에서 인사이트 확인. 새 관점이 없는 경우 0개 허용 |
| 중간 요약 | 현재 요약과 이전 스냅샷 타임라인 | 상태 저장·타임라인·이전 결정 보존 테스트 통과 |
| 메모/종료 후 회의록 | 기존 원문·초안·편집·내보내기 유지, 전사 내보내기에 화자 포함 | 메모 재열기 확인. 새 공급자 종료 음성은 키 설정 후 추가 검증 필요 |
| shadcn/ui와 반응형 | 실제 shadcn 구성요소, 데스크톱 두 영역, 모바일 직접 전환 | 1360×900/390×844 넘침 없음, 키보드 탭 전환·포커스 확인 |

## 추가 설정

서버 환경에 DEEPGRAM_API_KEY가 필요하다. NEXT_PUBLIC 접두사를 붙이지 않는다. 선택적으로 DEEPGRAM_MODEL을 지정하며 기본값 nova-3의 한국어/diarization 지원을 실제 계정에서 확인해야 한다. 브라우저에는 인증된 요청으로 받은 짧은 수명의 접근 토큰만 전달한다. 장기 키 반환 GET API는 계속 종료 상태다.

Gemini 기본 전사는 별도 모드로 유지하며 자동 화자 구분이 없다고 표시한다. 대면 모드에 필요한 키가 없을 때 자동으로 Gemini로 바꾸거나 가짜 화자를 만들지 않는다. 이 환경에는 해당 키가 없어 공급자 실음성 검증을 완료했다고 보고하지 않는다.

화자 번호는 신원이 아니며 재연결 후 다시 시작될 수 있다. 서로 다른 연결의 Speaker A를 같은 사람으로 자동 합치지 않는다. 화자 이름이 실제 인물의 이름이라고 주장하지 않는다. 겹침·잡음·비슷한 목소리의 정확도와 30~60분 안정성은 후속 실음성 검증 항목이다.

## 검증과 디자인 검토 결과

`npm test`: 기존 12개 + 화자/코칭/요약 4개. 타입 검사와 린트도 수행한다.
`tests/speaker_workspace.py`: 실제 Gemini + 수동 화자 입력으로 내 코칭 근거, 요약 이력, 메모 재열기, 모바일·JavaScript 오류를 검사한다. 자동 diarization의 실음성 검증을 대체하지 않는다. NODE_USE_ENV_PROXY=1로 개발 서버를 3103 포트에 시작하고 Python Playwright/Chromium이 필요하다.

디자인 탐지기는 비활성 legacy .meeting-* CSS 두 곳을 지적했다. 새 .coach-* 화면에는 해당 장식이 사용되지 않는다. 독립 브라우저 검토에서 수동 화자 셀렉트 잘림과 스위치 히트 영역을 수정했다. 최종 독립 검토의 모바일 탐색/검증용 데이터 표시 두 항목 모두 resolved, 그 범위에서 disposition ship이다. 제품 전체 기능/화자 정확도 인증을 뜻하지 않는다.

시각 체계는 DESIGN.md와 .impeccable/design.json, 제품 사실은 PRODUCT.md에 기록했다. 스크린샷은 테스트용 임시 브라우저 데이터이며 실제 회의록이 아니다.
