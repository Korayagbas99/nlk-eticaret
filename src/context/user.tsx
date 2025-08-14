// src/context/user.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaymentCard = {
  id: string;
  brand: 'Visa' | 'Mastercard' | 'Amex' | 'Troy' | 'Bilinmiyor';
  holder: string;
  last4: string;
  expiry: string; // MM/YY
};

export type UserStats = { orders: number; packages: number; spend: number };

export type UserProfile = {
  role?: 'admin' | 'manager' | 'user';
  permissions?: string[];

  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  avatarUri?: string | null;
  memberSince?: string;
  createdAt?: string;
  stats?: UserStats;
  paymentMethods?: PaymentCard[];
  defaultPaymentId?: string;
  twoFactorEnabled?: boolean;
  twoFactorType?: 'TOTP' | 'SMS';
  twoFactorSecret?: string;
  biometricEnabled?: boolean;
};

type Ctx = {
  user: UserProfile;
  hydrateFromStorage: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => void;
  /** bazı eski yerler `update(...)` çağırıyor olabilir */
  update?: (patch: Partial<UserProfile>) => void;

  // yeni yardımcılar
  addOrder: (amount: number) => Promise<void>;
  setStatsFromOrders: () => Promise<void>;

  // ekstra
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  signOut: () => Promise<void>;
  grantAdmin: () => Promise<void>;
};

const UserContext = createContext<Ctx | undefined>(undefined);

const KEYS = {
  USERS: '@users',
  AUTH_EMAIL: '@authEmail',
  PROFILE: '@userProfile',
  CURRENT: '@currentUserEmail',
  ORDERS: '@orders',
};

const normalizeEmail = (e?: string) => (e ?? '').trim().toLowerCase();
const onlyDigits = (s?: string) => String(s ?? '').replace(/\D+/g, '');
const fullNameOf = (u: UserProfile) =>
  (u.firstName || u.lastName)
    ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
    : (u.name ?? '').trim();

const initialUser: UserProfile = {
  role: undefined,
  permissions: [],
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  avatarUri: null,
  memberSince: '-',
  stats: { orders: 0, packages: 0, spend: 0 },
  paymentMethods: [],
  defaultPaymentId: undefined,
};

