"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnalysisQueue, applyAnalysis, newMeeting, parseAnalysis, reportFor, type Meeting } from "@/lib/coach/model";
import { loadMeetings, saveMeeting, deleteMeeting } from "@/lib/coach/storage";
import { authHeaders } from "@/lib/coach/auth";
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
        summary: JSON.stringify({ summary: snapshot.summary, decisions: snapshot.decisions, actions: snapshot.actions, openQuestions: snapshot.openQuestions }).slice(0, 10000), transcript,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "분석에 실패했습니다.");
      const result = parseAnalysis(data.analysis, new Set(transcript.map(t => t.id)));
      const latest = current.current;
      if (alive.current && latest?.id === snapshot.id) { update(applyAnalysis(latest, result)); setLatency(data.latencyMs); setError(""); }
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
  const appendText = (text: string) => {
    const m = current.current;
    if (!m || m.endedAt || !text.trim()) return;
    update({ ...m, transcript: [...m.transcript, { id: crypto.randomUUID(), text: text.trim(), at: new Date().toISOString() }] });
    // Throttle, do not debounce indefinitely while people keep talking.
    if (aiEnabled.current && !analyzeTimer.current) analyzeTimer.current = setTimeout(() => { analyzeTimer.current = null; requestAnalysis(); }, 1000);
  };
  const begin = async () => {
    setConnecting(true); setError(""); const generation = ++captureGeneration.current;
    try {
      const stop = await startLive({ tabAudio, onText: appendText, onStatus: text => {
        if (!alive.current || generation !== captureGeneration.current) return;
        setStatus(text); if (text !== "녹음 중") setRecording(false);
      } });
      if (!alive.current || generation !== captureGeneration.current) { await stop(); return; }
      stopRef.current = stop; setRecording(true); aiEnabled.current = true; setAutoAI(true);
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
    const transcript = meeting.transcript.map(t => `- [${t.at}] ${t.text}`).join("\n");
    const blob = new Blob([`${meeting.report || reportFor(meeting)}\n## 전사\n${transcript}\n`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `meeting-${meeting.id}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const refreshLibrary = () => { persist(); try { setLibrary(loadMeetings()); } catch { setError("기록을 불러올 수 없습니다."); } };
  const field = (key: "title" | "goal" | "notes" | "context" | "report", value: string) => { if (current.current) update({ ...current.current, [key]: value, confirmed: false }); };

  if (!meeting) return <main className="meeting-shell"><h1>회의 코파일럿</h1><p role="status">{error || "기록을 불러오는 중…"}</p></main>;
  return <main className="meeting-shell">
    <header className="meeting-header"><div><span className="eyebrow">MEETING COPILOT</span><h1>회의에 집중하세요.<br />맥락은 이어집니다.</h1></div><nav><Link href="/">회의</Link><Link href="/meetings" onClick={refreshLibrary}>내 기록</Link><Link href="/history">기존 클라우드 기록</Link></nav></header>
    <div className="meeting-toolbar"><span role="status">{saveStatus}</span><span>{status}</span><button disabled={recording || connecting || busy} onClick={() => { if (!persist()) return; update(newMeeting()); setStatus("녹음 대기"); setError(""); }}>새 회의</button><button onClick={download}>Markdown 내보내기</button></div>
    <p className="meeting-caption">메모와 기록은 이 기기의 브라우저에 저장됩니다. 다른 기기와 동기화되지 않으며 브라우저 데이터 삭제 시 사라질 수 있습니다.</p>
    {error && <div role="alert" className="meeting-error">{error}</div>}
    {showLibrary && <section className="meeting-panel"><h2>내 회의 기록</h2><input aria-label="회의 검색" placeholder="제목·메모·회의록 검색" value={query} onChange={e => setQuery(e.target.value)} /><div className="meeting-library">{library.filter(m => `${m.title} ${m.notes} ${m.report}`.toLowerCase().includes(query.toLowerCase())).map(m => <article key={m.id}><button disabled={recording || connecting || busy} onClick={() => openMeeting(m)}><strong>{m.title}</strong><small>{new Date(m.startedAt).toLocaleString("ko-KR")} · {m.endedAt ? "종료" : "진행 중"}</small></button><button disabled={recording || connecting || busy || m.id === meeting.id} onClick={() => { if (confirm("이 브라우저에서 회의를 삭제할까요?")) { try { deleteMeeting(m.id); refreshLibrary(); } catch { setError("삭제하지 못했습니다."); } } }}>삭제</button><button disabled={!!meeting.endedAt} onClick={() => field("context", `${meeting.context}\n[이전 노트: ${m.title} / ${m.startedAt}]\n${m.report || reportFor(m)}`.slice(-12000))}>이전 맥락으로 추가</button></article>)}{!library.length && <p>저장한 회의가 없습니다.</p>}</div></section>}
    <div className="meeting-grid"><section className="meeting-panel">
      <label>회의 제목<input value={meeting.title} maxLength={200} onChange={e => field("title", e.target.value)} /></label>
      <label>오늘 결정할 일<input placeholder="예: 다음 출시 범위와 담당자를 정합니다" value={meeting.goal} maxLength={2000} onChange={e => field("goal", e.target.value)} /></label>
      <label>내 메모<textarea className="meeting-notes" placeholder="생각과 중요한 내용을 자유롭게 적으세요. AI가 메모를 덮어쓰지 않습니다." value={meeting.notes} onChange={e => field("notes", e.target.value)} /></label>
      <details><summary>이전 미팅 노트 · 참고자료</summary><textarea aria-label="참고자료" placeholder="이전 결정과 관련 문서를 붙여넣으세요. MCP 직접 연결은 준비 중입니다." maxLength={12000} value={meeting.context} onChange={e => field("context", e.target.value)} /><p className="meeting-caption">참고자료는 사용자 입력이며 외부 사실 검증을 대신하지 않습니다.</p></details>
    </section><aside className="meeting-panel"><div className="meeting-section-heading"><h2>현재 회의 요약</h2><span aria-live="polite">{busy ? "분석 중…" : latency !== null ? `최근 서버 분석 ${(latency / 1000).toFixed(1)}초` : "분석 대기"}</span></div>
      <p>{meeting.summary || "발언을 추가한 뒤 AI 분석을 요청하면 핵심 논의가 여기에 정리됩니다."}</p>
      {([["결정", meeting.decisions], ["할 일", meeting.actions], ["열린 질문", meeting.openQuestions]] as const).map(([title, items]) => <div key={title} className="meeting-state"><h3>{title}</h3>{items.length ? <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="meeting-caption">아직 확인된 내용이 없습니다.</p>}</div>)}
      <div className="meeting-actions"><button disabled={connecting || !!meeting.endedAt} onClick={requestAnalysis}>요약 · 코칭 요청</button><label className="meeting-check"><input type="checkbox" checked={autoAI} disabled={!!meeting.endedAt} onChange={e => { aiEnabled.current = e.target.checked; setAutoAI(e.target.checked); }} />새 발언 자동 분석</label></div>
      <div className="meeting-section-heading"><h2>지금 필요한 도움</h2><label className="meeting-check"><input type="checkbox" checked={quiet} onChange={e => setQuiet(e.target.checked)} />조용히</label></div>
      {quiet ? <p>도움을 잠시 숨겼습니다. 전사와 요약은 계속됩니다.</p> : meeting.cards.filter(c => !c.dismissed).slice(-3).reverse().map(c => <article className="meeting-coaching" key={c.id}><strong>{c.type === "QUESTION" ? "확인할 점" : c.type === "ANSWER" ? "관련 정보" : "놓치지 않을 점"}</strong><p>{c.content}</p><details><summary>발언 근거 보기</summary>{c.evidenceIds.map(id => <p key={id}>{meeting.transcript.find(t => t.id === id)?.text || "이전 발언"}</p>)}</details><button onClick={() => update({ ...meeting, cards: meeting.cards.map(item => item.id === c.id ? { ...item, dismissed: true } : item) })}>확인 완료</button></article>)}
      {!quiet && !meeting.cards.some(c => !c.dismissed) && <p className="meeting-caption">필요한 순간에만 확인 질문과 인사이트를 제안합니다.</p>}
    </aside></div>
    <section className="meeting-panel"><div className="meeting-section-heading"><h2>회의 음성 · 전사</h2><div className="meeting-actions"><label className="meeting-check"><input type="checkbox" disabled={recording || connecting} checked={tabAudio} onChange={e => setTabAudio(e.target.checked)} />탭 오디오 함께 수집</label><button className="meeting-primary" disabled={connecting || !!meeting.endedAt} onClick={recording ? pause : begin}>{connecting ? "처리 중…" : recording ? "녹음 일시 정지" : "녹음 시작"}</button><button disabled={connecting || !!meeting.endedAt} onClick={finish}>회의 종료 · 초안 만들기</button></div></div>
      <p className="meeting-caption">실시간 음성·AI 분석은 서버의 Gemini 모델 설정과 Supabase 인증이 필요합니다. 연결 종료 시 기록을 보존하고 재시작을 안내합니다. 자동 복구는 아직 지원하지 않습니다.</p>
      {!meeting.endedAt && <form className="meeting-manual" onSubmit={e => { e.preventDefault(); appendText(manual); setManual(""); }}><input aria-label="수동 발언" value={manual} maxLength={4000} onChange={e => setManual(e.target.value)} placeholder="음성 설정 없이 발언을 직접 입력할 수 있습니다" /><button disabled={!manual.trim()}>발언 추가</button></form>}
      <details><summary>전사 {meeting.transcript.length}개 보기</summary><div className="meeting-transcript">{meeting.transcript.map(t => <p key={t.id}><time>{new Date(t.at).toLocaleTimeString("ko-KR")}</time>{t.text}</p>)}</div></details>
    </section>
    {meeting.endedAt && <section className="meeting-panel"><div className="meeting-section-heading"><h2>회의록 {meeting.confirmed ? "· 검토 완료" : "초안 · 검토 필요"}</h2><button onClick={() => update({ ...meeting, confirmed: true })}>검토 완료로 표시</button></div><textarea aria-label="회의록 편집" className="meeting-report" value={meeting.report} onChange={e => field("report", e.target.value)} /><p className="meeting-caption">원본 메모와 전사는 그대로 보존됩니다. 결정·담당자·기한을 확인한 뒤 확정해 주세요.</p></section>}
  </main>;
}
