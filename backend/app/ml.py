"""Deterministic synthetic data and genuine parameter-based federated learning.
The five nodes are logical in-process tenants, not remotely isolated machines.
"""
import csv, io, math, time
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
FEATURES=['age','gender_category','blood_pressure_systolic','blood_pressure_diastolic','glucose_level','cholesterol_level','bmi','heart_rate','medical_history_flag']
CENTER=np.array([50,.5,125,80,115,200,27,75,.5])
SCALE=np.array([18,.5,25,15,45,45,7,15,.5])
AGENTS=['Data Quality','Privacy Guardian','Federated Coordinator','Model Evaluation','Explainability','Bias and Fairness','Clinical Research Assistant','Audit']
def generate(seed=42,n=260):
    rng=np.random.default_rng(seed)
    x=np.column_stack([rng.integers(20,85,n),rng.integers(0,2,n),rng.normal(125,20,n),rng.normal(80,10,n),rng.normal(115,35,n),rng.normal(200,35,n),rng.normal(27,5,n),rng.normal(75,12,n),rng.integers(0,2,n)])
    x=np.clip(x,[0,0,40,20,10,30,8,20,0],[120,1,300,200,700,600,90,250,1])
    z=(x-CENTER)/SCALE
    signal=z @ np.array([.85,.05,.7,.15,.95,.3,.6,.12,.55])+rng.normal(0,.6,n)
    y=(signal>0).astype(int)
    return [{**{k:round(float(v),2) for k,v in zip(FEATURES,row)},'risk_category':int(label)} for row,label in zip(x,y)]
def validate(rows):
    missing={k:sum(r.get(k) in (None,'') for r in rows) for k in FEATURES+['risk_category']}
    duplicates=len(rows)-len({tuple(str(r.get(k)) for k in FEATURES+['risk_category']) for r in rows})
    invalid=0
    ranges={'age':(0,120),'gender_category':(0,1),'blood_pressure_systolic':(40,300),'blood_pressure_diastolic':(20,200),'glucose_level':(10,700),'cholesterol_level':(30,600),'bmi':(8,90),'heart_rate':(20,250),'medical_history_flag':(0,1),'risk_category':(0,1)}
    for row in rows:
        for k,(lo,hi) in ranges.items():
            v=row.get(k)
            if v in (None,''): continue
            try:
                f=float(v)
                if not math.isfinite(f) or not lo<=f<=hi or (k in ['gender_category','medical_history_flag','risk_category'] and f not in [0,1]): invalid+=1
            except (ValueError,TypeError): invalid+=1
    total=max(1,len(rows)*len(ranges)); absent=sum(missing.values())
    passed=len(rows)>=40 and invalid==0 and missing['risk_category']==0 and absent/total<.2 and len({str(r.get('risk_category')) for r in rows})==2
    return {'rows':len(rows),'missing_values':missing,'duplicates':duplicates,'invalid_values':invalid,'quality_score':round(100*(1-(absent+invalid)/total),2),'passed':passed,'feature_types':{k:'numeric' for k in ranges},'message':'Ready for local preprocessing' if passed else 'Requires at least 40 rows, two binary classes, valid numeric ranges, and under 20% missing values.'}
def arrays(rows):
    x=np.array([[float(r[k]) if r.get(k) not in (None,'') else np.nan for k in FEATURES] for r in rows])
    # Public synthetic reference means prevent leakage from held-out records.
    x=np.where(np.isnan(x),CENTER,x)
    y=np.array([int(float(r['risk_category'])) for r in rows])
    return (x-CENTER)/SCALE,y,x

def sigmoid(x): return 1/(1+np.exp(-np.clip(x,-35,35)))
def metrics(y,p):
    pred=(p>=.5).astype(int)
    return { 'accuracy':float(accuracy_score(y,pred)), 'precision':float(precision_score(y,pred,zero_division=0)), 'recall':float(recall_score(y,pred,zero_division=0)), 'f1':float(f1_score(y,pred,zero_division=0)), 'roc_auc':float(roc_auc_score(y,p)) if len(np.unique(y))>1 else None,'confusion_matrix':confusion_matrix(y,pred,labels=[0,1]).tolist(),'samples':len(y)}
