import pathlib, json, sys
H = pathlib.Path(__file__).resolve().parent
S = H.parent
page = (H / 'page.html').read_text(encoding='utf-8')
css = (H / 'style.css').read_text(encoding='utf-8') + '\n' + (H / 'monaco_inline.css').read_text(encoding='utf-8')
pp = S / 'react' / 'practical.json'
if not pp.exists() or '--tmp' in sys.argv: pp = H / 'tmp_practical.json'
practical = json.loads(pp.read_text(encoding='utf-8'))
# 문제지 스크린샷 (정답 코드를 크롬에서 실행해 캡처). practical.json 이 바뀌면 다시 찍음
import hashlib, subprocess
if any(p.get('sheet') for p in practical):
    hsh = hashlib.sha1(pp.read_bytes() + (H / 'core.js').read_bytes()).hexdigest()
    cache = H / 'shots.json'; meta = H / 'shots.hash'
    if not cache.exists() or not meta.exists() or meta.read_text() != hsh or '--shots' in sys.argv:
        subprocess.run(['node', str(H / 'shots.cjs'), str(pp), str(cache)], check=True)
        meta.write_text(hsh)
    shots = json.loads(cache.read_text(encoding='utf-8'))
    for p in practical:
        if p.get('sheet') and p['id'] in shots: p['sheet']['shots'] = shots[p['id']]
written = json.loads((S / 'react' / 'written.json').read_text(encoding='utf-8'))
# 서술형·코드 작성 문제: react/essay.json (없으면 견본 tmp_essay.json)
ep = S / 'react' / 'essay.json'
if not ep.exists(): ep = H / 'tmp_essay.json'
essay = json.loads(ep.read_text(encoding='utf-8'))
for q in essay:
    assert q['kind'] in ('essay', 'code'), q['id']
    assert sum(r['pts'] for r in q['rubric']) == q['points'], ('rubric pts', q['id'])
    assert all(r['keys'] and all(k.strip() for k in r['keys']) for r in q['rubric']), ('keys', q['id'])
print('essay', ep.name, len(essay))
data = 'window.RL = window.RL || {}; window.RL.DATA = ' + json.dumps({'practical': practical, 'written': written, 'essay': essay}, ensure_ascii=False).replace('</', '<' + chr(92) + '/') + ';'
js = '\n'.join((H / f).read_text(encoding='utf-8') for f in ['icons.js', 'core.js', 'cbt.js', 'ide.js']).replace('</script', '<' + chr(92) + '/script')
out = page.replace('/*STYLE*/', css).replace('/*DATA*/', data).replace('/*SCRIPTS*/', js + '\nwindow.RL.boot();')
(H / 'react_lab.html').write_text(out, encoding='utf-8')
head, body = out.split('<style>', 1)
full = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' + head + '<style>' + body.split('</style>', 1)[0] + '</style>\n</head>\n<body>\n' + body.split('</style>', 1)[1] + '\n</body>\n</html>\n'
(H / 'index.html').write_text(full, encoding='utf-8')
print('built', len(out))
