# 💡 Ejemplos de Integración - API de Reembolsos

Ejemplos prácticos de cómo integrar la funcionalidad de reembolsos en diferentes escenarios.

---

## 📱 Ejemplo 1: Reembolso Desde Historial de Transacciones

Este ejemplo muestra cómo agregar un botón de reembolso en el historial de transacciones.

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from './lib/supabase';

interface Transaction {
  id: string;
  amount: number;
  status: string;
  gateway_transaction_id: string;
  created_at: string;
}

interface RefundButtonProps {
  transaction: Transaction;
  onRefundComplete: () => void;
}

function RefundButton({ transaction, onRefundComplete }: RefundButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleRefund = async () => {
    // Confirmar con el usuario
    Alert.alert(
      'Confirmar Reembolso',
      `¿Estás seguro de reembolsar $${transaction.amount}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reembolsar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              // Obtener access token
              const { data: user } = await supabase.auth.getUser();
              const { data: apiKey } = await supabase
                .from('api_keys')
                .select('mercadopago_access_token')
                .eq('user_id', user.user?.id)
                .single();

              if (!apiKey?.mercadopago_access_token) {
                Alert.alert('Error', 'No se encontró el access token');
                return;
              }

              // Procesar reembolso
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/refund-mercadopago-payment`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                  },
                  body: JSON.stringify({
                    payment_id: parseInt(transaction.gateway_transaction_id),
                    access_token: apiKey.mercadopago_access_token,
                    transaction_id: transaction.id,
                    reason: 'Reembolso solicitado desde la app',
                  }),
                }
              );

              const result = await response.json();

              if (result.success) {
                Alert.alert(
                  'Éxito',
                  `Reembolso procesado: $${result.amount_refunded}`
                );
                onRefundComplete();
              } else {
                Alert.alert('Error', result.error);
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Solo mostrar si la transacción está completada y no ha sido reembolsada
  if (transaction.status !== 'completed') {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={handleRefund}
      disabled={loading}
      style={{
        backgroundColor: '#ff3b30',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: '#fff', fontWeight: '600' }}>Reembolsar</Text>
      )}
    </TouchableOpacity>
  );
}

export default RefundButton;
```

---

## 🎯 Ejemplo 2: Reembolso Parcial con Selección de Monto

Permite al usuario ingresar el monto exacto a reembolsar.

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { supabase } from './lib/supabase';

interface PartialRefundModalProps {
  visible: boolean;
  transaction: {
    id: string;
    amount: number;
    gateway_transaction_id: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

function PartialRefundModal({
  visible,
  transaction,
  onClose,
  onSuccess,
}: PartialRefundModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const processPartialRefund = async () => {
    const refundAmount = parseFloat(amount);

    // Validaciones
    if (isNaN(refundAmount) || refundAmount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    if (refundAmount > transaction.amount) {
      Alert.alert(
        'Error',
        `El monto no puede ser mayor a $${transaction.amount}`
      );
      return;
    }

    try {
      setLoading(true);

      // Obtener access token
      const { data: user } = await supabase.auth.getUser();
      const { data: apiKey } = await supabase
        .from('api_keys')
        .select('mercadopago_access_token')
        .eq('user_id', user.user?.id)
        .single();

      if (!apiKey?.mercadopago_access_token) {
        Alert.alert('Error', 'No se encontró el access token');
        return;
      }

      // Procesar reembolso
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/refund-mercadopago-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            payment_id: parseInt(transaction.gateway_transaction_id),
            amount: refundAmount,
            access_token: apiKey.mercadopago_access_token,
            transaction_id: transaction.id,
            reason: `Reembolso parcial de $${refundAmount}`,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        Alert.alert('Éxito', `Reembolsado: $${result.amount_refunded}`);
        onSuccess();
        onClose();
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Reembolso Parcial</Text>
          <Text style={styles.modalSubtitle}>
            Monto total: ${transaction.amount}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Monto a reembolsar"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            editable={!loading}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={processPartialRefund}
              disabled={loading}
            >
              <Text style={styles.confirmButtonText}>
                {loading ? 'Procesando...' : 'Reembolsar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  confirmButton: {
    backgroundColor: '#ff3b30',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default PartialRefundModal;
```

---

## 🔄 Ejemplo 3: Consultar Estado de Reembolsos

Muestra todos los reembolsos realizados para una transacción.

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from './lib/supabase';

interface Refund {
  id: string;
  refund_id: string;
  amount: number;
  status: string;
  reason: string;
  created_at: string;
}

interface RefundListProps {
  transactionId: string;
}

