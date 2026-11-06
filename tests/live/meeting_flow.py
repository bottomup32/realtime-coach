# Calls real services; see docs/live-validation.md before running.
import os,json,time,re
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture=/tmp/meeting-validation-padded.wav%noloop']
 proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=args,proxy={'server':proxy,'bypass':'127.0.0.1,localhost'} if proxy else None)
 context=browser.new_context(permissions=['microphone'],viewport={'width':1300,'height':900})
 page=context.new_page(); metrics={'ws_open':False,'ws_sent':0,'ws_received':0,'api_statuses':[]}; errors=[]
 def socket(ws):
  metrics['ws_open']=True
  ws.on('framesent',lambda payload:metrics.update(ws_sent=metrics['ws_sent']+1))
  ws.on('framereceived',lambda payload:metrics.update(ws_received=metrics['ws_received']+1))
 page.on('websocket',socket)
 page.on('response',lambda r: metrics['api_statuses'].append({'path':r.url.split('?')[0].split(':3101')[-1],'status':r.status}) if '/api/' in r.url else None)
 page.on('pageerror',lambda e:errors.append(type(e).__name__))
 page.goto('http://127.0.0.1:3101/')
 page.get_by_role('textbox',name='회의 제목',exact=True).fill('실음성 검증 회의')
 page.get_by_role('textbox',name='오늘 결정할 일',exact=True).fill('출시 일정과 담당자 확인')
 page.get_by_role('tab',name='내 메모',exact=True).click()
 page.get_by_role('textbox',name='내 메모',exact=True).fill('원본 메모 보존 확인')
 page.get_by_role('tab',name='실시간 전사',exact=True).click()
 started=time.monotonic()
 page.get_by_role('button',name='녹음 시작',exact=True).click()
 try:
  expect(page.get_by_role('button',name='녹음 일시 정지',exact=True)).to_be_visible(timeout=25000)
  print(json.dumps({'stage':'recording-connected','elapsed':round(time.monotonic()-started,2)}),flush=True)
  page.wait_for_function("""() => {const raw=localStorage.getItem('meeting-copilot:v1');return raw && JSON.parse(raw).some(m=>m.transcript.length>0)}""",timeout=45000)
  print(json.dumps({'stage':'transcript-received','elapsed':round(time.monotonic()-started,2)}),flush=True)
  page.wait_for_function("""() => JSON.parse(localStorage.getItem('meeting-copilot:v1')||'[]').some(m=>m.summary.length>0)""",timeout=25000)
  page.wait_for_timeout(10000)
  page.get_by_role('button',name='회의 종료 · 초안 만들기',exact=True).click()
  expect(page.get_by_label('회의록 편집')).to_be_visible(timeout=30000)
  page.wait_for_timeout(600)
  data=page.evaluate("JSON.parse(localStorage.getItem('meeting-copilot:v1'))[0]")
  transcript=' '.join(t['text'] for t in data['transcript'])
  assert '출시' in transcript or '금요일' in transcript, 'expected Korean speech not transcribed'
  assert data['summary'] and data['endedAt'] and data['report']
  assert data['cards'], 'Expected a coaching card for the missing owner'
  valid_ids={t['id'] for t in data['transcript']}
  assert all(set(card['evidenceIds']) <= valid_ids for card in data['cards'])
  assert data['notes']=='원본 메모 보존 확인'
  page.reload();page.get_by_role('link',name='내 기록',exact=True).click()
  page.get_by_role('button').filter(has_text='실음성 검증 회의').click()
  expect(page.get_by_label('회의록 편집')).to_have_value(data['report'])
  with page.expect_download():page.get_by_role('button',name='내보내기').click()
  print(json.dumps({'stage':'PASS','transcript_segments':len(data['transcript']),'korean_speech_matched':True,'summary':bool(data['summary']),'cards':len(data['cards']),'saved_and_reopened':True,'export':True,'elapsed':round(time.monotonic()-started,2),'metrics':metrics,'page_errors':errors}),flush=True)
 except Exception as e:
  alert=page.locator('.coach-error').all_text_contents()
  print(json.dumps({'stage':'FAIL','error_type':type(e).__name__,'alert':alert,'metrics':metrics,'page_errors':errors},ensure_ascii=False),flush=True)
  page.screenshot(path='/tmp/live-validation-failure.png')
  raise
 finally:browser.close()