function dedupeByEmail(records: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of records) {
    const k = normalizeEmail(r?.email);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export const UserProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(initialUser);

  /** @orders -> user.stats senkronizer */
  const setStatsFromOrders = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ORDERS);
      const arr: any[] = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];
      const orders = list.length;
      const spend = list.reduce((s, o) => s + (Number(o?.total) || 0), 0);

      setUser(prev => {
        const next: UserProfile = {
          ...prev,
          stats: {
            orders,
            spend,
            packages: prev.stats?.packages ?? 0, // paket sayısı farklı bir kaynaktan gelebilir
          },
        };
        // cache’i de güncelle
        AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(next)).catch(() => {});
        return next;
      });

      // USERS dizisindeki ilgili kaydı da güncelleyelim (opsiyonel ama iyi olur)
      const usersRaw = await AsyncStorage.getItem(KEYS.USERS);
      let users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
      const idx = users.findIndex((u: any) => normalizeEmail(u?.email) === normalizeEmail(user.email));
      if (idx >= 0) {
        users[idx] = {
          ...users[idx],
          stats: {
            orders,
            spend,
            packages: users[idx]?.stats?.packages ?? user.stats?.packages ?? 0,
          },
        };
        await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(users));
      }
    } catch (e) {
      console.warn('setStatsFromOrders error:', e);
    }
  }, [user.email, user.stats?.packages]);

  const hydrateFromStorage = useCallback(async () => {
    try {
      const [authEmailRaw, usersRaw, cachedProfileRaw] = await Promise.all([
        AsyncStorage.getItem(KEYS.AUTH_EMAIL),
        AsyncStorage.getItem(KEYS.USERS),
        AsyncStorage.getItem(KEYS.PROFILE),
      ]);

      const authEmail = normalizeEmail(authEmailRaw ?? '');
      const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];

      let record = users.find(u => normalizeEmail(u?.email) === authEmail);

      if (!record && cachedProfileRaw) {
        const cached = JSON.parse(cachedProfileRaw);
        if (normalizeEmail(cached?.email) === authEmail) {
          record = cached;
        }
      }

      if (!record) {
        setUser(initialUser);
        return;
      }

      const prof: UserProfile = {
        role: record.role,
        permissions: record.permissions ?? [],

        firstName: record.firstName ?? record.name?.split(' ')?.slice(0, -1)?.join(' ') ?? '',
        lastName: record.lastName ?? record.name?.split(' ')?.slice(-1)?.join(' ') ?? '',
        name: record.name,
        email: record.email,
        phone: record.phone,
        address: record.address,
        avatarUri: record.avatarUri ?? null,
        memberSince: record.memberSince ?? record.createdAt ?? '-',
        createdAt: record.createdAt,
        stats: record.stats ?? { orders: 0, packages: 0, spend: 0 },
        paymentMethods: record.paymentMethods ?? [],
        defaultPaymentId: record.defaultPaymentId,
        twoFactorEnabled: record.twoFactorEnabled,
        twoFactorType: record.twoFactorType,
        twoFactorSecret: record.twoFactorSecret,
        biometricEnabled: record.biometricEnabled,
      };

      setUser(prof);
      await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(prof));

      // 🧮 storage’daki gerçek siparişlerle senkronla
      await setStatsFromOrders();
    } catch (e) {
      console.warn('hydrateFromStorage error:', e);
    }
  }, [setStatsFromOrders]);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setUser(prev => {
      const next: UserProfile = { ...prev, ...patch };

      (async () => {
        try {
          await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(next));

          const usersRaw = await AsyncStorage.getItem(KEYS.USERS);
          let users: any[] = usersRaw ? JSON.parse(usersRaw) : [];

          const storedAuth = normalizeEmail(await AsyncStorage.getItem(KEYS.AUTH_EMAIL) ?? '');
          const prevEmail = normalizeEmail(prev.email);
          const nextEmail = normalizeEmail(next.email);

          let idx = users.findIndex((u: any) => normalizeEmail(u?.email) === storedAuth);
          if (idx < 0) idx = users.findIndex((u: any) => normalizeEmail(u?.email) === prevEmail);

          if (idx >= 0) {
            const updated = {
              ...users[idx],
              role: next.role ?? users[idx].role,
              permissions: next.permissions ?? users[idx].permissions ?? [],

              name: fullNameOf(next) || users[idx].name,
              firstName: next.firstName ?? users[idx].firstName,
              lastName: next.lastName ?? users[idx].lastName,
              email: nextEmail || users[idx].email,
              phone: next.phone ? onlyDigits(next.phone) : users[idx].phone,
              address: typeof next.address === 'string' ? next.address : users[idx].address,
              avatarUri: next.avatarUri ?? users[idx].avatarUri ?? null,
              memberSince:
                users[idx].memberSince ??
                users[idx].createdAt ??
                next.memberSince ??
                next.createdAt ??
                '-',
              createdAt: users[idx].createdAt ?? next.createdAt,
              stats: next.stats ?? users[idx].stats,
              paymentMethods: next.paymentMethods ?? users[idx].paymentMethods,
              defaultPaymentId: next.defaultPaymentId ?? users[idx].defaultPaymentId,
              twoFactorEnabled: next.twoFactorEnabled ?? users[idx].twoFactorEnabled,
              twoFactorType: next.twoFactorType ?? users[idx].twoFactorType,
              twoFactorSecret: next.twoFactorSecret ?? users[idx].twoFactorSecret,
              biometricEnabled: next.biometricEnabled ?? users[idx].biometricEnabled,
            };
            users[idx] = updated;
          } else {
            users.push({
              role: next.role,
              permissions: next.permissions ?? [],
              name: fullNameOf(next) || undefined,
              firstName: next.firstName,
              lastName: next.lastName,
              email: nextEmail || prev.email,
              phone: next.phone ? onlyDigits(next.phone) : undefined,
              address: next.address,
              createdAt: next.createdAt ?? new Date().toISOString(),
              stats: next.stats ?? { orders: 0, packages: 0, spend: 0 },
              paymentMethods: next.paymentMethods ?? [],
              defaultPaymentId: next.defaultPaymentId,
            });
          }

          users = dedupeByEmail(users);
          await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(users));

          const effectivePrev = storedAuth || prevEmail;
          if (effectivePrev !== nextEmail && nextEmail) {
            await AsyncStorage.setItem(KEYS.AUTH_EMAIL, nextEmail);
            await AsyncStorage.setItem(KEYS.CURRENT, nextEmail);
          }
        } catch (e) {
          console.warn('updateProfile persist error:', e);
        }
      })();

      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([KEYS.AUTH_EMAIL, KEYS.CURRENT, KEYS.PROFILE]);
    } finally {
      setUser(initialUser);
    }
  }, []);

  const grantAdmin = useCallback(async () => {
    setUser(prev => {
      const next: UserProfile = {
        ...prev,
        role: 'admin',
        permissions: Array.from(
          new Set([...(prev.permissions ?? []), 'product:create', 'panel:create'])
        ),
      };
      AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(next)).catch(() => {});
      (async () => {
        try {
          const usersRaw = await AsyncStorage.getItem(KEYS.USERS);
          let users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
          const email = normalizeEmail(next.email);
          const idx = users.findIndex((u: any) => normalizeEmail(u?.email) === email);
          if (idx >= 0) {
            users[idx] = { ...users[idx], role: next.role, permissions: next.permissions ?? [] };
            await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(users));
          }
        } catch {}
      })();
      return next;
    });
  }, []);

  /** 🧩 yeni: sipariş eklendiğinde sayaçları artır */
  const addOrder = useCallback(async (amount: number) => {
    setUser(prev => {
      const prevStats = prev.stats ?? { orders: 0, packages: 0, spend: 0 };
      const nextStats: UserStats = {
        orders: (prevStats.orders ?? 0) + 1,
        packages: prevStats.packages ?? 0,
        spend: (prevStats.spend ?? 0) + (Number(amount) || 0),
      };
      const next: UserProfile = { ...prev, stats: nextStats };
      AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(next)).catch(() => {});
      return next;
    });

    // USERS dizisini de güncelle
    try {
      const usersRaw = await AsyncStorage.getItem(KEYS.USERS);
      let users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
      const idx = users.findIndex((u: any) => normalizeEmail(u?.email) === normalizeEmail(user.email));
      if (idx >= 0) {
        const s = users[idx]?.stats ?? { orders: 0, packages: 0, spend: 0 };
        users[idx] = {
          ...users[idx],
          stats: {
            orders: (s.orders ?? 0) + 1,
            packages: s.packages ?? 0,
            spend: (s.spend ?? 0) + (Number(amount) || 0),
          },
        };
        await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(users));
      }
    } catch {}
  }, [user.email]);

  return (
    <UserContext.Provider
      value={{
        user,
        hydrateFromStorage,
        updateProfile,
        update: updateProfile,
        setUser,
        signOut,
        grantAdmin,
        addOrder,
        setStatsFromOrders,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within <UserProvider>');
  return ctx;
};
