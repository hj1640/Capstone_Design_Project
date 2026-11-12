import type { Transport } from './store';

export interface SecretStorage {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  clear(): Promise<void>;
}
interface Credential {
  version: 1;
  url: string;
  token: string;
  code?: string;
  ownerId?: string;
  expiresAt?: number;
}
export function serverOrigin(value: string, allowLoopback=false): string {
  const url=new URL(value);
  const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:' && !(allowLoopback && loopback && url.protocol==='http:')) ||
      url.username || url.password || url.search || url.hash || url.pathname!=='/')
    throw new Error('HTTPS 서버 주소를 입력해 주세요. 개발 모드에서는 이 기기의 로컬 서버도 사용할 수 있습니다.');
  return url.origin;
}

// D-051: enrollment is recoverable after a crash or a lost response. The raw
// device secret is only stored in the injected native secure storage, never SQLite.
export function createSessionManager(storage: SecretStorage, newSecret:()=>Promise<string>,
  transport:(url:string,token:string)=>Transport,
  verify:(candidate: {url:string; transport:Transport})=>Promise<void>, allowLoopback=false) {
  let credential: Credential | undefined;
  let busy=false;
  let verified=false;
  async function read() {
    const raw=await storage.get();
    if(!raw) {credential=undefined;return;}
    const stored=JSON.parse(raw) as Credential;
    if(stored.version!==1 || !/^[A-Za-z0-9_-]{43,128}$/.test(stored.token)) throw new Error('저장된 연결 정보를 확인해 주세요');
    serverOrigin(stored.url,allowLoopback);
    credential=stored;
  }
  async function resume() {
    verified=false;
    await read();
    if(!credential) return;
    const current=credential;
    const client=transport(current.url,current.token);
    if(current.code) {
      const response=await client('POST','/v1/auth/enroll',{code:current.code,deviceSecret:current.token});
      if(response.status!==200 || typeof response.body.ownerId!=='string' || !Number.isInteger(response.body.expiresAt))
        throw new Error('연결 코드를 확인해 주세요. 사용·만료된 코드는 담당자에게 다시 발급받아야 합니다.');
      current.ownerId=response.body.ownerId;
      current.expiresAt=Number(response.body.expiresAt);
      delete current.code;
      await storage.set(JSON.stringify(current));
    }
    await verify({url:current.url,transport:client});
    verified=true;
  }
  return {
    status:()=>({saved:!!credential,connected:verified,url:credential?.url,expiresAt:credential?.expiresAt}),
    client:()=>credential && verified ? {url:credential.url,transport:transport(credential.url,credential.token)} : undefined,
    async restore() {
      if(busy) return;
      busy=true;
      try {await resume();} finally {busy=false;}
    },
    async enroll(url:string,code:string) {
      if(busy) throw new Error('연결 확인이 끝난 뒤 다시 시도해 주세요');
      busy=true;
      try {
        await read();
        if(credential) throw new Error('기존 연결을 해제한 뒤 새 코드를 입력해 주세요. 개인 기록은 삭제되지 않습니다.');
        const candidate:Credential={version:1,url:serverOrigin(url,allowLoopback),token:await newSecret(),code:code.trim()};
        if(!/^[A-Za-z0-9_-]{43,128}$/.test(candidate.token) || !/^[A-Za-z0-9_-]{43,128}$/.test(candidate.code!))
          throw new Error('연결 코드 형식을 확인해 주세요');
        await storage.set(JSON.stringify(candidate));
        credential=candidate;
        await resume();
      } finally {busy=false;}
    },
    async disconnect() {
      if(busy) throw new Error('연결 확인이 끝난 뒤 다시 시도해 주세요');
      busy=true;
      try {
        await read();
        if(credential) {
          const response=await transport(credential.url,credential.token)('POST','/v1/auth/logout',{});
          if(response.status!==200 && response.status!==401) throw new Error('서버 연결 해제를 완료하지 못했습니다. 재시도해 주세요');
        }
        await storage.clear();
        credential=undefined;verified=false;
      } finally {busy=false;}
    },
  };
}
