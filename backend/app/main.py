"""MediFed synthetic research API. Logical tenants; educational privacy simulation."""
import os,json,secrets,hashlib,hmac,csv,io,time,threading
from datetime import timedelta
from typing import Literal,TypedDict
import jwt
from fastapi import FastAPI,Depends,HTTPException,UploadFile,File,Form,Response,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse,JSONResponse
from pydantic import BaseModel,Field
from sqlalchemy import select,func
from sqlalchemy.exc import IntegrityError
from langgraph.graph import StateGraph,END
from .db import engine,Session,Hospital,User,Record,Setting,DEMO,uid,now
from .ml import FEATURES,AGENTS,generate,validate,train_federated,train_local,predict

app=FastAPI(title='MediFed AI Research API',version='1.0.0',description='Synthetic research only; in-process federated simulation.')
app.add_middleware(CORSMiddleware,allow_origins=os.getenv('CORS_ORIGINS','http://localhost:3000').split(','),allow_credentials=True,allow_methods=['GET','POST','PUT'],allow_headers=['Content-Type','Authorization'])
lock=threading.RLock()
ROLES=['super_admin','hospital_admin','researcher','clinician','auditor']
def pack(o):
    if isinstance(o,Hospital):return {k:getattr(o,k) for k in ['id','name','location','contact','institution_type','active']}|{'created_at':o.created_at.isoformat()}
    if isinstance(o,User):return {k:getattr(o,k) for k in ['id','email','name','role','hospital_id','active']}
    return {'id':o.id,'hospital_id':o.hospital_id,'created_at':o.created_at.isoformat(),**json.loads(o.payload)}
def add(db,kind,payload,hospital_id=None):
    r=Record(kind=kind,payload=json.dumps(payload,allow_nan=False),hospital_id=hospital_id);db.add(r);db.flush();return r
def audit(db,u,action,detail=''):return add(db,'audit',{'actor':u.email if isinstance(u,User) else str(u),'action':action,'detail':detail},u.hospital_id if isinstance(u,User) else None)
def setting(db,key,default=None):
    r=db.get(Setting,key);return json.loads(r.value) if r else default
def save_setting(db,key,value):
    r=db.get(Setting,key)
    if r:r.value=json.dumps(value)
    else:db.add(Setting(key=key,value=json.dumps(value)))
