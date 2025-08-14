// src/App.tsx
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ImageBackground, StatusBar } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
  CommonActions, // ✅ nested navigate için
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ✅ sadece migrasyon/temizlik yapan seed
import { seedProductsToStorage } from './utils/seedProductsToStorage';

// 🔎 dev’de “Text must be in <Text>” uyarısını hata yap
if (__DEV__) {
  const NEEDLE = 'Text strings must be rendered within a <Text>';
  const _warn = console.warn;
  const _error = console.error;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes(NEEDLE)) {
      throw new Error(args[0]);
    }
    _warn(...args);
  };
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes(NEEDLE)) {
      throw new Error(args[0]);
    }
    _error(...args);
  };
}

// Tipler
import { AccountStackParamList, RootStackParamList, TabParamList } from './types';

// App ekranları
import HomeScreen from './screens/HomeScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import CartScreen from './screens/CartScreen';
import ProductsScreen from './screens/ProductsScreen';

// Account alanı
import AccountScreen from './screens/account/AccountScreen';
import PersonalInfoScreen from './screens/account/PersonalInfoScreen';
import OrdersScreen from './screens/account/OrdersScreen';
import ActivePackagesScreen from './screens/account/ActivePackagesScreen';
import PaymentMethodsScreen from './screens/account/PaymentMethodsScreen';
import SecurityScreen from './screens/account/SecurityScreen';
import ExpensesScreen from './screens/account/ExpensesScreen';

// Auth
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import ResetPasswordScreen from './screens/auth/ResetPasswordScreen';

// Ekstra
import PackageDetailScreen from './screens/PackageDetailScreen';
import SupportScreen from './screens/support/SupportScreen';

// Admin
import PanelAddScreen from './screens/admin/PanelAddScreen';
import ProductAddScreen from './screens/admin/ProductAddScreen';

// Context
import { FavoritesProvider } from './context/favorites';
import { UserProvider } from './context/user';
import { CartProvider, useCart } from './components/sepeteekle';

const Tab = createBottomTabNavigator<TabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();

// === Global navigation ref & helper ===
export const navRef = createNavigationContainerRef<RootStackParamList>();

/** Ödeme/fatura sonrası Profil → Siparişlerim’e git (nested-safe) */
export function goToOrders() {
  if (!navRef.isReady()) return;
  navRef.dispatch(
    CommonActions.navigate({
      name: 'Tabs',
      params: {
        screen: 'Hesabım',
        params: { screen: 'Orders' },
      },
    })
  );
}

// === Account Stack (Profil alanı) ===
function AccountStackNav() {
  return (
    <AccountStack.Navigator screenOptions={{ headerShown: false }}>
      <AccountStack.Screen name="AccountHome" component={AccountScreen} />
      <AccountStack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <AccountStack.Screen name="Orders" component={OrdersScreen} />
      <AccountStack.Screen name="ActivePackages" component={ActivePackagesScreen} />
      <AccountStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <AccountStack.Screen name="Security" component={SecurityScreen} />
      <AccountStack.Screen name="Expenses" component={ExpensesScreen} />
    </AccountStack.Navigator>
  );
}

function AccountArea() {
  return <AccountStackNav />;
}

// === Tabs ===
function TabsNav() {
  const { items } = useCart();

  return (
    <Tab.Navigator
      initialRouteName="Anasayfa"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1C2C7E',
        tabBarInactiveTintColor: '#667085',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIcon: ({ color, size }) => {
          let icon: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Favoriler') icon = 'heart';
          else if (route.name === 'Sepetim') icon = 'bag';
          else if (route.name === 'Hesabım') icon = 'person';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Anasayfa" component={HomeScreen} />
      <Tab.Screen name="Favoriler" component={FavoritesScreen} />
      <Tab.Screen
        name="Sepetim"
        component={CartScreen}
        options={{
          tabBarBadge: items.length ? items.length : undefined,
          tabBarBadgeStyle: { backgroundColor: '#111827', color: '#fff' },
        }}
      />
      <Tab.Screen name="Hesabım" component={AccountArea} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2000);
    // sadece migrasyon/temizlik (demo veri yazmaz)
    seedProductsToStorage().catch(() => {});
    return () => clearTimeout(t);
  }, []);

  const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#FFFFFF' } };

  if (showSplash) {
    return (
      <View style={styles.splash}>
        <StatusBar hidden translucent />
        <ImageBackground
          source={require('../assets/splash.png')}
          style={styles.splashBg}
          imageStyle={styles.splashImg}
        />
      </View>
    );
  }

  return (
    <FavoritesProvider>
      <UserProvider>
        <CartProvider>
          <SafeAreaProvider>
            <NavigationContainer ref={navRef} theme={navTheme}>
              <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
                {/* Auth */}
                <RootStack.Screen name="Login" component={LoginScreen} />
                <RootStack.Screen name="Register" component={RegisterScreen} />
                <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} />

                {/* App Tabs */}
                <RootStack.Screen name="Tabs" component={TabsNav} />

                {/* Ürünler & Detay */}
                <RootStack.Screen name="Products" component={ProductsScreen} />
                <RootStack.Screen name="PackageDetail" component={PackageDetailScreen} />

                {/* Destek */}
                <RootStack.Screen
                  name="Support"
                  component={SupportScreen}
                  options={{ headerShown: true, title: 'Destek' }}
                />

                {/* Admin */}
                <RootStack.Screen
                  name="PanelAdd"
                  component={PanelAddScreen}
                  options={{ headerShown: true, title: 'Panel Ekle' }}
                />
                <RootStack.Screen
                  name="ProductAdd"
                  component={ProductAddScreen}
                  options={{ headerShown: true, title: 'Ürün Ekle (JSON)' }}
                />
              </RootStack.Navigator>
            </NavigationContainer>
          </SafeAreaProvider>
        </CartProvider>
      </UserProvider>
    </FavoritesProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#1C2C7E' },
  splashBg: { flex: 1, width: '100%', height: '100%' },
  splashImg: { resizeMode: 'cover' },
});
