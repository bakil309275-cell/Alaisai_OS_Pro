import json, hashlib, base64, re, urllib.parse
TOKEN='github_pat_testtoken1234567890abcdef'

class GH:
    def __init__(s): s.files={}; s.log=[]; s.blobs={}; s.trees={}; s.commits={}; s.head='c0'
    def sha(s,c): return hashlib.sha1(b'blob %d\0'%len(c)+c).hexdigest()  # بصمة Git blob الحقيقية
    def tid(s,files): return 't'+hashlib.sha1(json.dumps(sorted((k,s.sha(v)) for k,v in files.items())).encode()).hexdigest()[:12]
    def handle(s, route):
        req=route.request; url=req.url.split('api.github.com')[1]; path,_,q=url.partition('?')
        cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,accept,content-type,x-github-api-version','access-control-allow-methods':'GET,PUT,POST,PATCH,DELETE,OPTIONS','content-type':'application/json'}
        if req.method=='OPTIONS': return route.fulfill(status=204,headers=cors)
        if req.headers.get('authorization')!='Bearer '+TOKEN: return route.fulfill(status=401,headers=cors,body='{}')
        s.log.append((req.method,path))
        m=re.match(r'/repos/me/vault$',path)
        if m: return route.fulfill(status=200,headers=cors,body=json.dumps({'full_name':'me/vault','private':True,'permissions':{'push':True}}))
        if path=='/repos/me/vault/branches/main': return route.fulfill(status=200,headers=cors,body='{}')
        if path=='/repos/me/vault/git/ref/heads/main' and req.method=='GET': return route.fulfill(status=200,headers=cors,body=json.dumps({'object':{'sha':s.head}}))
        m=re.match(r'/repos/me/vault/git/commits/(\w+)$',path)
        if m and req.method=='GET': return route.fulfill(status=200,headers=cors,body=json.dumps({'tree':{'sha':s.commits.get(m.group(1)) or s.tid(s.files)}}))
        m=re.match(r'/repos/me/vault/git/blobs/(\w+)$',path)
        if m and req.method=='GET':
            c=s.blobs.get(m.group(1)) or next((v for v in s.files.values() if s.sha(v)==m.group(1)),None)
            if c is None: return route.fulfill(status=404,headers=cors,body='{}')
            return route.fulfill(status=200,headers=cors,body=json.dumps({'encoding':'base64','content':base64.b64encode(c).decode()}))
        if path=='/repos/me/vault/git/blobs' and req.method=='POST':
            c=base64.b64decode(json.loads(req.post_data)['content']); h=s.sha(c); s.blobs[h]=c; return route.fulfill(status=201,headers=cors,body=json.dumps({'sha':h}))
        if path=='/repos/me/vault/git/trees' and req.method=='POST':
            nf=dict(s.files)
            for e in json.loads(req.post_data)['tree']:
                if e['sha'] is None: nf.pop(e['path'],None)
                else: nf[e['path']]=s.blobs[e['sha']]
            tid=s.tid(nf); s.trees[tid]=nf; return route.fulfill(status=201,headers=cors,body=json.dumps({'sha':tid}))
        if path=='/repos/me/vault/git/commits' and req.method=='POST':
            cid='c%d'%(len(s.commits)+1); s.commits[cid]=json.loads(req.post_data)['tree']; return route.fulfill(status=201,headers=cors,body=json.dumps({'sha':cid}))
        if path=='/repos/me/vault/git/refs/heads/main' and req.method=='PATCH':
            sha=json.loads(req.post_data)['sha']; s.files=s.trees[s.commits[sha]]; s.head=sha; return route.fulfill(status=200,headers=cors,body='{}')
        if path.startswith('/repos/me/vault/git/trees/'):
            return route.fulfill(status=200,headers=cors,body=json.dumps({'truncated':False,'tree':[{'path':k,'type':'blob','sha':s.sha(v)} for k,v in s.files.items()]}))
        m=re.match(r'/repos/me/vault/contents/(.+)$',path)
        if m:
            f=urllib.parse.unquote(m.group(1))
            if req.method=='DELETE':
                b=json.loads(req.post_data)
                if f not in s.files or b.get('sha')!=s.sha(s.files[f]): return route.fulfill(status=409,headers=cors,body='{}')
                del s.files[f]; return route.fulfill(status=200,headers=cors,body='{}')
            if req.method=='GET':
                if f not in s.files: return route.fulfill(status=404,headers=cors,body='{}')
                if 'raw' in req.headers.get('accept',''): return route.fulfill(status=200,headers={**cors,'content-type':'text/plain; charset=utf-8'},body=s.files[f])
                c=s.files[f]; return route.fulfill(status=200,headers=cors,body=json.dumps({'type':'file','sha':s.sha(c),'encoding':'base64','content':base64.encodebytes(c).decode()}))
            if req.method=='PUT':
                b=json.loads(req.post_data); c=base64.b64decode(b['content'])
                if f in s.files and b.get('sha')!=s.sha(s.files[f]): return route.fulfill(status=409,headers=cors,body='{"message":"sha mismatch"}')
                if f not in s.files and b.get('sha'): return route.fulfill(status=422,headers=cors,body='{}')
                s.files[f]=c; return route.fulfill(status=200,headers=cors,body=json.dumps({'content':{'sha':s.sha(c)}}))
        route.fulfill(status=404,headers=cors,body='{}')
