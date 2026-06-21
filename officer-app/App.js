import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { officerLogin } from './src/lib/api';

const Stack = createNativeStackNavigator();

// Handles deep links like: intellipark://login?badge=BTP-A1&password=officer123
// This is what the dashboard QR code encodes, so scanning auto-fills and
// auto-submits the login without the officer typing anything.
function useDeepLinkAutoLogin(navigationRef) {
  const handled = useRef(false);

  useEffect(() => {
    async function processUrl(url) {
      if (!url || handled.current) return;
      const parsed = Linking.parse(url);
      const { badge, password } = parsed.queryParams || {};
      if (badge && password) {
        handled.current = true;
        try {
          const data = await officerLogin(String(badge), String(password));
          navigationRef.current?.reset({
            index: 0,
            routes: [{ name: 'Home', params: { officer: data.officer } }],
          });
        } catch (e) {
          console.warn('Auto-login from QR failed', e);
          handled.current = false;
        }
      }
    }

    Linking.getInitialURL().then(processUrl);
    const sub = Linking.addEventListener('url', ({ url }) => processUrl(url));
    return () => sub.remove();
  }, []);
}

export default function App() {
  const navigationRef = useRef(null);
  useDeepLinkAutoLogin(navigationRef);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