def password_hash(p):
    salt=secrets.token_hex(16);return salt+':'+hashlib.scrypt(p.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
def password_ok(p,stored):
    salt,digest=stored.split(':');return hmac.compare_digest(hashlib.scrypt(p.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex(),digest)
def seed():
    with lock,Session() as db:
        if not db.get(Setting,'jwt_secret'):save_setting(db,'jwt_secret',secrets.token_urlsafe(48))
        if not db.get(Setting,'privacy'):save_setting(db,'privacy',{'enabled':True,'epsilon':1.,'delta':.00001,'budget_limit':10.,'spent':0.,'clip_norm':1.,'noise_multiplier':1.})
        if DEMO and not db.scalar(select(Hospital.id).limit(1)):
            hs=[]
            for i,(name,city) in enumerate([('Meridian Research Hospital','Hyderabad'),('Northstar Medical Institute','Bengaluru'),('Evergreen University Hospital','Pune'),('Harbor Clinical Research','Chennai'),('Summit Health Sciences','New Delhi')]):
                h=Hospital(name=name,location=city+', India');db.add(h);db.flush();hs.append(h);rows=generate(42+i,240+i*30)
                add(db,'dataset',{'name':f'Synthetic cohort {i+1}','rows':rows,'validation':validate(rows),'preprocessed':False,'synthetic':True},h.id)
            for role in ROLES:db.add(User(email=role+'@medifed.demo',name={'super_admin':'Alex Morgan','hospital_admin':'Jordan Lee','researcher':'Sam Taylor','clinician':'Dr. Avery Chen','auditor':'Casey Patel'}[role],password=password_hash('MediFed-Demo-2026!'),role=role,hospital_id=None if role in ['super_admin','auditor'] else hs[0].id))
            audit(db,'system','Demo initialized','Five synthetic hospitals; no real patient information')
        if not DEMO and not db.scalar(select(User.id).limit(1)):
            email=os.getenv('ADMIN_EMAIL');pw=os.getenv('ADMIN_PASSWORD','')
            if not email or len(pw)<12:raise RuntimeError('Set ADMIN_EMAIL and a 12+ character ADMIN_PASSWORD')
            db.add(User(email=email,name='Administrator',password=password_hash(pw),role='super_admin'))
        db.commit()
seed()
with Session() as _db:SECRET=os.getenv('JWT_SECRET') or setting(_db,'jwt_secret')
if not DEMO and not os.getenv('JWT_SECRET'):raise RuntimeError('JWT_SECRET required outside demo mode')
def database():
    with Session() as db:yield db
def current(request:Request,db=Depends(database)):
    token=request.cookies.get('medifed_session')
    if request.headers.get('Authorization','').startswith('Bearer '):token=request.headers['Authorization'][7:]
    try:
        c=jwt.decode(token or '',SECRET,algorithms=['HS256'],options={'require':['exp','sub','jti']})
        if db.get(Setting,'revoked:'+c['jti']):raise ValueError()
        u=db.get(User,c['sub'])
        if not u or not u.active:raise ValueError()
        return u
    except (jwt.InvalidTokenError,ValueError):raise HTTPException(401,'Sign in to continue')
def require(u,*roles):
    if u.role not in roles:raise HTTPException(403,'Your role cannot perform this action')
def tenant(u,hid):
    if u.role!='super_admin' and (not u.hospital_id or u.hospital_id!=hid):raise HTTPException(403,'Hospital data is isolated from your account')
def records(db,kind,u=None,private=False):
    q=select(Record).where(Record.kind==kind)
    if private and u and u.role!='super_admin':q=q.where(Record.hospital_id==u.hospital_id) if u.hospital_id else q.where(Record.id=='none')
    return db.scalars(q.order_by(Record.created_at.desc())).all()
def find(db,kind,id,u=None,private=False):
    r=db.get(Record,id)
    if not r or r.kind!=kind:raise HTTPException(404,'Resource not found')
    if private:tenant(u,r.hospital_id)
    return r
def limited(request,db,category='login',limit=25):
    key='rate:'+hashlib.sha256(f'{request.client.host if request.client else "unknown"}:{category}:{int(time.time()//60)}'.encode()).hexdigest();count=setting(db,key,0)
    if count>=limit:raise HTTPException(429,'Try again in one minute')
    save_setting(db,key,count+1);db.commit()
class Login(BaseModel):
    email:str=Field(min_length=3,max_length=254)
    password:str=Field(min_length=1,max_length=128)
class Register(Login):name:str=Field(min_length=2,max_length=120)
class HospitalInput(BaseModel):
    name:str=Field(min_length=2,max_length=160)
    location:str=Field(min_length=2,max_length=160)
    contact:str=Field(default='research@example.org',max_length=200)
    institution_type:str=Field(default='Research hospital',max_length=80)
    active:bool=True
class PrivacyInput(BaseModel):
    enabled:bool=True
    epsilon:float=Field(default=1,gt=0,le=5)
    delta:float=Field(default=.00001,gt=0,lt=.01)
    budget_limit:float=Field(default=10,gt=0,le=100)
    clip_norm:float=Field(default=1,gt=0,le=10)
    noise_multiplier:float=Field(default=1,gt=0,le=10)
class RoundInput(BaseModel):hospital_ids:list[str]=Field(default_factory=list,max_length=20)
class ReviewInput(BaseModel):
    case_id:str
    decision:Literal['approved','rejected','additional_review']
    comments:str=Field(min_length=3,max_length=2000)
class PredictionInput(BaseModel):
    age:float=Field(ge=0,le=120)
    gender_category:Literal[0,1]
    blood_pressure_systolic:float=Field(ge=40,le=300)
    blood_pressure_diastolic:float=Field(ge=20,le=200)
    glucose_level:float=Field(ge=10,le=700)
    cholesterol_level:float=Field(ge=30,le=600)
    bmi:float=Field(ge=8,le=90)
    heart_rate:float=Field(ge=20,le=250)
    medical_history_flag:Literal[0,1]
@app.exception_handler(ValueError)
async def invalid(request,exc):return JSONResponse(status_code=400,content={'detail':str(exc)})
@app.get('/api/health')
def health():return {'status':'healthy','demo_mode':DEMO,'storage':'temporary serverless SQLite' if os.getenv('VERCEL') and engine.url.drivername=='sqlite' else engine.url.drivername,'durable_storage':not(os.getenv('VERCEL') and engine.url.drivername=='sqlite'),'warning':'Synthetic research only; no clinical use'}
@app.post('/api/auth/login')
def login(b:Login,request:Request,response:Response,db=Depends(database)):
    limited(request,db);u=db.scalar(select(User).where(User.email==b.email.lower().strip()))
    if not u or not password_ok(b.password,u.password) or not u.active:raise HTTPException(401,'Incorrect email or password')
    token=jwt.encode({'sub':u.id,'jti':uid(),'exp':now()+timedelta(hours=8)},SECRET,algorithm='HS256');response.set_cookie('medifed_session',token,httponly=True,secure=bool(os.getenv('VERCEL')),samesite='lax',max_age=28800,path='/');audit(db,u,'Signed in');db.commit();return {'user':pack(u)}
@app.post('/api/auth/register',status_code=201)
def register(b:Register,request:Request,db=Depends(database)):
    limited(request,db,'register',5)
    if not DEMO:raise HTTPException(403,'Registration requires an administrator invitation')
    if len(b.password)<12 or '@' not in b.email:raise HTTPException(422,'Use a valid email and at least 12 password characters')
    h=Hospital(name=b.name+' Research Sandbox',location='Synthetic demo',active=False);db.add(h);db.flush();u=User(email=b.email.lower().strip(),name=b.name,password=password_hash(b.password),hospital_id=h.id,role='hospital_admin');db.add(u)
    try:db.flush()
    except IntegrityError:db.rollback();raise HTTPException(409,'Email already registered')
    audit(db,u,'Account registered');db.commit();return {'user':pack(u)}
@app.get('/api/auth/me')
def me(u=Depends(current)):return pack(u)
@app.post('/api/auth/logout')
def logout(request:Request,response:Response,u=Depends(current),db=Depends(database)):
    token=request.cookies.get('medifed_session') or request.headers.get('Authorization','')[7:];c=jwt.decode(token,SECRET,algorithms=['HS256']);save_setting(db,'revoked:'+c['jti'],True);response.delete_cookie('medifed_session');audit(db,u,'Signed out');db.commit();return {'message':'Signed out'}
class ResetRequest(BaseModel):email:str=Field(max_length=254)
@app.post('/api/auth/forgot-password')
def forgot(b:ResetRequest,request:Request,db=Depends(database)):
    limited(request,db,'reset',5);token=None;u=db.scalar(select(User).where(User.email==b.email.lower().strip()))
    if u:
        token=secrets.token_urlsafe(32);save_setting(db,'reset:'+hashlib.sha256(token.encode()).hexdigest(),{'user_id':u.id,'expires':time.time()+900});db.commit()
    return {'message':'If the account exists, a reset request was created. Contact your administrator for delivery.','demo_reset_token':token if DEMO else None}
class ResetInput(BaseModel):
    token:str=Field(max_length=200)
    password:str=Field(min_length=12,max_length=128)
@app.post('/api/auth/reset-password')
def reset(b:ResetInput,db=Depends(database)):
    key='reset:'+hashlib.sha256(b.token.encode()).hexdigest();r=setting(db,key)
    if not r or r['expires']<time.time():raise HTTPException(400,'Invalid or expired token')
    u=db.get(User,r['user_id']);u.password=password_hash(b.password);db.delete(db.get(Setting,key));audit(db,u,'Password reset');db.commit();return {'message':'Password updated. Sign in with your new password.'}
@app.get('/api/hospitals')
def hospitals(u=Depends(current),db=Depends(database)):
    result=[]
    for h in db.scalars(select(Hospital).order_by(Hospital.created_at)):
        d=pack(h);ds=db.scalars(select(Record).where(Record.kind=='dataset',Record.hospital_id==h.id)).all();d['dataset_size']=sum(len(json.loads(r.payload)['rows']) for r in ds);result.append(d)
    return result
@app.post('/api/hospitals',status_code=201)
def hospital_create(b:HospitalInput,u=Depends(current),db=Depends(database)):
    require(u,'super_admin');h=Hospital(**b.model_dump());db.add(h);db.flush();audit(db,u,'Hospital registered',h.name);db.commit();return pack(h)
@app.get('/api/hospitals/{id}')
def hospital_get(id:str,u=Depends(current),db=Depends(database)):
    h=db.get(Hospital,id)
    if not h:raise HTTPException(404,'Hospital not found')
    return pack(h)
@app.put('/api/hospitals/{id}')
def hospital_update(id:str,b:HospitalInput,u=Depends(current),db=Depends(database)):
    require(u,'super_admin','hospital_admin');tenant(u,id);h=db.get(Hospital,id)
    if not h:raise HTTPException(404,'Hospital not found')
    for k,v in b.model_dump().items():setattr(h,k,v)
    audit(db,u,'Hospital updated',h.name);db.commit();return pack(h)
def dataset_summary(r,preview=False):
    d=pack(r);rows=d.pop('rows');d['row_count']=len(rows)
    if preview:d['preview']=rows[:20]
    return d
@app.get('/api/datasets')
def datasets(u=Depends(current),db=Depends(database)):return [dataset_summary(r) for r in records(db,'dataset',u,True)]
@app.get('/api/datasets/{id}')
def dataset_get(id:str,u=Depends(current),db=Depends(database)):return dataset_summary(find(db,'dataset',id,u,True),True)
@app.post('/api/datasets/upload',status_code=201)
async def upload(file:UploadFile=File(...),hospital_id:str=Form(...),synthetic:bool=Form(...),u=Depends(current),db=Depends(database)):
    require(u,'super_admin','hospital_admin','researcher');tenant(u,hospital_id)
    if not db.get(Hospital,hospital_id):raise HTTPException(404,'Hospital not found')
    if not synthetic:raise HTTPException(422,'Only explicitly synthetic datasets are permitted')
    if not file.filename or not file.filename.lower().endswith('.csv'):raise HTTPException(422,'Only CSV files accepted')
    raw=await file.read(2_000_001)
    if len(raw)>2_000_000:raise HTTPException(413,'CSV must be under 2 MB')
    try:
        reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
        if set(reader.fieldnames or [])!=set(FEATURES+['risk_category']):raise ValueError('CSV must contain exactly the documented numeric features and risk_category; no identifiers')
        rows=list(reader)
        if len(rows)>10000:raise ValueError('Maximum 10,000 rows')
        report=validate(rows)
        if report['invalid_values']:raise ValueError('Invalid numeric values or out-of-range features')
    except (UnicodeDecodeError,csv.Error):raise HTTPException(422,'Invalid UTF-8 CSV')
    r=add(db,'dataset',{'name':file.filename[:120],'rows':rows,'validation':report,'preprocessed':False,'synthetic':True},hospital_id);audit(db,u,'Synthetic dataset uploaded',f'{len(rows)} rows');db.commit();return dataset_summary(r,True)
@app.post('/api/datasets/{id}/validate')
def dataset_validate(id:str,u=Depends(current),db=Depends(database)):
    require(u,'super_admin','hospital_admin','researcher');r=find(db,'dataset',id,u,True);d=json.loads(r.payload);d['validation']=validate(d['rows']);r.payload=json.dumps(d);audit(db,u,'Dataset validated',id);db.commit();return d['validation']
@app.post('/api/datasets/{id}/preprocess')
def preprocess(id:str,u=Depends(current),db=Depends(database)):
    require(u,'super_admin','hospital_admin','researcher');r=find(db,'dataset',id,u,True);d=json.loads(r.payload)
    if not validate(d['rows'])['passed']:raise HTTPException(422,'Resolve quality errors first')
    d['preprocessed']=True;d['preprocessing']={'imputation':'Public synthetic reference means','scaling':'Public reference center and scale','split':'75/25 stratified, seed 42'};r.payload=json.dumps(d);audit(db,u,'Preprocessing configured',id);db.commit();return dataset_summary(r,True)
@app.post('/api/datasets/{id}/train')
def local_train(id:str,algorithm:Literal['logistic','random_forest','gradient_boosting']='logistic',u=Depends(current),db=Depends(database)):
    require(u,'super_admin','hospital_admin','researcher');r=find(db,'dataset',id,u,True);rows=json.loads(r.payload)['rows']
    if not validate(rows)['passed']:raise HTTPException(422,'Dataset quality failed')
    result=train_local(rows,algorithm);add(db,'local_training',result,r.hospital_id);audit(db,u,'Local model trained',algorithm);db.commit();return result
@app.get('/api/privacy/config')
def privacy(u=Depends(current),db=Depends(database)):return setting(db,'privacy')
@app.put('/api/privacy/config')
def privacy_update(b:PrivacyInput,u=Depends(current),db=Depends(database)):
    require(u,'super_admin');old=setting(db,'privacy')
    if b.budget_limit<old['spent']:raise HTTPException(422,'Budget cannot be below recorded consumption')
    c={**b.model_dump(),'spent':old['spent']};save_setting(db,'privacy',c);audit(db,u,'Privacy configuration updated');db.commit();return c
@app.get('/api/privacy/budget')
def budget(u=Depends(current),db=Depends(database)):
    c=setting(db,'privacy');return {**c,'remaining':max(0,c['budget_limit']-c['spent']),'accounting':'Educational epsilon ledger; not formal DP accounting'}
@app.get('/api/privacy/audit')
def privacy_audit(u=Depends(current),db=Depends(database)):return [pack(r) for r in records(db,'privacy_accounting')]

def perform_round(db,u,ids):
    with lock:
        c=setting(db,'privacy')
        if c['enabled'] and c['spent']+c['epsilon']>c['budget_limit']:raise ValueError('Privacy budget exhausted. Increase the educational budget limit before another round.')
        hs=db.scalars(select(Hospital).where(Hospital.active==True)).all();selected=[h for h in hs if not ids or h.id in ids]
        if ids and len(selected)!=len(set(ids)):raise ValueError('Unknown or inactive hospital selected')
        if len(selected)<2:raise ValueError('At least two active hospitals required')
        ds=[]
        for h in selected:
            r=db.scalar(select(Record).where(Record.kind=='dataset',Record.hospital_id==h.id).order_by(Record.created_at.desc()).limit(1))
            if not r:raise ValueError(h.name+' has no dataset')
            ds.append((h.id,json.loads(r.payload)['rows']))
        ms=records(db,'model');previous=next((json.loads(m.payload) for m in ms if json.loads(m.payload).get('status')=='active'),None)
        result=train_federated(ds,c,previous);n=len(records(db,'round'))+1;version=f'v1.{n}.0'
        for m in ms:
            md=json.loads(m.payload)
            if md.get('status')=='active':md['status']='superseded';m.payload=json.dumps(md)
        model=add(db,'model',{**result,'version':version,'status':'active','name':'MediFed Synthetic Risk','research_only':True})
        row=add(db,'round',{'number':n,'version':version,'model_id':model.id,'participants':[h.id for h in selected],'status':'completed','metrics':result['metrics'],'duration_seconds':result['duration_seconds'],'aggregation':'FedAvg','requires_review':result['requires_review'],'privacy_configuration':{k:v for k,v in c.items() if k!='spent'}})
        for ev in result['local_evaluations']:add(db,'local_training',{'round_id':row.id,**ev},ev['hospital_id'])
        if c['enabled']:
            c['spent']+=c['epsilon'];save_setting(db,'privacy',c);add(db,'privacy_accounting',{'round_id':row.id,'epsilon':c['epsilon'],'cumulative':c['spent'],'guarantee':'Educational ledger only'})
        audit(db,u,'Federated round completed',f'{version}; {len(selected)} nodes; aggregate metrics only');db.commit();return pack(row)
@app.post('/api/federated/rounds/start')
def start(b:RoundInput,request:Request,u=Depends(current),db=Depends(database)):
    require(u,'super_admin');limited(request,db,'training',5);return perform_round(db,u,b.hospital_ids)
@app.get('/api/federated/rounds')
def rounds(u=Depends(current),db=Depends(database)):return [pack(r) for r in records(db,'round')]
@app.get('/api/federated/rounds/{id}')
def round_get(id:str,u=Depends(current),db=Depends(database)):return pack(find(db,'round',id))
@app.get('/api/federated/participants')
def participants(u=Depends(current),db=Depends(database)):return hospitals(u,db)
@app.get('/api/federated/metrics')
def federation_metrics(u=Depends(current),db=Depends(database)):return [{'round':r['number'],**r['metrics']} for r in reversed(rounds(u,db))]
def model_public(r):
    d=pack(r);d.pop('weights',None);d.pop('local_evaluations',None);return d
@app.get('/api/models')
def models(u=Depends(current),db=Depends(database)):return [model_public(r) for r in records(db,'model')]
@app.get('/api/models/{id}')
def model_get(id:str,u=Depends(current),db=Depends(database)):return model_public(find(db,'model',id))
@app.get('/api/models/{id}/versions')
def versions(id:str,u=Depends(current),db=Depends(database)):
    find(db,'model',id);return models(u,db)
class ModelAction(BaseModel):action:Literal['archive','activate']
@app.post('/api/models/{id}/status')
def model_status(id:str,b:ModelAction,u=Depends(current),db=Depends(database)):
    require(u,'super_admin');r=find(db,'model',id);d=json.loads(r.payload)
    if b.action=='activate':
        for m in records(db,'model'):
            md=json.loads(m.payload)
            if md['status']=='active':md['status']='superseded';m.payload=json.dumps(md)
    d['status']='active' if b.action=='activate' else 'archived';r.payload=json.dumps(d);audit(db,u,'Model '+b.action,d['version']);db.commit();return model_public(r)
@app.post('/api/models/compare')
def compare(ids:list[str],u=Depends(current),db=Depends(database)):
    if not 2<=len(ids)<=5:raise HTTPException(422,'Select two to five models')
    return [model_public(find(db,'model',id)) for id in ids]
@app.post('/api/research/predict',status_code=201)
def research_predict(b:PredictionInput,u=Depends(current),db=Depends(database)):
    require(u,'super_admin','hospital_admin','researcher','clinician');active=next((r for r in records(db,'model') if json.loads(r.payload)['status']=='active'),None)
    if not active:raise HTTPException(409,'Train a federated round first')
    d=json.loads(active.payload);result=predict(b.model_dump(),d);r=add(db,'case',{**result,'features':b.model_dump(),'model_id':active.id,'model_version':d['version'],'review_status':'pending','review_comments':'','evaluation_status':'Experimental research only'},u.hospital_id);audit(db,u,'Synthetic prediction generated',r.id);db.commit();return pack(r)
@app.get('/api/research/cases')
def cases(u=Depends(current),db=Depends(database)):return [pack(r) for r in records(db,'case',u,True)]
@app.get('/api/research/cases/{id}')
def case_get(id:str,u=Depends(current),db=Depends(database)):return pack(find(db,'case',id,u,True))
@app.post('/api/research/reviews')
def review(b:ReviewInput,u=Depends(current),db=Depends(database)):
    require(u,'super_admin','clinician');r=find(db,'case',b.case_id,u,True);d=json.loads(r.payload);d['review_status']=b.decision;d['review_comments']=b.comments;r.payload=json.dumps(d);add(db,'review',{**b.model_dump(),'reviewer_id':u.id,'meaning':'Research artifact review only'},r.hospital_id);audit(db,u,'Research artifact reviewed',b.decision);db.commit();return pack(r)
class WorkflowState(TypedDict,total=False):
    blocked:bool
    result:dict
    executions:list
@app.get('/api/agents')
def agents(u=Depends(current)):return [{'name':n,'id':i,'implementation':'Deterministic Python research agent','status':'ready'} for i,n in enumerate(AGENTS)]
@app.post('/api/agents/workflow/start')
def workflow(b:RoundInput,request:Request,u=Depends(current),db=Depends(database)):
    require(u,'super_admin');limited(request,db,'workflow',5);ex=add(db,'execution',{'status':'running','steps':[]});db.commit();graph=StateGraph(WorkflowState)
    def node(i):
        def run(state):
            t=time.perf_counter();blocked=False;output='';result=state.get('result',{})
            try:
                if i==0:
                    hs=db.scalars(select(Hospital).where(Hospital.active==True)).all();hs=[h for h in hs if not b.hospital_ids or h.id in b.hospital_ids];reports=[]
                    for h in hs:
                        ds=db.scalar(select(Record).where(Record.kind=='dataset',Record.hospital_id==h.id).order_by(Record.created_at.desc()).limit(1));reports.append(validate(json.loads(ds.payload)['rows']) if ds else {'passed':False})
                    blocked=len(reports)<2 or not all(r['passed'] for r in reports);output=f'{len(reports)} local quality gates evaluated. '+('Blocked: repair local datasets.' if blocked else 'Quality gates passed.')
                elif i==1:
                    c=setting(db,'privacy');blocked=c['enabled'] and c['spent']+c['epsilon']>c['budget_limit'];output='Budget exhausted; workflow blocked.' if blocked else 'Participation and educational privacy budget validated.'
                elif i==2:result=perform_round(db,u,b.hospital_ids);output='Completed '+result['version']+' with weighted FedAvg.'
                elif i==3:output=f"Holdout accuracy {result['metrics']['accuracy']:.3f}; "+('human review required.' if result['requires_review'] else 'experimental threshold met.')
                elif i==4:
                    m=json.loads(find(db,'model',result['model_id']).payload);output='Exact linear contributions generated; strongest feature: '+m['feature_importance'][0]['feature']
                elif i==5:
                    m=json.loads(find(db,'model',result['model_id']).payload);output=f"Demographic accuracy gap {m['fairness_gap']:.3f}. "+('Additional review required.' if m['fairness_gap']>.1 else 'No gap above 0.10 threshold.')
                elif i==6:output=f"Research summary: {len(result['participants'])} synthetic institutions; accuracy {result['metrics']['accuracy']:.3f}. No diagnostic or treatment claims."
                else:audit(db,u,'Agent workflow audited',ex.id);output='Workflow transitions recorded; artifacts subject to human review.'
            except (ValueError,HTTPException) as e:blocked=True;output=str(e)
            step={'agent':AGENTS[i],'status':'blocked' if blocked else 'completed','input_summary':'Local quality summaries and aggregate model state','output_summary':output,'duration_ms':round((time.perf_counter()-t)*1000,2),'next_action':'Resolve gate failure' if blocked else AGENTS[i+1] if i<7 else 'Human research review'};steps=state.get('executions',[])+[step];ex.payload=json.dumps({'status':'blocked' if blocked else 'completed' if i==7 else 'running','steps':steps,'round_id':result.get('id')});db.commit();return {'blocked':blocked,'result':result,'executions':steps}
        return run
    for i,n in enumerate(AGENTS):
        graph.add_node(n,node(i))
        if i<len(AGENTS)-1:graph.add_conditional_edges(n,lambda s:'stop' if s.get('blocked') else 'next',{'stop':END,'next':AGENTS[i+1]})
        else:graph.add_edge(n,END)
    graph.set_entry_point(AGENTS[0]);graph.compile().invoke({'blocked':False,'executions':[],'result':{}});return pack(ex)
@app.get('/api/agents/executions')
def executions(u=Depends(current),db=Depends(database)):return [pack(r) for r in records(db,'execution')]
@app.get('/api/agents/executions/{id}')
def execution_get(id:str,u=Depends(current),db=Depends(database)):return pack(find(db,'execution',id))
@app.get('/api/dashboard/overview')
def overview(u=Depends(current),db=Depends(database)):
    hs=hospitals(u,db);rs=rounds(u,db);ms=models(u,db);active=next((m for m in ms if m['status']=='active'),None);cs=cases(u,db)
    return {'hospitals':len(hs),'active_participants':sum(h['active'] for h in hs),'completed_rounds':len(rs),'accuracy':active['metrics']['accuracy'] if active else None,'active_agents':8,'pending_reviews':sum(c['review_status']=='pending' for c in cs),'privacy':setting(db,'privacy'),'model':active,'synthetic_records':sum(h['dataset_size'] for h in hs),'health':'Operational','demo_mode':DEMO}
@app.get('/api/dashboard/activities')
def activities(u=Depends(current),db=Depends(database)):
    q=select(Record).where(Record.kind=='audit')
    if u.role not in ['super_admin','auditor']:q=q.where(Record.hospital_id==u.hospital_id)
    return [pack(r) for r in db.scalars(q.order_by(Record.created_at.desc()).limit(50))]
@app.get('/api/analytics/performance')
def performance(u=Depends(current),db=Depends(database)):return federation_metrics(u,db)
@app.get('/api/analytics/hospitals')
def analytics_hospitals(u=Depends(current),db=Depends(database)):return hospitals(u,db)
@app.get('/api/analytics/fairness')
def fairness(u=Depends(current),db=Depends(database)):return next((m['fairness'] for m in models(u,db) if m['status']=='active'),[])
@app.get('/api/analytics/privacy')
def analytics_privacy(u=Depends(current),db=Depends(database)):return privacy_audit(u,db)
@app.get('/api/admin/audit-logs')
def audit_logs(offset:int=0,limit:int=50,u=Depends(current),db=Depends(database)):
    require(u,'super_admin','auditor');return [pack(r) for r in records(db,'audit')[max(0,offset):max(0,offset)+max(1,min(limit,200))]]
@app.get('/api/admin/users')
def users(u=Depends(current),db=Depends(database)):
    require(u,'super_admin');return [pack(x) for x in db.scalars(select(User))]
class UserUpdate(BaseModel):
    role:Literal['super_admin','hospital_admin','researcher','clinician','auditor']
    active:bool
@app.put('/api/admin/users/{id}')
def user_update(id:str,b:UserUpdate,u=Depends(current),db=Depends(database)):
    require(u,'super_admin');x=db.get(User,id)
    if not x:raise HTTPException(404,'User not found')
    if x.id==u.id:raise HTTPException(422,'Cannot change your own access')
    if b.role not in ['super_admin','auditor'] and not x.hospital_id:raise HTTPException(422,'Hospital membership required')
    x.role=b.role;x.active=b.active;audit(db,u,'User access updated',x.email);db.commit();return pack(x)
@app.get('/api/admin/system-health')
def system_health(u=Depends(current),db=Depends(database)):
    require(u,'super_admin','auditor');db.execute(select(func.count(User.id)));return {**health(),'database':'connected','agent_engine':'LangGraph','ml_engine':'NumPy / scikit-learn','federation':'In-process node simulation','security':'Educational privacy mechanisms; no regulatory validation'}
@app.get('/api/reports/{kind}')
def report(kind:Literal['federated','privacy','models'],format:Literal['csv','pdf']='csv',u=Depends(current),db=Depends(database)):
    data=rounds(u,db) if kind=='federated' else privacy_audit(u,db) if kind=='privacy' else models(u,db);audit(db,u,'Report exported',kind);db.commit()
    if format=='pdf':
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        out=io.BytesIO();c=canvas.Canvas(out,pagesize=A4);c.setTitle('MediFed AI Research Report');y=790
        def line(text):
            nonlocal y
            if y<60:c.showPage();y=790;c.setFont('Helvetica',10)
            c.drawString(42,y,str(text)[:105]);y-=18
        c.setFont('Helvetica',10);line('MediFed AI | '+kind.upper()+' RESEARCH REPORT');line('Synthetic data only. Experimental outputs - not medical diagnoses.');line('Noise and masking are educational simulations.');line('Generated '+now().isoformat());line('Records: '+str(len(data)));line(' ')
        for r in data:
            line('Record '+r['id']);line('Created '+r['created_at'])
            for k in ['version','number','status','epsilon','cumulative','aggregation']:
                if k in r:line(k+': '+str(r[k]))
            for k,v in r.get('metrics',{}).items():line(k+': '+str(v))
            line(' ')
        c.save();out.seek(0);return StreamingResponse(out,media_type='application/pdf',headers={'Content-Disposition':f'attachment; filename="medifed-{kind}.pdf"'})
    out=io.StringIO();flat=[{k:json.dumps(v) if isinstance(v,(dict,list)) else v for k,v in r.items()} for r in data];w=csv.DictWriter(out,fieldnames=list(dict.fromkeys(k for r in flat for k in r)) or ['status']);w.writeheader();w.writerows(flat)
    return Response(out.getvalue(),media_type='text/csv',headers={'Content-Disposition':f'attachment; filename="medifed-{kind}.csv"'})
@app.get('/api/synthetic/sample')
def sample(u=Depends(current)):
    out=io.StringIO();w=csv.DictWriter(out,fieldnames=FEATURES+['risk_category']);w.writeheader();w.writerows(generate(73,100));return Response(out.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="synthetic-cohort.csv"'})
