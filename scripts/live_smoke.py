"""Opt-in synthetic hosted smoke test. Pass an explicitly authorized demo base URL."""
import sys,json,urllib.request,http.cookiejar
base=sys.argv[1].rstrip('/')
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def call(path,body=None):
    req=urllib.request.Request(base+'/api'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'})
    with client.open(req,timeout=60) as r:
        raw=r.read();return json.loads(raw) if 'application/json' in r.headers.get('Content-Type','') else raw
print('Health:',call('/health'))
u=call('/auth/login',{'email':'super_admin@medifed.demo','password':'MediFed-Demo-2026!'})['user'];print('Authenticated:',u['role'])
assert len(call('/hospitals'))==5
r=call('/federated/rounds/start',{});assert r['status']=='completed';print('FedAvg:',r['version'],'accuracy=',r['metrics']['accuracy'])
e=call('/agents/workflow/start',{});assert e['status']=='completed' and len(e['steps'])==8;print('LangGraph:',len(e['steps']),'agents completed')
c=call('/research/predict',{'age':57,'gender_category':0,'blood_pressure_systolic':142,'blood_pressure_diastolic':86,'glucose_level':145,'cholesterol_level':220,'bmi':29,'heart_rate':78,'medical_history_flag':1});assert len(c['contributions'])==9
review=call('/research/reviews',{'case_id':c['id'],'decision':'approved','comments':'Hosted smoke test: reviewed synthetic artifact and experimental limitations.'});assert review['review_status']=='approved';print('Research artifact review:',review['review_status'])
assert call('/reports/federated?format=pdf').startswith(b'%PDF')
assert b'accuracy' in call('/reports/federated');print('PDF and CSV exports: passed')
print('Overview:',{k:v for k,v in call('/dashboard/overview').items() if k in ['hospitals','completed_rounds','accuracy']})
call('/auth/logout',{});print('Hosted end-to-end smoke: PASSED')
