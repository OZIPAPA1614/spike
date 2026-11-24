import glob, os, sys
src = sys.argv[1] if len(sys.argv)>1 else '/home/claude/src'
parts = sorted(glob.glob(os.path.join(src, '0*.js')))
js = '\n'.join(open(p, encoding='utf-8').read() for p in parts)
tpl = open(os.path.join(src, 'template.html'), encoding='utf-8').read()
out = tpl.replace('//__JS__', js)
open(sys.argv[2] if len(sys.argv)>2 else '/home/claude/out/nova.html', 'w', encoding='utf-8').write(out)
open((sys.argv[2] if len(sys.argv)>2 else '/home/claude/out/nova.html')+'.js', 'w', encoding='utf-8').write(js)
print('ok', len(out), 'bytes', out.count('\n'), 'lines')
