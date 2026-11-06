# Calls real services; see docs/live-validation.md before running.
import os,json,time
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture=/tmp/meeting-validation-padded.wav'],proxy={'server':proxy,'bypass':'127.0.0.1,localhost'})
 c=b.new_context(permissions=['microphone']);page=c.new_page()
 page.add_init_script('''window.testTracks=[];const media=navigator.mediaDevices;const capture=media.getUserMedia.bind(media);media.getUserMedia=async(...args)=>{const stream=await capture(...args);window.testTracks.push(...stream.getTracks());return stream;}; window.testSockets=[];const NativeSocket=WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){super(...args);window.testSockets.push(this);}};''')
 timings=[];start=time.monotonic()
 def ws(socket):
  def frame(payload):
   try:
    d=json.loads(payload);s=d.get('serverContent',{});tr=s.get('inputTranscription',{})
    if d.get('setupComplete') is not None:timings.append({'event':'setup','at':round(time.monotonic()-start,2)})
    if tr.get('text'):timings.append({'event':'transcription','at':round(time.monotonic()-start,2),'chars':len(tr['text'])})
   except:pass
  socket.on('framereceived',frame)
 page.on('websocket',ws)
 page.goto('http://127.0.0.1:3101/')
 page.get_by_role('button',name='녹음 시작',exact=True).click();expect(page.get_by_role('button',name='녹음 일시 정지',exact=True)).to_be_visible(timeout=20000)
 page.wait_for_timeout(9000)
 before=time.monotonic();page.get_by_role('button',name='녹음 일시 정지',exact=True).click();expect(page.get_by_role('button',name='녹음 시작',exact=True)).to_be_visible(timeout=15000)
 page.wait_for_timeout(500)
 first=page.evaluate("JSON.parse(localStorage.getItem('meeting-copilot:v1'))[0]")
 tracks=page.evaluate("window.testTracks.map(t=>t.readyState)")
 print(json.dumps({'stage':'pause-before-end','segments':len(first['transcript']),'stop_seconds':round(time.monotonic()-before,2),'tracks':tracks,'events':timings}),flush=True)
 assert first['transcript'],'Pause discarded last speech'
 assert all(t=='ended' for t in tracks)
 page.get_by_role('button',name='녹음 시작',exact=True).click();expect(page.get_by_role('button',name='녹음 일시 정지',exact=True)).to_be_visible(timeout=20000)
 page.evaluate("window.testSockets.at(-1).close(1000,'validation interruption')")
 expect(page.get_by_role('button',name='녹음 시작',exact=True)).to_be_visible(timeout=15000)
 page.wait_for_timeout(500)
 assert page.evaluate("window.testTracks.every(t=>t.readyState==='ended')")
 data=page.evaluate("JSON.parse(localStorage.getItem('meeting-copilot:v1'))[0]")
 assert len(data['transcript'])>=len(first['transcript'])
 page.get_by_role('button',name='회의 종료 · 초안 만들기',exact=True).click();expect(page.get_by_label('회의록 편집')).to_be_visible(timeout=30000)
 print(json.dumps({'stage':'PASS','pause_resume':True,'interruption_cleanup':True,'transcript_preserved':True,'finish':True}),flush=True)
 b.close()