function RefundList({ transactionId }: RefundListProps) {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRefunds();
  }, [transactionId]);

  const fetchRefunds = async () => {
    try {
      const { data, error } = await supabase
        .from('refunds')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRefunds(data || []);
    } catch (error) {
      console.error('Error fetching refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderRefund = ({ item }: { item: Refund }) => (
    <View style={styles.refundCard}>
      <View style={styles.refundHeader}>
        <Text style={styles.refundAmount}>${item.amount}</Text>
        <View
          style={[
            styles.statusBadge,
            item.status === 'approved' && styles.statusApproved,
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.refundId}>ID: {item.refund_id}</Text>
      {item.reason && <Text style={styles.refundReason}>{item.reason}</Text>}
      <Text style={styles.refundDate}>
        {new Date(item.created_at).toLocaleDateString('es-UY', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009EE3" />
      </View>
    );
  }

  if (refunds.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay reembolsos registrados</Text>
      </View>
    );
  }

  const totalRefunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Reembolsado</Text>
        <Text style={styles.summaryAmount}>${totalRefunded.toFixed(2)}</Text>
        <Text style={styles.summaryCount}>
          {refunds.length} reembolso{refunds.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={refunds}
        renderItem={renderRefund}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  summaryCard: {
    backgroundColor: '#009EE3',
    padding: 20,
    borderRadius: 12,
    margin: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
  },
  summaryAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  summaryCount: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
  },
  listContainer: {
    padding: 16,
  },
  refundCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  refundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refundAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  statusApproved: {
    backgroundColor: '#d4edda',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  refundId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  refundReason: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  refundDate: {
    fontSize: 12,
    color: '#999',
  },
});

export default RefundList;
```

---

## 🔔 Ejemplo 4: Hook Personalizado para Reembolsos

Un hook reutilizable para manejar la lógica de reembolsos.

```typescript
import { useState } from 'react';
import { supabase } from './lib/supabase';

interface UseRefundOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function useRefund(options?: UseRefundOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processRefund = async (
    paymentId: number,
    amount?: number,
    reason?: string,
    transactionId?: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Obtener access token
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('Usuario no autenticado');
      }

      const { data: apiKey } = await supabase
        .from('api_keys')
        .select('mercadopago_access_token')
        .eq('user_id', user.user.id)
        .single();

      if (!apiKey?.mercadopago_access_token) {
        throw new Error('Access token no encontrado');
      }

      // Preparar request
      const body: any = {
        payment_id: paymentId,
        access_token: apiKey.mercadopago_access_token,
      };

      if (amount) body.amount = amount;
      if (reason) body.reason = reason;
      if (transactionId) body.transaction_id = transactionId;

      // Llamar a la función edge
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/refund-mercadopago-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al procesar reembolso');
      }

      options?.onSuccess?.(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Error desconocido';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchRefunds = async (transactionId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('refunds')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    processRefund,
    fetchRefunds,
    loading,
    error,
  };
}

// Uso del hook
function MyComponent() {
  const { processRefund, loading } = useRefund({
    onSuccess: (result) => {
      console.log('Reembolso exitoso:', result);
    },
    onError: (error) => {
      console.error('Error:', error);
    },
  });

  const handleRefund = async () => {
    await processRefund(123456789, 50.00, 'Reembolso parcial');
  };

  return (
    // Tu UI aquí
  );
}
```

---

## 📊 Ejemplo 5: Dashboard de Reembolsos

Panel de administración para ver estadísticas de reembolsos.

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { supabase } from './lib/supabase';

interface RefundStats {
  total_refunds: number;
  total_amount: number;
  approved: number;
  pending: number;
  rejected: number;
}

function RefundDashboard() {
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Obtener todos los refunds del usuario
      const { data: refunds } = await supabase
        .from('refunds')
        .select(`
          *,
          transactions!inner(user_id)
        `)
        .eq('transactions.user_id', user.user.id);

      if (refunds) {
        const stats: RefundStats = {
          total_refunds: refunds.length,
          total_amount: refunds.reduce((sum, r) => sum + Number(r.amount), 0),
          approved: refunds.filter((r) => r.status === 'approved').length,
          pending: refunds.filter((r) => r.status === 'pending').length,
          rejected: refunds.filter((r) => r.status === 'rejected').length,
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <Text>Cargando...</Text>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Dashboard de Reembolsos</Text>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.totalCard]}>
          <Text style={styles.statValue}>{stats.total_refunds}</Text>
          <Text style={styles.statLabel}>Total Reembolsos</Text>
        </View>

        <View style={[styles.statCard, styles.amountCard]}>
          <Text style={styles.statValue}>${stats.total_amount.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Monto Total</Text>
        </View>

        <View style={[styles.statCard, styles.approvedCard]}>
          <Text style={styles.statValue}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Aprobados</Text>
        </View>

        <View style={[styles.statCard, styles.pendingCard]}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>

        <View style={[styles.statCard, styles.rejectedCard]}>
          <Text style={styles.statValue}>{stats.rejected}</Text>
          <Text style={styles.statLabel}>Rechazados</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  totalCard: {
    backgroundColor: '#009EE3',
  },
  amountCard: {
    backgroundColor: '#00B4CC',
  },
  approvedCard: {
    backgroundColor: '#28a745',
  },
  pendingCard: {
    backgroundColor: '#ffc107',
  },
  rejectedCard: {
    backgroundColor: '#dc3545',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 14,
    color: '#fff',
    marginTop: 5,
  },
});

export default RefundDashboard;
```

---

## 🎨 Mejores Prácticas

1. **Validación**: Siempre valida el monto antes de procesar
2. **Confirmación**: Pide confirmación al usuario antes de reembolsar
3. **Feedback**: Muestra el estado del proceso claramente
4. **Logs**: Registra todos los reembolsos para auditoría
5. **Errores**: Maneja errores de forma clara y útil

---

¡Usa estos ejemplos como base para implementar reembolsos en tu aplicación! 🚀
