import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

let AsyncStorage: any = null;
try {
  if (Platform.OS !== 'web') {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  }
} catch (error) {
  console.log('AsyncStorage not available, session will not persist');
}

const createCustomStorage = () => {
  if (!AsyncStorage) return undefined;

  return {
    getItem: async (key: string) => {
      try {
        return await AsyncStorage.getItem(key);
      } catch (error) {
        console.error('Error getting item from storage:', error);
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        await AsyncStorage.setItem(key, value);
      } catch (error) {
        console.error('Error setting item in storage:', error);
      }
    },
    removeItem: async (key: string) => {
      try {
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error('Error removing item from storage:', error);
      }
    },
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createCustomStorage(),
    autoRefreshToken: true,
    persistSession: AsyncStorage !== null,
    detectSessionInUrl: false,
  },
});
