// Public Firebase web configuration, not a service account or password.
const PROJECT = 'smart-fridge-capstone-4714a';
const API_KEY = 'AIzaSyD_3gz9k5aXJoyKpeGlSPbBwsCmG4bq7M4';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${ROOT}`;
export type Auth = { localId: string; idToken: string; refreshToken: string; expiresAt: number };
export type Scalar = string | number | boolean;
type Value = { stringValue: string } | { integerValue: string } | { doubleValue: number } | { booleanValue: boolean } | { timestampValue: string };
export type Doc = { name: string; updateTime: string; fields: Record<string, Value> };
export function fields(data: Record<string, Scalar>): Record<string, Value> {
  return Object.fromEntries(Object.entries(data).map(([k,v]) => [k, typeof v === 'string' ? {stringValue:v} : typeof v === 'boolean' ? {booleanValue:v} : Number.isInteger(v) ? {integerValue:String(v)} : {doubleValue:v}]));
}
export function decode(doc: Doc): Record<string, Scalar> {
  return Object.fromEntries(Object.entries(doc.fields).map(([k,v]) => [k, 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : v.timestampValue]));
}
async function json<T>(url: string, options: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {...options, signal:controller.signal});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status}`);
    return body as T;
  } finally { clearTimeout(timer); }
}
export async function signIn(email: string, password: string): Promise<Auth> {
  const v = await json<{localId:string;idToken:string;refreshToken:string;expiresIn:string}>(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  return {...v,expiresAt:Date.now()+Number(v.expiresIn)*1000};
}
async function token(auth: Auth): Promise<string> {
  if (Date.now()<auth.expiresAt-60000) return auth.idToken;
  const v = await json<{id_token:string;refresh_token:string;expires_in:string;user_id:string}>(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refreshToken)}`});
  if(v.user_id!==auth.localId) throw new Error('인증 사용자 불일치');
  Object.assign(auth,{idToken:v.id_token,refreshToken:v.refresh_token,expiresAt:Date.now()+Number(v.expires_in)*1000});
  return auth.idToken;
}
async function request<T>(auth: Auth, url:string, method='GET', body?:unknown):Promise<T> {
  return json<T>(url,{method,headers:{Authorization:`Bearer ${await token(auth)}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
export function documentName(collection:string,id:string) { return `${ROOT}/${collection}/${id}`; }
export function getDoc(auth:Auth,collection:string,id:string) { return request<Doc>(auth,`${BASE}/${collection}/${encodeURIComponent(id)}`); }
export function commit(auth:Auth,writes:unknown[]) { return request(auth,`${BASE}:commit`,'POST',{writes}); }
