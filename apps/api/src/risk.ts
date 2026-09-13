export type MlResult = { modelProbabilities: Record<string, number>; signals: {category:string; evidence:string[]}[]; urls:string[]; phones:string[]; language:string[]; languageCombination:string; normalizedMessage:string; modelVersion:string };

const WEIGHTS: Record<string, number> = { urgency: 8, kyc: 12, otp: 22, money: 17, account_block: 14, prize: 8 };
const reasons: Record<string, string> = { urgency: 'Urgent language detected', kyc: 'KYC-related request detected', otp: 'Credential or OTP request detected', money: 'Request for money detected', account_block: 'Account-blocking language detected', prize: 'Prize or lottery language detected' };

export function score(result: MlResult) {
  const ml = Math.round(((result.modelProbabilities.SCAM ?? 0) * 60) + ((result.modelProbabilities.SUSPICIOUS ?? 0) * 25));
  const signalScore = result.signals.reduce((sum, signal) => sum + (WEIGHTS[signal.category] ?? 0), 0);
  const urlScore = result.urls.reduce((sum, url) => sum + (/^http:\/\//i.test(url) ? 15 : 5) + (/(bit\.ly|tinyurl|\.xyz|\.top|xn--)/i.test(url) ? 12 : 0), 0);
  const phoneScore = result.phones.length ? 2 : 0;
  const riskScore = Math.min(100, Math.round(ml + signalScore + urlScore + phoneScore));
  const classification = riskScore >= 60 ? 'SCAM' : riskScore >= 30 ? 'SUSPICIOUS' : 'SAFE';
  const detectedReasons = result.signals.map(s => reasons[s.category]).filter(Boolean);
  if (result.urls.length) detectedReasons.push('Link detected; inspect it before opening');
  return { classification, riskScore, confidence: Math.max(...Object.values(result.modelProbabilities)), reasons: [...new Set(detectedReasons)], scoring: { ml, signalScore, urlScore, phoneScore } };
}
