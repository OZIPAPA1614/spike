# Firebase Auth + Realtime Database REST taklidi (yalnızca test): CORS, kurallar (sahibi yazar, inbox/<gönderen>), sunucu zamanı
import json, sys, time, random, string, re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
USERS = {}; TOK = {}; REF = {}; DB = {}
def rid(n): return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(n))
def sv(v):
    if isinstance(v, dict):
        if v.get('.sv') == 'timestamp': return int(time.time() * 1000)
        return {k: sv(x) for k, x in v.items()}
    return v
def get(path):
    n = DB
    for k in path:
        if not isinstance(n, dict) or k not in n: return None
        n = n[k]
    return n
def put(path, val):
    if not path: return
    n = DB
    for k in path[:-1]: n = n.setdefault(k, {}) if isinstance(n.get(k), dict) else n.__setitem__(k, {}) or n[k]
    if val is None: n.pop(path[-1], None)
    else: n[path[-1]] = val
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS'); self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    def out(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.cors(); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_OPTIONS(self): self.send_response(204); self.cors(); self.end_headers()
    def body(self):
        n = int(self.headers.get('Content-Length') or 0); return self.rfile.read(n).decode() if n else ''
    def err(self, m): self.out(400, {'error': {'code': 400, 'message': m}})
    def do_POST(self):
        u = urlparse(self.path); b = self.body()
        if u.path.endswith('accounts:signUp'):
            j = json.loads(b); e = j['email'].lower(); p = j['password']
            if len(p) < 6: return self.err('WEAK_PASSWORD : Password should be at least 6 characters')
            if e in USERS: return self.err('EMAIL_EXISTS')
            uid = rid(28); USERS[e] = (uid, p); t = 'tk' + rid(20); r = 'rf' + rid(20); TOK[t] = uid; REF[r] = uid
            return self.out(200, {'localId': uid, 'idToken': t, 'refreshToken': r, 'expiresIn': '3600', 'email': e})
        if u.path.endswith('accounts:signInWithPassword'):
            j = json.loads(b); e = j['email'].lower()
            if e not in USERS or USERS[e][1] != j['password']: return self.err('INVALID_LOGIN_CREDENTIALS')
            uid = USERS[e][0]; t = 'tk' + rid(20); r = 'rf' + rid(20); TOK[t] = uid; REF[r] = uid
            return self.out(200, {'localId': uid, 'idToken': t, 'refreshToken': r, 'expiresIn': '3600'})
        if u.path.endswith('/token'):
            q = parse_qs(b); r = q.get('refresh_token', [''])[0]
            if r not in REF: return self.err('INVALID_REFRESH_TOKEN')
            uid = REF[r]; t = 'tk' + rid(20); TOK[t] = uid
            return self.out(200, {'id_token': t, 'refresh_token': r, 'user_id': uid, 'expires_in': '3600'})
        self.out(404, {})
    def dbreq(self, method):
        u = urlparse(self.path); q = parse_qs(u.query); auth = TOK.get(q.get('auth', [''])[0])
        path = [p for p in u.path[len('/db/'):-len('.json')].split('/') if p] if u.path.startswith('/db/') else None
        if path is None: return self.out(404, {})
        if path and path[0] in ('pub', 'clk'):  # gerçek kurallarla aynı: açık oda listesi herkese açık
            if method == 'GET':
                return self.out(200, get(path)) if path[0] == 'pub' else self.out(401, {'error': 'Permission denied'})
            if path[0] == 'pub' and len(path) != 2: return self.out(401, {'error': 'Permission denied'})
            b = self.body(); v = json.loads(b) if b else None
            if method == 'DELETE': put(path, None); return self.out(200, None)
            if path[0] == 'pub' and not (isinstance(v, dict) and all(k in v for k in ('n', 'p', 'ts')) and v['ts'] == {'.sv': 'timestamp'} and len(path[1]) <= 8): return self.out(401, {'error': 'Permission denied'})
            if path[0] == 'clk' and v != {'.sv': 'timestamp'}: return self.out(401, {'error': 'Permission denied'})
            put(path, sv(v)); return self.out(200, sv(v))
        if not auth: return self.out(401, {'error': 'Permission denied'})
        if method == 'GET': return self.out(200, get(path))
        ok = len(path) >= 2 and path[0] == 'users' and (path[1] == auth or (len(path) >= 4 and path[2] == 'inbox' and path[3] == auth))
        if not ok: return self.out(401, {'error': 'Permission denied'})
        b = self.body(); v = json.loads(b) if b else None
        if method == 'PUT': put(path, sv(v)); return self.out(200, sv(v))
        if method == 'PATCH':
            for k, x in (v or {}).items(): put(path + [k], sv(x))
            return self.out(200, v)
        if method == 'DELETE': put(path, None); return self.out(200, None)
    def do_GET(self):
        if self.path.startswith('/dump'): return self.out(200, {'users': len(USERS), 'db': DB})
        self.dbreq('GET')
    def do_PUT(self): self.dbreq('PUT')
    def do_PATCH(self): self.dbreq('PATCH')
    def do_DELETE(self): self.dbreq('DELETE')
ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
