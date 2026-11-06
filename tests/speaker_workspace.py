import os,json
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 proxy=os.getenv('HTTPS_PROXY') or os.getenv('HTTP_PROXY')
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy={'server':proxy,'bypass':'127.0.0.1,localhost'} if proxy else None)
 page=b.new_page(viewport={'width':1360,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(type(e).__name__))
 page.goto('http://127.0.0.1:3103/')
 expect(page.get_by_role('button',name='녹음 시작',exact=True)).to_be_in_viewport()
 page.get_by_role('textbox',name='회의 제목',exact=True).fill('[검증용] 출시 범위 의사결정 회의')
 page.get_by_role('textbox',name='오늘 결정할 일',exact=True).fill('출시 범위를 합의하고 내 주장에 근거를 보완한다')
 page.get_by_label('수동 발언 화자').select_option('manual-a')
 page.get_by_role('textbox',name='수동 발언',exact=True).fill('현재 결함 12건이 남아 있습니다. 다음 주 배포가 가능한지 판단해야 합니다.')
 page.get_by_role('button',name='발언 추가',exact=True).click()
 page.get_by_label('수동 발언 화자').select_option('manual-b')
 page.get_by_role('textbox',name='수동 발언',exact=True).fill('근거 자료는 없지만 무조건 다음 주까지 전부 해결할 수 있습니다. 일정은 100퍼센트 보장합니다. 예산 이야기로 넘어가죠.')
 page.get_by_role('button',name='발언 추가',exact=True).click()
 page.get_by_label('내 화자',exact=True).select_option('manual-b')
 page.get_by_role('button',name='요약 · 코칭 요청',exact=True).click()
 page.wait_for_function("JSON.parse(localStorage.getItem('meeting-copilot:v1')||'[]').some(m=>m.summary.length>0)",timeout=30000)
 data=page.evaluate("JSON.parse(localStorage.getItem('meeting-copilot:v1'))[0]")
 own={t['id'] for t in data['transcript'] if t.get('speakerId')=='manual-b'}
 personal=[c for c in data['cards'] if c['type']=='COACH']
 assert personal,'No personal coaching for the selected speaker'
 assert all(c.get('targetSpeakerId')=='manual-b' and set(c['evidenceIds'])<=own for c in personal)
 page.screenshot(path='/workspace/speaker-workspace-desktop.png',full_page=True)
 page.get_by_role('tab',name='중간 요약',exact=True).click()
 expect(page.get_by_role('heading',name='요약 타임라인')).to_be_visible()
 assert data.get('summaryHistory')
 page.get_by_role('tab',name='내 메모',exact=True).click()
 page.get_by_role('textbox',name='내 메모',exact=True).fill('원본 메모는 보존합니다')
 page.wait_for_timeout(500);page.reload()
 page.get_by_role('tab',name='내 메모',exact=True).click();expect(page.get_by_role('textbox',name='내 메모',exact=True)).to_have_value('원본 메모는 보존합니다')
 page.get_by_role('tab',name='실시간 전사',exact=True).click()
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'Mobile overflow'
 page.get_by_role('tab',name='도움 ',exact=False).click();expect(page.get_by_role('tab',name='내 코칭',exact=True)).to_be_visible()
 page.screenshot(path='/workspace/speaker-workspace-mobile.png',full_page=True)
 assert not errors,errors
 print(json.dumps({'result':'PASS','personal_cards':len(personal),'self_target_enforced':True,'history':True,'notes_reload':True,'mobile':True,'browser_errors':errors}))
 b.close()
