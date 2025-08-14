// src/screens/auth/RequireRole.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useUser } from '../../context/user';

type Role = 'admin' | 'manager' | 'user';

type Props = {
  requiredRole?: Role;
  requiredPerm?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

// App user'ını esnek yorumlayalım (role/permissions opsiyonel olabilir)
type AppUser = {
  role?: Role;
  permissions?: string[];
};

// Rol hiyerarşisi: admin(3) > manager(2) > user(1) > anon(0)
const rank = (r?: Role) => (r === 'admin' ? 3 : r === 'manager' ? 2 : r === 'user' ? 1 : 0);

// Tek nodu güvenle renderla: text/number → <Text>, boolean/null/undefined → null, element → aynen
function renderSafe(node: React.ReactNode, key?: React.Key): React.ReactNode {
  if (node == null || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') {
    return <Text key={key}>{node}</Text>;
  }
  if (Array.isArray(node)) {
    return node.map((n, i) => renderSafe(n, i));
  }
  // React element veya diğer tipler
  return node as React.ReactElement;
}

export default function RequireRole({
  requiredRole = 'admin',
  requiredPerm,
  children,
  fallback,
}: Props) {
  const { user } = useUser();
  const u = (user ?? {}) as AppUser;

  const hasRole = rank(u.role) >= rank(requiredRole);
  const hasPerm = requiredPerm ? (u.permissions ?? []).includes(requiredPerm) : true;
  const allowed = !!user && hasRole && hasPerm;

  if (!allowed) {
    const fb =
      fallback ??
      (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#1C2C7E', marginBottom: 6 }}>
            403
          </Text>
          <Text style={{ color: '#6B7280' }}>Bu sayfa için yetkiniz yok.</Text>
        </View>
      );

    return <>{renderSafe(fb)}</>;
  }

  return <>{renderSafe(children)}</>;
}
