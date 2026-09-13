from fastapi.testclient import TestClient
from app import app

def test_scam_message_has_evidence():
    result = TestClient(app).post('/analyze', json={'message':'URGENT tumcha account block honar aahe. KYC update kara http://bit.ly/x'}).json()
    assert result['urls'] and result['signals']

def test_safe_bank_context_does_not_require_scam_label():
    result = TestClient(app).post('/analyze', json={'message':'Use the official bank app to view your KYC status.'}).json()
    assert 'modelProbabilities' in result
