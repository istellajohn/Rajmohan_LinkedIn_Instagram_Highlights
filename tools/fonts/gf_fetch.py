import subprocess, re, sys, os, urllib.parse
L = sys.argv[1]
fams = [l.strip() for l in open(f"{L}/gf-families.txt") if l.strip()]
UA = "Wget/1.21"  # an old-style client gets truetype URLs
def get(url):
    r = subprocess.run(["curl", "-sS", "-A", UA, "-w", "\n%{http_code}", url], capture_output=True, text=True)
    body, _, code = r.stdout.rpartition("\n")
    return code, body
ok, bad = 0, []
for fam in fams:
    q = urllib.parse.quote_plus(fam)
    css = None
    for spec in [":ital,wght@0,100..900;1,100..900", ":wght@100..900", ":ital,wght@0,400;0,700;1,400;1,700", ":ital@0;1", ""]:
        code, body = get(f"https://fonts.googleapis.com/css2?family={q}{spec}")
        if code == "200" and "src:" in body:
            css = body; break
    if not css:
        bad.append(fam); continue
    d = f"{L}/google/{fam.replace(' ', '_')}"
    os.makedirs(d, exist_ok=True)
    blocks = re.findall(r"font-style:\s*(\w+);\s*font-weight:\s*([\d ]+);.*?src:\s*url\((.*?)\)", css, re.S)
    seen = set()
    for style, weight, url in blocks:
        if url in seen: continue
        seen.add(url)
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".ttf"
        fn = f"{d}/{fam.replace(' ', '')}-{style}-{weight.replace(' ', '_')}{ext}"
        subprocess.run(["curl", "-sS", "-o", fn, url])
    ok += 1
print("ok", ok, "bad", bad)
