# PeerJS sunucu protokolünün küçük bir taklidi (yalnızca test için): ws://127.0.0.1:PORT/peerjs?key=..&id=..&token=..
import asyncio, base64, hashlib, json, sys, struct
from urllib.parse import urlparse, parse_qs
PEERS = {}
GUID = b'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
async def send(w, obj):
    data = json.dumps(obj).encode(); n = len(data)
    hdr = bytes([0x81]) + (bytes([n]) if n < 126 else (bytes([126]) + struct.pack('>H', n) if n < 65536 else bytes([127]) + struct.pack('>Q', n)))
    try: w.write(hdr + data); await w.drain()
    except Exception: pass
async def recv(r):
    h = await r.readexactly(2); op = h[0] & 0x0f; n = h[1] & 0x7f
    if n == 126: n = struct.unpack('>H', await r.readexactly(2))[0]
    elif n == 127: n = struct.unpack('>Q', await r.readexactly(8))[0]
    mask = await r.readexactly(4) if h[1] & 0x80 else b'\0\0\0\0'
    d = bytearray(await r.readexactly(n))
    for i in range(n): d[i] ^= mask[i % 4]
    return op, bytes(d)
async def handle(r, w):
    req = (await r.readuntil(b'\r\n\r\n')).decode(errors='ignore')
    line = req.split('\r\n')[0]; path = line.split(' ')[1]
    hd = {k.strip().lower(): v.strip() for k, v in (l.split(':', 1) for l in req.split('\r\n')[1:] if ':' in l)}
    if 'sec-websocket-key' not in hd:
        w.write(b'HTTP/1.1 200 OK\r\nContent-Length: 2\r\nAccess-Control-Allow-Origin: *\r\n\r\nok'); await w.drain(); w.close(); return
    acc = base64.b64encode(hashlib.sha1(hd['sec-websocket-key'].encode() + GUID).digest()).decode()
    w.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n').encode()); await w.drain()
    q = parse_qs(urlparse(path).query); pid = (q.get('id') or [''])[0]
    if pid in PEERS: await send(w, {'type': 'ID-TAKEN', 'payload': {'msg': 'ID is taken'}}); w.close(); return
    PEERS[pid] = w; await send(w, {'type': 'OPEN'})
    try:
        while True:
            op, data = await recv(r)
            if op == 8: break
            if op == 9: continue
            try: m = json.loads(data)
            except Exception: continue
            t = m.get('type'); dst = m.get('dst')
            if t == 'HEARTBEAT' or not dst: continue
            if dst in PEERS: await send(PEERS[dst], {'type': t, 'src': pid, 'dst': dst, 'payload': m.get('payload')})
            elif t in ('OFFER',): await send(w, {'type': 'EXPIRE', 'src': dst, 'dst': pid})
    except Exception: pass
    finally:
        if PEERS.get(pid) is w: del PEERS[pid]
        try: w.close()
        except Exception: pass
async def main(port):
    srv = await asyncio.start_server(handle, '127.0.0.1', port)
    async with srv: await srv.serve_forever()
asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else 9300))
