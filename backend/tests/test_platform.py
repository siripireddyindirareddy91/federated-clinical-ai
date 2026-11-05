import os,tempfile
os.environ['DATABASE_URL']='sqlite:///'+tempfile.mktemp(suffix='.db')
os.environ['DEMO_MODE']='true'
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.ml import generate,validate,weighted_average,train_federated,FEATURES
import numpy as np
import csv,io,unittest

PASSWORD='MediFed-Demo-2026!'
class PlatformTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=TestClient(app);cls.researcher=TestClient(app);cls.auditor=TestClient(app)
        for client,role in [(cls.admin,'super_admin'),(cls.researcher,'researcher'),(cls.auditor,'auditor')]:
            r=client.post('/api/auth/login',json={'email':role+'@medifed.demo','password':PASSWORD});assert r.status_code==200,r.text
        cls.hospitals=cls.admin.get('/api/hospitals').json();cls.datasets=cls.admin.get('/api/datasets').json()
    def test_authentication_and_revocation(self):
        c=TestClient(app);self.assertEqual(c.get('/api/auth/me').status_code,401)
        self.assertEqual(c.post('/api/auth/login',json={'email':'super_admin@medifed.demo','password':'wrong'}).status_code,401)
        c.post('/api/auth/login',json={'email':'auditor@medifed.demo','password':PASSWORD});cookie=c.cookies.get('medifed_session');self.assertEqual(c.post('/api/auth/logout').status_code,200)
        self.assertEqual(c.get('/api/auth/me',headers={'Authorization':'Bearer '+cookie}).status_code,401)
    def test_hospital_isolation(self):
        own=self.researcher.get('/api/datasets').json();self.assertGreaterEqual(len(own),1);self.assertEqual(len({d['hospital_id'] for d in own}),1)
        foreign=next(d for d in self.datasets if d['hospital_id']!=own[0]['hospital_id'])
        for suffix in ['', '/validate','/preprocess','/train']:
            method=self.researcher.get if not suffix else self.researcher.post
            self.assertEqual(method('/api/datasets/'+foreign['id']+suffix).status_code,403)
        self.assertEqual(self.auditor.get('/api/datasets').json(),[])
        snapshot=self.researcher.get('/api/workspace').json();self.assertEqual(len({d['hospital_id'] for d in snapshot['datasets']}),1);self.assertEqual(snapshot['users'],[]);self.assertEqual(len(snapshot['rounds']),snapshot['overview']['completed_rounds'])
    def test_roles(self):
        self.assertEqual(self.researcher.post('/api/federated/rounds/start',json={}).status_code,403)
        self.assertEqual(self.researcher.get('/api/admin/users').status_code,403)
        self.assertEqual(self.auditor.get('/api/admin/audit-logs').status_code,200)
        values={k:v for k,v in generate(12,1)[0].items() if k!='risk_category'};values['gender_category']=int(values['gender_category']);values['medical_history_flag']=int(values['medical_history_flag'])
        self.assertEqual(self.auditor.post('/api/research/predict',json=values).status_code,403)
    def test_dataset_upload_validation_and_local_models(self):
        own=self.researcher.get('/api/datasets').json()[0];hid=own['hospital_id']
        out=io.StringIO();w=csv.DictWriter(out,fieldnames=FEATURES+['risk_category']);w.writeheader();w.writerows(generate(99,80))
        r=self.researcher.post('/api/datasets/upload',data={'hospital_id':hid,'synthetic':'true'},files={'file':('sample.csv',out.getvalue(),'text/csv')});self.assertEqual(r.status_code,201,r.text)
        id=r.json()['id'];self.assertTrue(self.researcher.post(f'/api/datasets/{id}/validate').json()['passed'])
        self.assertTrue(self.researcher.post(f'/api/datasets/{id}/preprocess').json()['preprocessed'])
        for algorithm in ['logistic','random_forest','gradient_boosting']:
            r=self.researcher.post(f'/api/datasets/{id}/train?algorithm={algorithm}');self.assertEqual(r.status_code,200,r.text);self.assertGreater(r.json()['metrics']['accuracy'],.5)
        r=self.researcher.post('/api/datasets/upload',data={'hospital_id':hid,'synthetic':'true'},files={'file':('pii.csv','name,phone\nJane,123','text/csv')});self.assertEqual(r.status_code,400)
        r=self.researcher.post('/api/datasets/upload',data={'hospital_id':hid,'synthetic':'false'},files={'file':('sample.csv',out.getvalue(),'text/csv')});self.assertEqual(r.status_code,422)
    def test_fedavg_numerical(self):
        np.testing.assert_allclose(weighted_average([[1,2],[3,4]],[1,3]),[2.5,3.5])
        report=validate(generate());self.assertTrue(report['passed']);self.assertEqual(report['quality_score'],100)
        result=train_federated([('a',generate(1,150)),('b',generate(2,160))],{'clip_norm':1,'enabled':False,'noise_multiplier':1})
        self.assertGreater(result['metrics']['accuracy'],.7);self.assertEqual(sum(map(sum,result['metrics']['confusion_matrix'])),result['metrics']['samples'])
    def test_round_workflow_research_review_and_reports(self):
        r=self.admin.post('/api/federated/rounds/start',json={});self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['aggregation'],'FedAvg')
        self.assertNotIn('weights',self.admin.get('/api/models').json()[0]);self.assertEqual(len(self.admin.get('/api/analytics/fairness').json()),2)
        r=self.admin.post('/api/agents/workflow/start',json={});self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['status'],'completed');self.assertEqual(len(r.json()['steps']),8)
        values={k:v for k,v in generate(12,1)[0].items() if k!='risk_category'};values['gender_category']=int(values['gender_category']);values['medical_history_flag']=int(values['medical_history_flag'])
        r=self.researcher.post('/api/research/predict',json=values);self.assertEqual(r.status_code,201,r.text);case=r.json();self.assertEqual(len(case['contributions']),9)
        self.assertEqual(self.researcher.post('/api/research/reviews',json={'case_id':case['id'],'decision':'approved','comments':'Reviewed synthetic artifact'}).status_code,403)
        r=self.admin.post('/api/research/reviews',json={'case_id':case['id'],'decision':'approved','comments':'Reviewed synthetic artifact and limitations'});self.assertEqual(r.json()['review_status'],'approved')
        for kind in ['federated','privacy','models']:
            r=self.admin.get('/api/reports/'+kind);self.assertEqual(r.status_code,200);self.assertIn('text/csv',r.headers['content-type'])
            r=self.admin.get('/api/reports/'+kind+'?format=pdf');self.assertEqual(r.status_code,200,r.text);self.assertTrue(r.content.startswith(b'%PDF'))
    def test_privacy_gate(self):
        old=self.admin.get('/api/privacy/config').json();config={k:v for k,v in old.items() if k!='spent'};config['budget_limit']=max(old['spent'],.1);config['epsilon']=5
        self.assertEqual(self.admin.put('/api/privacy/config',json=config).status_code,200)
        try:
            self.assertEqual(self.admin.post('/api/federated/rounds/start',json={}).status_code,400)
            r=self.admin.post('/api/agents/workflow/start',json={});self.assertEqual(r.json()['status'],'blocked');self.assertLessEqual(len(r.json()['steps']),2)
        finally:self.admin.put('/api/privacy/config',json={k:v for k,v in old.items() if k!='spent'})
    def test_registration_and_password_reset(self):
        c=TestClient(app);r=c.post('/api/auth/register',json={'email':'new@example.org','name':'New Researcher','password':'Very-long-test-password'});self.assertEqual(r.status_code,201);self.assertEqual(r.json()['user']['role'],'hospital_admin')
        c.post('/api/auth/login',json={'email':'new@example.org','password':'Very-long-test-password'});self.assertEqual(c.get('/api/datasets').json(),[])
        token=c.post('/api/auth/forgot-password',json={'email':'new@example.org'}).json()['demo_reset_token'];self.assertTrue(token)
        self.assertEqual(c.post('/api/auth/reset-password',json={'token':token,'password':'Another-long-password'}).status_code,200)
        self.assertEqual(c.post('/api/auth/reset-password',json={'token':token,'password':'Another-long-password'}).status_code,400)

if __name__=='__main__':unittest.main()
