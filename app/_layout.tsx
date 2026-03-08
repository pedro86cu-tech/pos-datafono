import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';

let StripeProvider: any = null;
if (Platform.OS !== 'web') {
  try {
    const StripeModule = require('@stripe/stripe-react-native');
    StripeProvider = StripeModule.StripeProvider;
  } catch (error) {
    console.log('Stripe SDK not available');
  }
}

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export default function RootLayout() {
  useFrameworkReady();

  const content = (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  );

  if (Platform.OS !== 'web' && StripeProvider) {
    return (
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        {content}
      </StripeProvider>
    );
  }

  return content;
}
