"""Refresh a published design-canvas bundle from its sources on disk.

    python3 design/mochi/repack.py <bundle.html> <source-dir> [--canvas] [--check]

The bundle's editable state is the JSON in `<script id="appifact-doc">`: one
.dc.html per artboard plus canvas.json. Every bundled .dc.html is replaced by
the file of the same name in <source-dir>, and any artboard canvas.json on disk
lists but the bundle lacks is added. With `--canvas` the bundled canvas.json
also takes the disk version's pages and artboards (its own annotations and
launch stay) — off by default, because the two have drifted apart before. The JSON
is written back in the bundle's own encoding (compact, `<` as \\u003c) so an
untouched bundle round-trips byte for byte — `--check` verifies that.
"""
import json
import re
import sys
from pathlib import Path

DOC = re.compile(r'(<script[^>]*id="appifact-doc"[^>]*>)(\s*)(.*?)(\s*</script>)', re.S)


def encode(d):
    return json.dumps(d, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')


def main(bundle, src, check=False, sync_canvas=False):
    text = Path(bundle).read_text()
    m = DOC.search(text)
    doc = json.loads(m.group(3))
    if encode(doc) != m.group(3):
        sys.exit(f'{bundle}: bundle JSON does not round-trip; refusing to rewrite it')
    if check:
        print(f'{bundle}: round-trips')
        return
    files = doc['content']['files']
    disk_canvas = json.loads((Path(src) / 'canvas.json').read_text())
    wanted = [a['file'] for a in disk_canvas['artboards']]
    changed = []
    for name in list(files) + [w for w in wanted if w not in files]:
        if not name.endswith('.dc.html'):
            continue
        p = Path(src) / name
        if p.exists() and files.get(name) != p.read_text():
            files[name] = p.read_text()
            changed.append(name)
    if sync_canvas:
        canvas = json.loads(files['canvas.json'])
        for key in ('pages', 'artboards'):
            if key in disk_canvas and canvas.get(key) != disk_canvas[key]:
                canvas[key] = disk_canvas[key]
                changed.append(f'canvas.json:{key}')
        files['canvas.json'] = json.dumps(canvas, indent=2, ensure_ascii=False)
    out = text[:m.start(3)] + encode(doc) + text[m.end(3):]
    Path(bundle).write_text(out)
    print(f'{bundle}: {", ".join(changed) or "nothing to change"}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], '--check' in sys.argv, '--canvas' in sys.argv)
