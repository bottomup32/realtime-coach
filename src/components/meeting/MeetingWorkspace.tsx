"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnalysisQueue, applyAnalysis, newMeeting, parseAnalysis, reportFor, type Meeting, type Utterance, personalCards } from "@/lib/coach/model";
import { loadMeetings, saveMeeting, deleteMeeting } from "@/lib/coach/storage";
import { authHeaders } from "@/lib/coach/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Mic, Pause, Square, FileText, MessagesSquare, Lightbulb, HelpCircle, Sparkles, Download, Plus, ArrowRight, Check, Volume2 } from "lucide-react";
import { speakerName } from "@/lib/coach/speakers";
import { startLive } from "@/lib/coach/live";

export function MeetingWorkspace({ showLibrary = false }: { showLibrary?: boolean }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const current = useRef<Meeting | null>(null);
  const [library, setLibrary] = useState<Meeting[]>([]);
  const [saveStatus, setSaveStatus] = useState("불러오는 중");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("녹음 대기");
  const [manual, setManual] = useState("");
  const [query, setQuery] = useState("");
  const [quiet, setQuiet] = useState(false);
  const [manualSpeaker, setManualSpeaker] = useState("manual-a");
  const [helpFilter, setHelpFilter] = useState("all");
  const [mobileHelp, setMobileHelp] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState("transcript");
  const [tabAudio, setTabAudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  const alive = useRef(true);
  const captureGeneration = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const aiEnabled = useRef(false);
  const [autoAI, setAutoAI] = useState(false);
  const analysisFailed = useRef(false);

  const persist = () => {
    const value = current.current;
    if (!value) return true;
    try { saveMeeting(value); setSaveStatus("이 브라우저에 저장됨"); return true; }
    catch { setSaveStatus("저장 실패 — 내보내기로 백업해 주세요"); return false; }
  };
  const update = (value: Meeting) => {
    current.current = value; setMeeting(value); setSaveStatus("저장 중…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 400);
  };
  const [queue] = useState(() => new AnalysisQueue(async () => {
    const snapshot = current.current;
    if (!snapshot || !alive.current) return;
    setBusy(true); analysisFailed.current = false;
    const controller = new AbortController(); requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const headers = await authHeaders();
      const transcript = snapshot.transcript.slice(-60).map(t => ({ ...t, text: t.text.slice(0, 4000) }));
      const response = await fetch("/api/coach/analyze", { method: "POST", headers, signal: controller.signal, body: JSON.stringify({
        goal: snapshot.goal.slice(0, 2000), notes: snapshot.notes.slice(-6000), context: snapshot.context.slice(0, 6000),
        summary: JSON.stringify({ summary: snapshot.summary, decisions: snapshot.decisions, actions: snapshot.actions, openQuestions: snapshot.openQuestions, recentCards: snapshot.cards.slice(-5).map(c => c.content) }).slice(0, 10000), selfSpeakerId: snapshot.selfSpeakerId, transcript,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "분석에 실패했습니다.");
      const result = parseAnalysis(data.analysis, new Set(transcript.map(t => t.id)));
      const latest = current.current;
      if (alive.current && latest?.id === snapshot.id) { update(applyAnalysis(latest, personalCards(result, latest.transcript, latest.selfSpeakerId === snapshot.selfSpeakerId ? latest.selfSpeakerId : undefined))); setLatency(data.latencyMs); setError(""); }
    } catch (e) {
      analysisFailed.current = true;
      if (alive.current) { setError(e instanceof Error && e.name !== "AbortError" ? e.message : "분석 시간이 초과됐습니다. 전사와 메모는 보존됩니다."); aiEnabled.current = false; setAutoAI(false); }
    } finally { clearTimeout(timeout); if (alive.current) setBusy(false); }
  }));

  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (!alive.current) return;
      try {
        const all = loadMeetings(); setLibrary(all);
        const value = all.find(m => !m.endedAt) || newMeeting(); current.current = value; setMeeting(value); setSaveStatus("이 브라우저에 저장");
      } catch (e) { setError(e instanceof Error ? e.message : "기록을 불러오지 못했습니다."); setSaveStatus("불러오기 실패"); }
    });
    const flush = () => { if (current.current) { try { saveMeeting(current.current); } catch { /* keep current browser state */ } } };
    window.addEventListener("pagehide", flush);
    return () => {
      alive.current = false; requestRef.current?.abort();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (analyzeTimer.current) clearTimeout(analyzeTimer.current);
      void stopRef.current?.(); flush(); window.removeEventListener("pagehide", flush);
    };
  }, []);

  const requestAnalysis = () => { void queue.request().catch(() => setError("분석을 다시 시도해 주세요.")); };
  const appendUtterances = (items: Utterance[]) => {
    const m = current.current;
    if (!m || m.endedAt || !items.length) return;
    update({ ...m, transcript: [...m.transcript, ...items] });
    if (aiEnabled.current && !analyzeTimer.current) analyzeTimer.current = setTimeout(() => { analyzeTimer.current = null; requestAnalysis(); }, 1000);
  };
  const appendText = (text: string, speakerId?: string, speakerLabel?: string) => {
    if (text.trim()) appendUtterances([{ id: crypto.randomUUID(), text: text.trim(), at: new Date().toISOString(), speakerId, speakerLabel }]);
  };
  const begin = async () => {
    setConnecting(true); setError(""); const generation = ++captureGeneration.current;
    try {
      const onStatus = (text: string) => {
        if (!alive.current || generation !== captureGeneration.current) return;
        setStatus(text); if (text !== "녹음 중") setRecording(false);
      };
      const stop = await startLive({ tabAudio, onText: text => appendText(text), onStatus });
      if (!alive.current || generation !== captureGeneration.current) { await stop(); return; }
      stopRef.current = stop; setRecording(true);
      aiEnabled.current = true; setAutoAI(true);
    } catch (e) { setError(e instanceof Error ? e.message : "녹음에 실패했습니다."); setStatus("녹음 대기"); }
    finally { if (alive.current) setConnecting(false); }
  };
  const pause = async () => {
    setConnecting(true);
    try { await stopRef.current?.(); stopRef.current = null; setRecording(false); setStatus("녹음 일시 정지"); }
    finally { setConnecting(false); }
  };
  const finish = async () => {
    setConnecting(true); setError("");
    try {
      await stopRef.current?.(); stopRef.current = null; setRecording(false);
      if (analyzeTimer.current) { clearTimeout(analyzeTimer.current); analyzeTimer.current = null; }
      const shouldAnalyze = aiEnabled.current; aiEnabled.current = false; setAutoAI(false);
      if (shouldAnalyze) await queue.request(); else await queue.flush();
      const m = current.current; if (!m) return;
      const done = { ...m, endedAt: new Date().toISOString(), report: reportFor(m), confirmed: false };
      update(done); persist(); setStatus("회의 종료 · 회의록을 검토해 주세요");
      if (analysisFailed.current) setError("최종 AI 분석이 완료되지 않았습니다. 보존된 메모·전사와 기존 요약으로 초안을 만들었습니다.");
    } finally { setConnecting(false); }
  };
  const openMeeting = (m: Meeting) => {
    if (recording || connecting || busy) return;
    if (!persist()) return;
    update(m); setError(""); setStatus(m.endedAt ? "저장된 회의" : "녹음 대기");
  };
  const download = () => {
    if (!meeting) return;
    const transcript = meeting.transcript.map(t => `- [${t.at}] ${speakerName(t)}: ${t.text}`).join("\n");
    const blob = new Blob([`${meeting.report || reportFor(meeting)}\n## 전사\n${transcript}\n`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `meeting-${meeting.id}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const refreshLibrary = () => { persist(); try { setLibrary(loadMeetings()); } catch { setError("기록을 불러올 수 없습니다."); } };
  const field = (key: "title" | "goal" | "notes" | "context" | "report", value: string) => { if (current.current) update({ ...current.current, [key]: value, confirmed: false }); };

  if (!meeting) return <main className="coach-app"><p role="status">{error || "회의 기록을 불러오고 있습니다…"}</p></main>;
  const manualSpeakers = ["a", "b", "c"].map(letter => ({ id: `manual-${letter}`, label: `Speaker ${letter.toUpperCase()} · 수동` }));
  const speakers = Array.from(new Map([...manualSpeakers.map(person => [person.id, person] as const), ...meeting.transcript.filter(t => t.speakerId).map(t => [t.speakerId!, { id: t.speakerId!, label: speakerName(t) }] as const)]).values()).map((person, _, all) => { const duplicates = all.filter(p => p.label === person.label); return { ...person, label: duplicates.length > 1 ? `${person.label} · 연결 ${duplicates.findIndex(p => p.id === person.id) + 1}` : person.label }; });
  const activeCards = meeting.cards.filter(c => !c.dismissed && (c.type !== "COACH" || (c.targetSpeakerId === meeting.selfSpeakerId && c.evidenceIds.every(id => meeting.transcript.some(t => t.id === id && t.speakerId === meeting.selfSpeakerId)))) && (helpFilter === "all" || c.type === helpFilter));
  const selectedSpeaker = speakers.find(s => s.id === meeting.selfSpeakerId);
  const cardMeta = { COACH: { label: "내 발언 코칭", icon: Sparkles }, QUESTION: { label: "추천 질문", icon: HelpCircle }, INSIGHT: { label: "인사이트", icon: Lightbulb }, ANSWER: { label: "관련 정보", icon: FileText } };
  return <main className="coach-app">
    <header className="coach-header"><Link className="coach-brand" href="/"><MessagesSquare size={21} aria-hidden="true" /><span>회의 코치</span></Link><nav aria-label="주 메뉴"><Link aria-current={!showLibrary ? "page" : undefined} href="/">실시간 회의</Link><Link aria-current={showLibrary ? "page" : undefined} href="/meetings" onClick={refreshLibrary}>내 기록</Link></nav><span className="coach-save" role="status">{saveStatus}</span></header>
    <section className="coach-heading"><div><label className="sr-only" htmlFor="meeting-title">회의 제목</label><Input id="meeting-title" className="coach-title" value={meeting.title} maxLength={200} onChange={e => field("title", e.target.value)} /><label className="sr-only" htmlFor="meeting-goal">오늘 결정할 일</label><Input id="meeting-goal" className="coach-goal" placeholder="오늘 결정할 일을 적어두세요" value={meeting.goal} maxLength={2000} onChange={e => field("goal", e.target.value)} /></div><div className="coach-heading-actions"><Button variant="outline" onClick={download}><Download size={15} />내보내기</Button><Button variant="outline" disabled={recording || connecting || busy} onClick={() => { if (!persist()) return; update(newMeeting()); setStatus("녹음 대기"); setError(""); }}><Plus size={15} />새 회의</Button></div></section>
    <section className="coach-recordbar" aria-label="녹음 제어"><div className="coach-record-status"><span className={recording ? "coach-dot is-live" : "coach-dot"} /><strong aria-live="polite">{status}</strong><span className="coach-record-description">Gemini Live</span></div><div className="coach-record-actions"><Button disabled={connecting || !!meeting.endedAt} onClick={recording ? pause : begin}>{recording ? <Pause size={15} /> : <Mic size={15} />}{connecting ? "연결 처리 중…" : recording ? "녹음 일시 정지" : "녹음 시작"}</Button><Button variant="outline" disabled={connecting || !!meeting.endedAt} onClick={finish}><Square size={13} />회의 종료 · 초안 만들기</Button></div></section>
    {error && <div role="alert" className="coach-error">{error}</div>}
    <div className="coach-scope"><span>자동 화자 구분은 지원하지 않습니다. 전사의 화자를 직접 지정한 뒤 내 화자를 선택하세요.</span><span>기록은 이 브라우저에 저장됩니다.</span></div>
    {showLibrary && <section className="coach-library" aria-label="저장된 회의"><h2>내 회의 기록</h2><Input aria-label="회의 검색" placeholder="제목·메모·회의록 검색" value={query} onChange={e => setQuery(e.target.value)} />{library.filter(m => `${m.title} ${m.notes} ${m.report}`.toLowerCase().includes(query.toLowerCase())).map(m => <div className="coach-library-row" key={m.id}><Button variant="ghost" disabled={recording || connecting || busy} onClick={() => openMeeting(m)}>{m.title} <span>{new Date(m.startedAt).toLocaleDateString("ko-KR")}</span></Button><Button variant="outline" disabled={!!meeting.endedAt} onClick={() => field("context", `${meeting.context}\n[이전 노트: ${m.title} / ${m.startedAt}]\n${m.report || reportFor(m)}`.slice(-12000))}>맥락에 추가</Button><Button variant="ghost" disabled={recording || connecting || busy || m.id === meeting.id} onClick={() => { if (confirm("이 브라우저에서 회의를 삭제할까요?")) { try { deleteMeeting(m.id); refreshLibrary(); } catch { setError("삭제하지 못했습니다."); } } }}>삭제</Button></div>)}{!library.length && <p className="coach-muted">저장한 회의가 없습니다. 회의를 마치면 여기서 이어볼 수 있습니다.</p>}</section>}
    <div className="coach-mobile-actions"><Tabs value={mobileHelp ? "help" : workspaceTab === "summary" ? "summary" : "conversation"} onValueChange={value => { setMobileHelp(value === "help"); if (value !== "help") setWorkspaceTab(value === "summary" ? "summary" : "transcript"); }}><TabsList aria-label="회의 화면 전환"><TabsTrigger value="conversation">대화</TabsTrigger><TabsTrigger value="help">도움 {meeting.cards.filter(c => !c.dismissed).length}</TabsTrigger><TabsTrigger value="summary">요약</TabsTrigger></TabsList></Tabs></div>
    <div className="coach-workspace" data-mobile-help={mobileHelp}>
      <Card className="coach-conversation"><CardHeader className="coach-panel-heading"><div><CardTitle>대화와 맥락</CardTitle><p className="coach-muted">누가 무엇을 말했는지, 흐름을 놓치지 마세요.</p></div><span className="coach-count">발언 {meeting.transcript.length}</span></CardHeader><CardContent className="coach-panel-content">
        <div className="coach-speaker-picker"><label htmlFor="self-speaker">내 화자</label><select id="self-speaker" className="coach-select" value={meeting.selfSpeakerId || ""} onChange={e => update({ ...meeting, selfSpeakerId: e.target.value || undefined })}><option value="">발언을 확인한 뒤 선택</option>{speakers.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>{selectedSpeaker ? <span className="coach-me-label"><Check size={13} />{selectedSpeaker.label}의 발언을 코칭합니다</span> : <span className="coach-muted">개인 코칭은 선택 후 시작됩니다</span>}</div>
        <Tabs value={workspaceTab} onValueChange={setWorkspaceTab}><TabsList className="coach-main-tabs"><TabsTrigger value="transcript">실시간 전사</TabsTrigger><TabsTrigger value="summary">중간 요약</TabsTrigger><TabsTrigger value="notes">내 메모</TabsTrigger><TabsTrigger value="context">참고자료</TabsTrigger></TabsList>
          <TabsContent value="transcript"><div className="coach-transcript" role="log" aria-label="화자별 대화" aria-live="off">{!meeting.transcript.length && <div className="coach-empty"><Volume2 size={28} aria-hidden="true" /><h3>대화가 시작되면 여기에 모입니다</h3><p>녹음을 시작하면 발언이 표시됩니다.<br />화자 A·B·C를 직접 지정하고 내 화자를 선택하세요.</p></div>}{meeting.transcript.map(t => <article className="coach-utterance" key={t.id} id={`utterance-${t.id}`} data-self={!!meeting.selfSpeakerId && t.speakerId === meeting.selfSpeakerId}><div className="coach-utterance-meta"><span className="coach-avatar" aria-hidden="true">{speakerName(t).replace("Speaker ", "").slice(0, 1)}</span><strong>{speakerName(t)}</strong>{meeting.selfSpeakerId && t.speakerId === meeting.selfSpeakerId && <span className="coach-me-tag">나</span>}<time dateTime={t.at}>{new Date(t.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div><p>{t.text}</p><label className="coach-correct-speaker">화자 수정<select aria-label={`화자 수정 ${t.id}`} value={t.speakerId || ""} onChange={e => { const person = speakers.find(s => s.id === e.target.value); update({ ...meeting, transcript: meeting.transcript.map(item => item.id === t.id ? { ...item, speakerId: person?.id, speakerLabel: person?.label } : item) }); }}><option value="">화자 미확인</option>{speakers.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label></article>)}</div>
            {!meeting.endedAt && <form className="coach-manual" onSubmit={e => { e.preventDefault(); appendText(manual, manualSpeaker, `Speaker ${manualSpeaker.slice(-1).toUpperCase()}`); setManual(""); }}><label className="sr-only" htmlFor="manual-speaker">수동 발언 화자</label><select id="manual-speaker" className="coach-select" value={manualSpeaker} onChange={e => setManualSpeaker(e.target.value)}><option value="manual-a">화자 A</option><option value="manual-b">화자 B</option><option value="manual-c">화자 C</option></select><Input aria-label="수동 발언" value={manual} maxLength={4000} onChange={e => setManual(e.target.value)} placeholder="발언을 직접 입력할 수도 있습니다" /><Button variant="outline" disabled={!manual.trim()} aria-label="발언 추가"><ArrowRight size={16} /></Button></form>}
          </TabsContent>
          <TabsContent value="summary"><div className="coach-summary-current"><h3>현재까지의 논의</h3><p>{meeting.summary || "대화를 분석하면 현재 논의와 합의된 내용을 정리합니다."}</p>{([["결정 사항", meeting.decisions], ["할 일", meeting.actions], ["열린 질문", meeting.openQuestions]] as const).map(([title, items]) => <section key={title}><h4>{title}</h4>{items.length ? <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="coach-muted">아직 확인된 내용이 없습니다.</p>}</section>)}</div><div className="coach-summary-history"><h3>요약 타임라인</h3>{(meeting.summaryHistory || []).slice().reverse().map(item => <details key={item.id}><summary>{new Date(item.at).toLocaleTimeString("ko-KR")} 요약</summary><p>{item.summary}</p></details>)}{!meeting.summaryHistory?.length && <p className="coach-muted">분석이 진행되면 이전 요약도 이곳에 남습니다.</p>}</div></TabsContent>
          <TabsContent value="notes"><label className="coach-field-label" htmlFor="personal-notes">내 메모</label><textarea id="personal-notes" className="coach-textarea" placeholder="중요한 내용과 내 생각을 적으세요. AI가 원문을 덮어쓰지 않습니다." value={meeting.notes} onChange={e => field("notes", e.target.value)} /><p className="coach-muted">메모와 AI 회의록은 따로 보존합니다.</p></TabsContent>
          <TabsContent value="context"><label className="coach-field-label" htmlFor="meeting-context">이전 미팅 노트 · 참고자료</label><textarea id="meeting-context" className="coach-textarea" maxLength={12000} value={meeting.context} placeholder="이전 합의나 프로젝트 자료를 붙여넣으세요." onChange={e => field("context", e.target.value)} /><p className="coach-muted">직접 입력한 참고자료입니다. MCP 자동 검색은 아직 연결되지 않았습니다.</p>{<label className="coach-inline-setting"><Switch checked={tabAudio} disabled={recording || connecting} onCheckedChange={setTabAudio} />탭 오디오 함께 수집 (화자 미분리)</label>}</TabsContent>
        </Tabs>
      </CardContent></Card>
      <Card className="coach-assistance"><CardHeader className="coach-panel-heading"><div><CardTitle>지금 필요한 도움</CardTitle><p className="coach-muted">내 발언은 더 명확하게, 회의는 더 깊게.</p></div><label className="coach-inline-setting"><Switch checked={quiet} onCheckedChange={setQuiet} aria-label="조용히 모드" /><span>조용히</span></label></CardHeader><CardContent className="coach-panel-content">
        <Tabs value={helpFilter} onValueChange={setHelpFilter}><TabsList className="coach-help-tabs"><TabsTrigger value="all">전체</TabsTrigger><TabsTrigger value="COACH">내 코칭</TabsTrigger><TabsTrigger value="QUESTION">질문</TabsTrigger><TabsTrigger value="INSIGHT">인사이트</TabsTrigger></TabsList></Tabs>
        <div className="coach-help-feed">{quiet ? <div className="coach-empty"><h3>도움을 잠시 숨겼습니다</h3><p>전사와 요약은 계속됩니다.</p></div> : !activeCards.length ? <div className="coach-empty"><Sparkles size={26} aria-hidden="true" /><h3>{helpFilter === "COACH" && !selectedSpeaker ? "먼저 내 화자를 선택하세요" : "필요한 순간에만 제안합니다"}</h3><p>{helpFilter === "COACH" ? "내 발언에 근거한 구체적인 표현·논리 코칭을 제공합니다." : "추천 질문, 놓친 연결점과 인사이트가 여기에 나타납니다."}</p></div> : activeCards.slice().reverse().map(c => { const meta = cardMeta[c.type]; const Icon = meta.icon; return <article key={c.id} className="coach-help-item" data-type={c.type}><div className="coach-help-meta"><span><Icon size={15} />{meta.label}</span>{c.type === "COACH" && <span>{selectedSpeaker?.label || "이전 내 화자"}</span>}</div><p>{c.content}</p><details><summary>발언 근거 {c.evidenceIds.length}개</summary>{c.evidenceIds.map(id => { const t = meeting.transcript.find(item => item.id === id); return <a key={id} href={`#utterance-${id}`} onClick={() => { setWorkspaceTab("transcript"); setMobileHelp(false); }}><strong>{t ? speakerName(t) : "이전 발언"}</strong>{t?.text || "근거 발언을 확인하세요"}</a>; })}</details><Button size="sm" variant="ghost" onClick={() => update({ ...meeting, cards: meeting.cards.map(item => item.id === c.id ? { ...item, dismissed: true } : item) })}><Check size={13} />확인 완료</Button></article>; })}</div>
        <div className="coach-analysis-controls"><div><span aria-live="polite">{busy ? "맥락을 분석하고 있습니다…" : latency !== null ? `최근 서버 분석 ${(latency / 1000).toFixed(1)}초` : "분석 대기"}</span><label className="coach-inline-setting"><Switch checked={autoAI} disabled={!!meeting.endedAt} onCheckedChange={value => { aiEnabled.current = value; setAutoAI(value); }} aria-label="새 발언 자동 분석" />자동 분석</label></div><Button variant="outline" disabled={connecting || !!meeting.endedAt} onClick={requestAnalysis}>요약 · 코칭 요청</Button></div>
      </CardContent></Card>
    </div>
    {meeting.endedAt && <Card className="coach-report"><CardHeader className="coach-panel-heading"><CardTitle>회의록 {meeting.confirmed ? "· 검토 완료" : "초안 · 검토 필요"}</CardTitle><Button variant="outline" onClick={() => update({ ...meeting, confirmed: true })}>검토 완료로 표시</Button></CardHeader><CardContent><textarea aria-label="회의록 편집" className="coach-textarea coach-report-editor" value={meeting.report} onChange={e => field("report", e.target.value)} /><p className="coach-muted">결정·담당자·기한을 확인한 뒤 확정해 주세요. 원본 메모와 전사는 그대로 보존됩니다.</p></CardContent></Card>}
  </main>;
}
