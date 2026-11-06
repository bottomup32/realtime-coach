# Calls real services; see docs/live-validation.md before running.
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-fake-device-for-media-stream','--deny-permission-prompts'])
 page=b.new_page();calls=[]
 page.on('request',lambda r:calls.append(r.url) if '/api/gemini-live/token' in r.url else None)
 page.goto('http://127.0.0.1:3101/')
 page.get_by_label('전사 방식').select_option('gemini')
 page.get_by_role('textbox',name='내 메모',exact=True).fill('권한 거절 후에도 남아야 하는 메모')
 page.get_by_role('button',name='녹음 시작',exact=True).click()
 expect(page.locator('.coach-error')).to_be_visible(timeout=10000)
 expect(page.get_by_role('button',name='녹음 시작',exact=True)).to_be_enabled()
 page.get_by_role('tab',name='내 메모',exact=True).click()
 expect(page.get_by_role('textbox',name='내 메모',exact=True)).to_have_value('권한 거절 후에도 남아야 하는 메모')
 page.get_by_role('tab',name='실시간 전사',exact=True).click()
 assert not calls,'Provider token requested despite microphone denial'
 print('PASS: microphone permission denial preserves notes and returns to usable state; no provider token requested')
 b.close()
