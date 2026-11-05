# Requires a desktop display (DISPLAY on Linux); uses real tab capture and a synthetic silent microphone.
import os,json
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--auto-select-desktop-capture-source=Validation meeting source','--enable-usermedia-screen-capturing','--allow-http-screen-capture','--autoplay-policy=no-user-gesture-required'],proxy={'server':proxy,'bypass':'127.0.0.1,localhost'})
 c=b.new_context(permissions=['microphone'])
 c.route('**/validation-audio.wav',lambda route:route.fulfill(path='/tmp/meeting-validation-padded.wav',content_type='audio/wav'))
 c.route('**/validation-meeting-source',lambda route:route.fulfill(content_type='text/html',body='<title>Validation meeting source</title><audio autoplay loop src="http://127.0.0.1:3101/validation-audio.wav"></audio>'))
 source=c.new_page();source.goto('http://127.0.0.1:3101/validation-meeting-source')
 page=c.new_page()
 page.add_init_script('window.captureInfo={};navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext();window.silentMicContext=ac;const dest=ac.createMediaStreamDestination();const osc=ac.createOscillator();const gain=ac.createGain();gain.gain.value=0;osc.connect(gain).connect(dest);osc.start();await ac.resume();return dest.stream;};const original=navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getDisplayMedia=async(...args)=>{const s=await original(...args);window.captureInfo={audio:s.getAudioTracks().map(t=>({label:t.label,settings:t.getSettings()})),video:s.getVideoTracks().map(t=>({label:t.label,settings:t.getSettings()}))};return s;};')
 page.goto('http://127.0.0.1:3101/')
 page.get_by_role('checkbox',name='탭 오디오 함께 수집').check()
 page.get_by_role('button',name='녹음 시작',exact=True).click()
 try:
  expect(page.get_by_role('button',name='녹음 일시 정지',exact=True)).to_be_visible(timeout=20000)
  print(json.dumps({'capture':page.evaluate('window.captureInfo'),'sourceAudio':source.locator('audio').evaluate('(a)=>({paused:a.paused,currentTime:a.currentTime,readyState:a.readyState})')}),flush=True)
  page.wait_for_function("JSON.parse(localStorage.getItem('meeting-copilot:v1')||'[]').some(m=>m.transcript.length>0)",timeout=45000)
  data=page.evaluate("JSON.parse(localStorage.getItem('meeting-copilot:v1'))[0]")
  text=' '.join(t['text'] for t in data['transcript'])
  assert '출시' in text or '금요일' in text
  source.close();expect(page.get_by_role('button',name='녹음 시작',exact=True)).to_be_visible(timeout=10000)
  page.get_by_role('button',name='회의 종료 · 초안 만들기',exact=True).click();expect(page.get_by_label('회의록 편집')).to_be_visible(timeout=30000)
  print(json.dumps({'stage':'PASS','actual_tab_capture':True,'silent_microphone':True,'remote_audio_transcribed':True,'sharing_end_handled':True}))
 except Exception as e:
  print(json.dumps({'stage':'FAIL','error_type':type(e).__name__,'alert':page.locator('.meeting-error').all_text_contents()},ensure_ascii=False),flush=True)
  raise
 finally:b.close()