def weighted_average(updates,sizes): return np.average(np.array(updates),axis=0,weights=sizes)
def train_federated(datasets,privacy,previous=None):
    start=time.perf_counter(); updates=[]; sizes=[]; tests=[]; local=[]
    global_w=np.array(previous['weights']) if previous else np.zeros(len(FEATURES)+1)
    rng=np.random.default_rng()
    for hospital_id,rows in datasets:
        quality=validate(rows)
        if not quality['passed']: raise ValueError('Dataset quality gate failed')
        x,y,raw=arrays(rows)
        try: xt,xv,yt,yv,rt,rv=train_test_split(x,y,raw,test_size=.25,random_state=42,stratify=y)
        except ValueError: raise ValueError('Each class requires enough records for a stratified holdout')
        # Local gradient descent starts from the current global model each round.
        design=np.column_stack([xt,np.ones(len(xt))]); w=global_w.copy()
        for _ in range(100): w-=.08*(design.T@(sigmoid(design@w)-yt)/len(yt)+.005*np.r_[w[:-1],0])
        delta=w-global_w; norm=np.linalg.norm(delta); delta=delta*min(1,privacy['clip_norm']/max(norm,1e-12))
        if privacy['enabled']: delta+=rng.normal(0,privacy['noise_multiplier']/max(1,len(yt)),len(delta))
        updates.append(global_w+delta); sizes.append(len(yt)); tests.append((xv,yv,rv))
        local.append({'hospital_id':hospital_id,'training_samples':len(yt),'evaluation':metrics(yv,sigmoid(xv@w[:-1]+w[-1]))})
    # Pairwise masks cancel in weighted-sum space: educational, not cryptographic.
    masked=[u*n for u,n in zip(updates,sizes)]
    for i in range(len(masked)-1):
        mask=rng.normal(0,1,len(global_w)); masked[i]+=mask; masked[i+1]-=mask
    weights=np.sum(masked,axis=0)/sum(sizes)
    all_y=[]; all_p=[]; fair=[]
    # Coordinator receives aggregate metrics only; holdout rows stay in node evaluation scope.
    for xv,yv,rv in tests:
        p=sigmoid(xv@weights[:-1]+weights[-1]); all_y.extend(yv.tolist()); all_p.extend(p.tolist())
        for group in [0,1]:
            take=rv[:,1]==group
            if take.any(): fair.append((group,yv[take].tolist(),p[take].tolist()))
    fairness=[]
    for g in [0,1]:
        ys=sum([y for group,y,p in fair if group==g],[]); ps=sum([p for group,y,p in fair if group==g],[])
        fairness.append({'group':f'Gender category {g}',**metrics(np.array(ys),np.array(ps))})
    evaluation=metrics(np.array(all_y),np.array(all_p)); gap=abs(fairness[0]['accuracy']-fairness[1]['accuracy'])
    return {'weights':weights.tolist(),'metrics':evaluation,'local_evaluations':local,'fairness':fairness,'fairness_gap':gap,'requires_review':evaluation['accuracy']<.8 or gap>.1,'duration_seconds':round(time.perf_counter()-start,3),'training_samples':sum(sizes),'features':FEATURES,'algorithm':'Federated logistic regression','aggregation':'FedAvg','secure_aggregation':'Educational pairwise masking simulation; not cryptographic secure aggregation','privacy':'Clipped update noise simulation; no formal differential privacy guarantee','feature_importance':sorted([{'feature':k,'importance':round(abs(float(v)),5)} for k,v in zip(FEATURES,weights[:-1])],key=lambda x:-x['importance'])}
def predict(values,model):
    raw=np.array([values[k] for k in FEATURES]); z=(raw-CENTER)/SCALE
    w=np.array(model['weights']); p=float(sigmoid(z@w[:-1]+w[-1]))
    return {'probability':p,'risk_category':'Elevated synthetic risk' if p>=.5 else 'Lower synthetic risk','contributions':[{'feature':k,'contribution':float(a*b),'value':float(v)} for k,a,b,v in zip(FEATURES,z,w[:-1],raw)],'explanation_method':'Exact linear log-odds contributions relative to public synthetic reference means','intercept':float(w[-1]),'label':'Experimental model output — not a medical diagnosis.'}
def train_local(rows,algorithm):
    x,y,_=arrays(rows); xt,xv,yt,yv=train_test_split(x,y,test_size=.25,random_state=42,stratify=y)
    choices={'logistic':LogisticRegression(max_iter=400),'random_forest':RandomForestClassifier(n_estimators=60,max_depth=6,random_state=42),'gradient_boosting':GradientBoostingClassifier(n_estimators=60,max_depth=2,random_state=42)}
    m=choices[algorithm];m.fit(xt,yt)
    return {'algorithm':algorithm,'metrics':metrics(yv,m.predict_proba(xv)[:,1]),'note':'Local baseline only. Tree parameters are not averaged by FedAvg.'}
