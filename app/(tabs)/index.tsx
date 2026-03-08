import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CreditCard, TrendingUp, DollarSign, Clock, LogOut } from 'lucide-react-native';

interface Stats {
  todayTotal: number;
  todayCount: number;
  weekTotal: number;
  pendingCount: number;
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    todayTotal: 0,
    todayCount: 0,
    weekTotal: 0,
    pendingCount: 0,
  });
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
      return;
    }
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      const [todayResult, weekResult, pendingResult, configResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('amount')
          .eq('status', 'completed')
          .gte('created_at', today.toISOString()),
        supabase
          .from('transactions')
          .select('amount')
          .eq('status', 'completed')
          .gte('created_at', weekAgo.toISOString()),
        supabase
          .from('transactions')
          .select('id', { count: 'exact' })
          .eq('status', 'pending'),
        supabase
          .from('pos_configurations')
          .select('id')
          .maybeSingle(),
      ]);

      const todayTotal = todayResult.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const weekTotal = weekResult.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      setStats({
        todayTotal,
        todayCount: todayResult.data?.length || 0,
        weekTotal,
        pendingCount: pendingResult.count || 0,
      });

      setHasConfig(!!configResult.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/auth');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {!hasConfig && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Configuración requerida</Text>
            <Text style={styles.warningText}>
              Configura tu negocio y pasarela de pago en la sección de Configuración
            </Text>
            <TouchableOpacity
              style={styles.warningButton}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <Text style={styles.warningButtonText}>Configurar ahora</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
            <DollarSign size={32} color="#2563eb" strokeWidth={2} />
            <Text style={styles.statValue}>${stats.todayTotal.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Ventas hoy</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
            <TrendingUp size={32} color="#16a34a" strokeWidth={2} />
            <Text style={styles.statValue}>{stats.todayCount}</Text>
            <Text style={styles.statLabel}>Transacciones hoy</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <CreditCard size={32} color="#ca8a04" strokeWidth={2} />
            <Text style={styles.statValue}>${stats.weekTotal.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Ventas semana</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
            <Clock size={32} color="#dc2626" strokeWidth={2} />
            <Text style={styles.statValue}>{stats.pendingCount}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(tabs)/payment')}
        >
          <CreditCard size={24} color="#fff" strokeWidth={2} />
          <Text style={styles.primaryButtonText}>Procesar Pago</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#dc2626" strokeWidth={2} />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  warningCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#854d0e',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#713f12',
    marginBottom: 12,
  },
  warningButton: {
    backgroundColor: '#ca8a04',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  warningButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '500',
  },
});
