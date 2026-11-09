// خادم WebDAV وهمي (للاختبار): node tests/webdav_mock.mjs [port]  — المستخدم u وكلمة المرور p
import http from 'node:http';
const files = new Map(), CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,PUT,DELETE,PROPFIND,MKCOL,OPTIONS', 'access-control-allow-headers': 'authorization,depth,content-type', 'access-control-max-age': '0' };
let folder = false;
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.headers.authorization !== 'Basic ' + Buffer.from('u:p').toString('base64')) { res.writeHead(401, CORS); return res.end(); }
  const ch = []; for await (const c of req) ch.push(c); const body = Buffer.concat(ch), path = decodeURIComponent(req.url.split('?')[0]), name = path.split('/').filter(Boolean).pop();
  const isDir = path.replace(/\/+$/, '').endsWith('/AlaisaiPro');
  if (req.method === 'MKCOL') { if (folder) { res.writeHead(405, CORS); return res.end(); } folder = true; res.writeHead(201, CORS); return res.end(); }
  if (req.method === 'PUT') { files.set(name, { body, type: req.headers['content-type'] || '', t: new Date() }); res.writeHead(201, CORS); return res.end(); }
  if (req.method === 'GET') { const f = files.get(name); if (!f) { res.writeHead(404, CORS); return res.end(); } res.writeHead(200, { ...CORS, 'content-type': f.type }); return res.end(f.body); }
  if (req.method === 'DELETE') { files.delete(name); res.writeHead(204, CORS); return res.end(); }
  if (req.method === 'PROPFIND') {
    const depth = req.headers.depth; let x = '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">';
    if (depth === '0') x += '<d:response><d:href>' + path + '</d:href><d:propstat><d:prop><d:quota-available-bytes>1000000</d:quota-available-bytes><d:quota-used-bytes>500</d:quota-used-bytes></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>';
    else { x += '<d:response><d:href>/dav/AlaisaiPro/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>'; for (const [n, f] of files) x += `<d:response><d:href>/dav/AlaisaiPro/${encodeURIComponent(n)}</d:href><d:propstat><d:prop><d:getcontentlength>${f.body.length}</d:getcontentlength><d:getlastmodified>${f.t.toUTCString()}</d:getlastmodified><d:getcontenttype>${f.type}</d:getcontenttype><d:resourcetype/></d:prop></d:propstat></d:response>`; }
    res.writeHead(207, { ...CORS, 'content-type': 'application/xml' }); return res.end(x + '</d:multistatus>');
  }
  res.writeHead(405, CORS); res.end();
}).listen(+process.argv[2] || 8789, () => console.log('webdav ready'));
