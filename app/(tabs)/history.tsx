import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { CircleCheck as CheckCircle, Circle as XCircle, Clock, CreditCard, ListFilter as Filter } from 'lucide-react-native';

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  card_last_four?: string;
  card_brand?: string;
  transaction_reference?: string;
  error_message?: string;
  invoice_number?: string;
  created_at: string;
  completed_at?: string;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
      return;
    }
    loadTransactions();
  }, [user, filter]);

  const loadTransactions = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadTransactions(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} color="#16a34a" strokeWidth={2} />;
      case 'failed':
        return <XCircle size={20} color="#dc2626" strokeWidth={2} />;
      case 'pending':
        return <Clock size={20} color="#ca8a04" strokeWidth={2} />;
      default:
        return <Clock size={20} color="#64748b" strokeWidth={2} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#dcfce7';
      case 'failed':
        return '#fee2e2';
      case 'pending':
        return '#fef3c7';
      default:
        return '#f1f5f9';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#16a34a';
      case 'failed':
        return '#dc2626';
      case 'pending':
        return '#ca8a04';
      default:
        return '#64748b';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionStatus}>
          {getStatusIcon(item.status)}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusTextColor(item.status) },
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>
        <Text style={styles.transactionAmount}>
          {item.currency} ${item.amount.toFixed(2)}
        </Text>
      </View>

      <View style={styles.transactionDetails}>
        <View style={styles.detailRow}>
          <CreditCard size={16} color="#64748b" strokeWidth={2} />
          <Text style={styles.detailText}>
            {item.payment_method === 'nfc_card' ? 'Tarjeta NFC' : 'Manual'}
          </Text>
        </View>

        {item.invoice_number && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Factura:</Text>
            <Text style={styles.detailText}>{item.invoice_number}</Text>
          </View>
        )}

        {item.transaction_reference && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Ref:</Text>
            <Text style={styles.detailText}>{item.transaction_reference}</Text>
          </View>
        )}

        {item.error_message && (
          <Text style={styles.errorText}>{item.error_message}</Text>
        )}

        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'all' && styles.filterButtonTextActive,
            ]}
          >
            Todas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'completed' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('completed')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'completed' && styles.filterButtonTextActive,
            ]}
          >
            Exitosas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'pending' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('pending')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'pending' && styles.filterButtonTextActive,
            ]}
          >
            Pendientes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'failed' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('failed')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'failed' && styles.filterButtonTextActive,
            ]}
          >
            Fallidas
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Filter size={48} color="#cbd5e1" strokeWidth={2} />
            <Text style={styles.emptyText}>No hay transacciones</Text>
          </View>
        }
      />
    </View>
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
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transactionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  transactionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  detailText: {
    fontSize: 12,
    color: '#64748b',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    fontStyle: 'italic',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 16,
  },
});
