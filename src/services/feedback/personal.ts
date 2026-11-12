import type { RecordValue, Storage, Transport } from './store';

interface Payload {
  foodName: string;
  purchaseDate: string;
  expiryDate: string | null;
  storage: string;
  opened: boolean;
  active: boolean;
  source: 'package_label' | null;
}
interface Pending {
  revision: number;
  acknowledged?: Payload;
  request?: { key: string; expectedRevision: number; data: Payload };
  error?: string;
  retryAt?: number;
  reason?: string;
}
interface State {
  version: 1;
  binding?: string;
  items: Record<string, Pending>;
}
export interface PersonalStatistic {
  foodName: string;
  storage: string;
  count: number;
  totalDays: number;
  meanDays: number;
}
const KEY = 'personal-average-sync-v1';

function payload(record: RecordValue): Payload {
  const hasLabel = record.source === 'package_label' && record.expiry !== null;
  return {
    foodName: record.item.standardName,
    purchaseDate: record.item.purchaseDate,
    expiryDate: hasLabel ? record.expiry : null,
    storage: record.item.storageType,
    opened: record.item.isOpened,
    active: record.personalAverage === true,
    source: hasLabel ? 'package_label' : null,
  };
}

// D-050: reads the durable personal edits. A crash between saving and syncing is recoverable.
export function createPersonalSync(storage: Storage, newId: () => string,
  records: () => Record<string, RecordValue>) {
  let busy = false;
  const read = (): State => {
    const raw = storage.getItem(KEY);
    const state: State = raw ? JSON.parse(raw) : { version: 1, items: {} };
    if (state.version !== 1 || !state.items) throw new Error('Unsupported personal sync data');
    return state;
  };
  const write = (state: State) => storage.setItem(KEY, JSON.stringify(state));
  async function authenticate(transport: Transport, identity: string) {
    const response = await transport('GET', '/v1/me');
    if (response.status !== 200 || typeof response.body.ownerId !== 'string') {
      throw new Error('서버 인증을 확인해 주세요');
    }
    const state = read();
    const binding = `${identity}|${response.body.ownerId}`;
    if (state.binding && state.binding !== binding) throw new Error('기존 서버와 계정으로 연결해 주세요');
    state.binding = binding;
    write(state);
  }
  return {
    state: read,
    statuses() {
      const state=read();
      return Object.entries(records()).filter(([id,record])=>record.personalAverage || state.items[id])
        .map(([id,record])=>({id,...state.items[id],localPending:
          JSON.stringify(payload(record))!==JSON.stringify(state.items[id]?.acknowledged)}));
    },
    async sync(transport: Transport, identity: string) {
      if (busy) return;
      busy = true;
      try {
        await authenticate(transport, identity);
        for (;;) {
          const state = read();
          const entries = records();
          let selected: { id: string; pending: Pending } | undefined;
          for (const [id, record] of Object.entries(entries)) {
            if (!record.personalAverage && !state.items[id]) continue;
            const pending = state.items[id] ?? { revision: 0 };
            const data = payload(record);
            if(pending.error && pending.error!=='REVISION_CONFLICT' &&
                JSON.stringify(data)!==JSON.stringify(pending.request?.data)) {
              delete pending.error; delete pending.request;
            }
            if (pending.error || (pending.retryAt && pending.retryAt > Date.now())) continue;
            if (!pending.request && JSON.stringify(data) === JSON.stringify(pending.acknowledged)) continue;
            pending.request ??= { key: newId(), expectedRevision: pending.revision, data };
            state.items[id] = pending;
            selected = { id, pending };
            break;
          }
          if (!selected) return;
          write(state); // Persist immutable request before IO, including withdrawal and retries.
          const { id, pending } = selected;
          const request = pending.request!;
          let response;
          try {
            response = await transport('PUT', `/v1/me/personal-items/${encodeURIComponent(id)}`,
              { data: request.data, expectedRevision: request.expectedRevision }, request.key);
          } catch { return; }
          if (response.status >= 500 || response.status === 401 || response.status === 429) {
            pending.retryAt = Date.now() + (response.retryAfterMs ?? 0);
            write(state);
            return;
          }
          if (response.status >= 400) {
            pending.error = String((response.body.error as { code?: string })?.code ?? response.status);
          } else {
            if (!Number.isInteger(response.body.revision) || Number(response.body.revision) < 1) {
              throw new Error('서버 응답 버전을 확인할 수 없습니다');
            }
            pending.revision = Number(response.body.revision);
            pending.acknowledged = request.data;
            pending.reason=String(response.body.reason ?? 'UNKNOWN');
            delete pending.request;
            delete pending.retryAt;
          }
          write(state);
          // Re-read local records on every iteration: edits during the request remain authoritative.
        }
      } finally { busy = false; }
    },
    async resolveWithLocal(id: string, transport: Transport, identity: string) {
      if (busy) throw new Error('동기화 완료 후 다시 시도해 주세요');
      busy = true;
      try {
        await authenticate(transport, identity);
        const response = await transport('GET', `/v1/me/personal-items/${encodeURIComponent(id)}`);
        if (response.status !== 200 || !Number.isInteger(response.body.revision)) {
          throw new Error('최신 서버 기록을 확인할 수 없습니다');
        }
        const state = read();
        if (state.items[id]?.error !== 'REVISION_CONFLICT') throw new Error('해결할 충돌이 없습니다');
        state.items[id] = { revision: Number(response.body.revision) };
        write(state);
      } finally { busy = false; }
    },
    async statistics(transport: Transport, identity: string): Promise<PersonalStatistic[]> {
      await authenticate(transport, identity);
      const response = await transport('GET', '/v1/me/personal-statistics');
      if (response.status !== 200 || !Array.isArray(response.body.statistics)) {
        throw new Error('개인 통계를 읽지 못했습니다');
      }
      return response.body.statistics as PersonalStatistic[];
    },
  };
}
