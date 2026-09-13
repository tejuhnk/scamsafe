import { describe, expect, it } from 'vitest';
import { score } from './risk.js';
describe('risk scoring', () => it('flags combined scam signals', () => {
 const answer = score({modelProbabilities:{SAFE:.03,SCAM:.9,SUSPICIOUS:.07},signals:[{category:'otp',evidence:['OTP']},{category:'urgency',evidence:['urgent']}],urls:['http://bit.ly/x'],phones:[],language:['English'],languageCombination:'English',normalizedMessage:'',modelVersion:'x'});
 expect(answer.classification).toBe('SCAM'); expect(answer.riskScore).toBeGreaterThan(60);
}));
