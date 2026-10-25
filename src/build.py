import pathlib, json, sys
H = pathlib.Path(__file__).resolve().parent
S = H.parent
page = (H / 'page.html').read_text(encoding='utf-8')
css = (H / 'style.css').read_text(encoding='utf-8') + '\n' + (H / 'monaco_inline.css').read_text(encoding='utf-8')
pp = S / 'react' / 'practical.json'
if not pp.exists() or '--tmp' in sys.argv: pp = H / 'tmp_practical.json'
practical = json.loads(pp.read_text(encoding='utf-8'))
written = json.loads((S / 'react' / 'written.json').read_text(encoding='utf-8'))
data = 'window.RL = window.RL || {}; window.RL.DATA = ' + json.dumps({'practical': practical, 'written': written}, ensure_ascii=False).replace('</', '<' + chr(92) + '/') + ';'
js = '\n'.join((H / f).read_text(encoding='utf-8') for f in ['icons.js', 'core.js', 'cbt.js', 'ide.js']).replace('</script', '<' + chr(92) + '/script')
out = page.replace('/*STYLE*/', css).replace('/*DATA*/', data).replace('/*SCRIPTS*/', js + '\nwindow.RL.boot();')
(H / 'react_lab.html').write_text(out, encoding='utf-8')
head, body = out.split('<style>', 1)
full = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' + head + '<style>' + body.split('</style>', 1)[0] + '</style>\n</head>\n<body>\n' + body.split('</style>', 1)[1] + '\n</body>\n</html>\n'
(H / 'index.html').write_text(full, encoding='utf-8')
print('built', len(out))
