---
version: 1
slug: "src-components-meeting-meetingworkspace-tsx"
primary_target: "src/components/meeting/MeetingWorkspace.tsx"
related_targets: []
---

# Meeting workspace
Mode: Operate. Extend the incumbent muted green/neutral identity with a shadcn workspace composition. Product truth: PRODUCT.md.

## Direction contract
THESIS: 회의를 듣는 화면은 화자별 발언과 지금 필요한 도움을 먼저 보여준다. 거대한 환영 문구와 메모 우선의 긴 문서 구조를 없앤다.
OWN-WORLD: 기존 녹색 작업 액센트와 옅은 중성 배경을 유지한다. shadcn의 버튼·탭·입력·스위치·다이얼로그를 일관되게 사용하고 얇은 구분선으로 영역을 나눈다.
STORY: 회의 준비 → 녹음 → 화자 확인/내 화자 지정 → 코칭 근거 확인 → 중간 요약 → 종료/검토.
FIRST VIEWPORT: 상단 제목·목적과 녹음 제어. 왼쪽 넓은 화자별 전사, 오른쪽 질문/개인 코칭/인사이트 피드. 요약은 별도 탭으로 바로 전환. 메모·참고자료는 보조 탭. 모바일은 전사/도움/요약을 탭으로 전환한다.
FORM: Existing-surface task extension; no replacement brand. seed: none (not applicable to scoped existing extension).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
