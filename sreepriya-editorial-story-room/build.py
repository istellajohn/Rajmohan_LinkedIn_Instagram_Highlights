"""Builds the single-file Artifact page (artifact.html) and a standalone browser copy (index.html).
Requires: npm install (esbuild). Run: python3 build.py"""
import json, base64, re, subprocess, sys, os
B = os.path.dirname(os.path.abspath(__file__))
r = subprocess.run([os.path.join(B, 'node_modules/.bin/esbuild'), os.path.join(B, 'src/main.jsx'), '--bundle', '--format=iife', '--target=es2019',
                    '--jsx-factory=React.createElement', '--jsx-fragment=React.Fragment', '--minify', '--legal-comments=none'], capture_output=True, text=True)
if r.returncode: print(r.stderr); sys.exit(1)
js = r.stdout.replace('</script', '<\\/script')
data = json.load(open(os.path.join(B, 'data', 'Sreepriya_Media_Data.json')))
djson = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
def uri(p, mime='image/png'): return f'data:{mime};base64,' + base64.b64encode(open(os.path.join(B, p), 'rb').read()).decode()
assets = json.dumps({k: uri(f'assets/{k}.png') for k in ('mark', 'lockup', 'wordmark')})
fonts = re.sub(r'url\(([^)]+\.woff2)\)', lambda m: 'url(' + uri('fonts/' + m.group(1), 'font/woff2') + ')', open(os.path.join(B, 'fonts', 'fonts.css')).read())
css = open(os.path.join(B, 'src', 'style.css')).read()
body = f'''<title>Sreepriya N S | The Editorial Story Room</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
{fonts}
</style>
<style>
{css}
</style>
<div id="root"></div>
<script type="application/json" id="sns-data">{djson}</script>
<script>window.__SNS_ASSETS__={assets};</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>{js}</script>
'''
open(os.path.join(B, 'artifact.html'), 'w').write(body)
open(os.path.join(B, 'index.html'), 'w').write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + body + '</body></html>')
print('built artifact.html and index.html')
