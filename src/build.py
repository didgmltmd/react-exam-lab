import pathlib, json, base64
H = pathlib.Path(__file__).resolve().parent
S = H.parent
page = (H / 'page.html').read_text(encoding='utf-8')
css = (H / 'style.css').read_text(encoding='utf-8')
written = json.loads((S / 'react' / 'written.json').read_text(encoding='utf-8'))
# 서술형·코드 작성 문제: react/essay.json (없으면 견본 tmp_essay.json)
ep = S / 'react' / 'essay.json'
if not ep.exists(): ep = H / 'tmp_essay.json'
essay = json.loads(ep.read_text(encoding='utf-8'))
for q in essay:
    assert q['kind'] in ('essay', 'code'), q['id']
    assert sum(r['pts'] for r in q['rubric']) == q['points'], ('rubric pts', q['id'])
    assert all(r['keys'] and all(k.strip() for k in r['keys']) for r in q['rubric']), ('keys', q['id'])
print('written', len(written), '/ essay', ep.name, len(essay))
# 러닝메이트 마스코트(커너비)와 학교 심벌 — 페이지 안에 데이터로 넣음
uri = lambda f, t: f'data:{t};base64,' + base64.b64encode((H / f).read_bytes()).decode()
img = {'mascot': uri('brand_mascot.webp', 'image/webp'), 'logo': uri('brand_logo.png', 'image/png')}
data = 'window.RL = window.RL || {}; window.RL.DATA = ' + json.dumps({'written': written, 'essay': essay, 'img': img}, ensure_ascii=False).replace('</', '<' + chr(92) + '/') + ';'
js = '\n'.join((H / f).read_text(encoding='utf-8') for f in ['util.js', 'cbt.js']).replace('</script', '<' + chr(92) + '/script')
out = page.replace('/*STYLE*/', css).replace('/*DATA*/', data).replace('/*SCRIPTS*/', js + '\nwindow.RL.boot();')
(H / 'react_lab.html').write_text(out, encoding='utf-8')
head, body = out.split('<style>', 1)
full = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' + head + '<style>' + body.split('</style>', 1)[0] + '</style>\n</head>\n<body>\n' + body.split('</style>', 1)[1] + '\n</body>\n</html>\n'
(H / 'index.html').write_text(full, encoding='utf-8')
print('built', len(out))
