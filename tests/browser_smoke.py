from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1360, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:3100/')
    page.get_by_label('전사 방식').select_option('gemini')
    page.get_by_role('textbox', name='회의 제목', exact=True).fill('출시 범위 검토')
    page.get_by_role('textbox', name='오늘 결정할 일', exact=True).fill('담당자와 기한 결정')
    page.get_by_role('tab',name='내 메모',exact=True).click()
    page.get_by_role('textbox', name='내 메모', exact=True).fill('사용자 원문은 그대로 보존')
    page.get_by_role('tab',name='실시간 전사',exact=True).click()
    page.get_by_label('수동 발언', exact=True).fill('다음 주까지 출시합시다. 담당자는 아직 정하지 않았습니다.')
    page.get_by_role('button', name='발언 추가', exact=True).click()
    expect(page.get_by_role('log',name='화자별 대화')).to_contain_text('다음 주까지 출시합시다')
    page.get_by_role('button', name='요약 · 코칭 요청', exact=True).click()
    expect(page.locator('.coach-error')).to_contain_text('Supabase')
    expect(page.get_by_role('textbox', name='내 메모', exact=True)).to_have_value('사용자 원문은 그대로 보존')
    page.get_by_role('button', name='회의 종료 · 초안 만들기', exact=True).click()
    expect(page.get_by_label('회의록 편집')).to_contain_text('사용자 원문은 그대로 보존')
    page.get_by_label('회의록 편집').fill('# 검토 완료\n담당자는 미정입니다.')
    page.get_by_role('button', name='검토 완료로 표시').click()
    page.wait_for_timeout(600)
    page.reload()
    page.get_by_role('link', name='내 기록', exact=True).click()
    page.get_by_role('button').filter(has_text='출시 범위 검토').click()
    expect(page.get_by_label('회의록 편집')).to_have_value('# 검토 완료\n담당자는 미정입니다.')
    expect(page.get_by_role('heading', name='회의록 · 검토 완료')).to_be_visible()
    with page.expect_download() as download:
        page.get_by_role('button', name='Markdown 내보내기').click()
    assert download.value.suggested_filename.endswith('.md')
    page.get_by_role('button', name='새 회의', exact=True).click()
    page.get_by_label('수동 발언', exact=True).fill('금요일에 마감하죠')
    page.get_by_role('button', name='발언 추가', exact=True).click()
    page.screenshot(path='/tmp/meeting-workspace.png', full_page=True)
    page.set_viewport_size({'width':390, 'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'mobile overflow'
    assert not errors, errors
    # API should refuse provider use without auth configuration; raw key endpoints are retired.
    assert page.request.post('http://127.0.0.1:3100/api/coach/analyze', data={}).status == 503
    assert page.request.get('http://127.0.0.1:3100/api/gemini-live/token').status == 405
    assert page.request.get('http://127.0.0.1:3100/api/deepgram/token').status == 410
    assert page.request.get('http://127.0.0.1:3100/history').status == 200
    print('PASS: notes, transcript, missing-config error, finish, edit, confirm, reload, history, export, mobile layout, API guards; no browser errors')
    browser.close()
