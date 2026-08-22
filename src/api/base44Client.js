import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const rawClient = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// 데이터 격리: 모든 생성 요청에 현재 사용자의 tenant_id 를 자동 주입
let tenantIdPromise = null;
const currentTenantId = () => {
  if (!tenantIdPromise) {
    tenantIdPromise = rawClient.auth
      .me()
      .then((u) => u?.tenant_id || null)
      .catch(() => null);
  }
  return tenantIdPromise;
};

const withTenant = (entity) =>
  new Proxy(entity, {
    get(target, prop) {
      if (prop === 'create') {
        return async (data) => target.create({ tenant_id: await currentTenantId(), ...data });
      }
      if (prop === 'bulkCreate') {
        return async (records) => {
          const tenantId = await currentTenantId();
          return target.bulkCreate((records || []).map((r) => ({ tenant_id: tenantId, ...r })));
        };
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });

const entityCache = {};
const entitiesProxy = new Proxy(rawClient.entities, {
  get(target, name) {
    const entity = target[name];
    if (!entity || typeof entity !== 'object' || name === 'User') return entity;
    if (!entityCache[name]) entityCache[name] = withTenant(entity);
    return entityCache[name];
  }
});

export const base44 = new Proxy(rawClient, {
  get(target, prop) {
    if (prop === 'entities') return entitiesProxy;
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});