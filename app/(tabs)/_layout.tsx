import { Tabs } from 'expo-router';
import { Hop as Home, CreditCard, Settings, History, QrCode } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#e2e8f0',
        },
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '600',
          color: '#1e293b',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          headerTitle: 'POS Mobile',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          title: 'Cobrar',
          headerTitle: 'Procesar Pago',
          tabBarIcon: ({ size, color }) => (
            <CreditCard size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="qr-payment"
        options={{
          title: 'QR',
          headerTitle: 'Pago con QR',
          tabBarIcon: ({ size, color }) => (
            <QrCode size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          headerTitle: 'Transacciones',
          tabBarIcon: ({ size, color }) => (
            <History size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Configuración',
          headerTitle: 'Configuración',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
