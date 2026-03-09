/**
 * Componente de Ejemplo: RefundManager
 *
 * Este componente muestra cómo implementar la funcionalidad de reembolsos
 * en una aplicación React Native usando Expo.
 *
 * IMPORTANTE: Este es un archivo de ejemplo. NO lo uses directamente en producción
 * sin antes adaptarlo a tus necesidades específicas.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from './lib/supabase';

interface RefundRequest {
  payment_id: number;
  amount?: number;
  reason?: string;
  transaction_id?: string;
}

interface RefundResult {
  success: boolean;
  refund_id?: number;
  payment_id?: number;
  amount_refunded?: number;
  status?: string;
  refund_type?: 'total' | 'partial';
  error?: string;
  details?: any;
}

export default function RefundManagerExample() {
  const [paymentId, setPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RefundResult | null>(null);

  /**
   * Procesa un reembolso total o parcial
   */
  const processRefund = async (isPartial: boolean) => {
    try {
      setLoading(true);
      setResult(null);

      // Validaciones
      if (!paymentId) {
        Alert.alert('Error', 'Por favor ingresa el ID del pago');
        return;
      }

      if (isPartial && !refundAmount) {
        Alert.alert('Error', 'Por favor ingresa el monto a reembolsar');
        return;
      }

      // Obtener el access token del usuario actual
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        Alert.alert('Error', 'Debes iniciar sesión');
        return;
      }

      const { data: apiKey } = await supabase
        .from('api_keys')
        .select('mercadopago_access_token')
        .eq('user_id', userData.user.id)
        .single();

      if (!apiKey?.mercadopago_access_token) {
        Alert.alert(
          'Error',
          'No se encontró el access token de Mercado Pago. Por favor configúralo en ajustes.'
        );
        return;
      }

      // Preparar el request
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const requestBody: RefundRequest = {
        payment_id: parseInt(paymentId),
        access_token: apiKey.mercadopago_access_token,
      };

      if (isPartial && refundAmount) {
        requestBody.amount = parseFloat(refundAmount);
      }

      if (reason) {
        requestBody.reason = reason;
      }

      console.log('Procesando reembolso:', requestBody);

      // Llamar a la función edge
      const response = await fetch(
        `${supabaseUrl}/functions/v1/refund-mercadopago-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data: RefundResult = await response.json();
      setResult(data);

      if (data.success) {
        Alert.alert(
          'Éxito',
          `Reembolso ${data.refund_type === 'total' ? 'total' : 'parcial'} procesado correctamente.\n\nMonto: $${data.amount_refunded}\nRefund ID: ${data.refund_id}`
        );

        // Limpiar formulario
        setPaymentId('');
        setRefundAmount('');
        setReason('');
      } else {
        Alert.alert('Error', data.error || 'Error al procesar el reembolso');
      }
    } catch (error: any) {
      console.error('Error al procesar reembolso:', error);
      Alert.alert('Error', error.message || 'Error al procesar el reembolso');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Consulta los reembolsos realizados para un pago
   */
  const fetchRefundsForPayment = async () => {
    try {
      if (!paymentId) {
        Alert.alert('Error', 'Por favor ingresa el ID del pago');
        return;
      }

      const { data: refunds, error } = await supabase
        .from('refunds')
        .select('*')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (refunds && refunds.length > 0) {
        const totalRefunded = refunds.reduce(
          (sum, r) => sum + parseFloat(r.amount.toString()),
          0
        );

        Alert.alert(
          'Reembolsos Encontrados',
          `Total de reembolsos: ${refunds.length}\nMonto total reembolsado: $${totalRefunded.toFixed(2)}`
        );
      } else {
        Alert.alert('Info', 'No se encontraron reembolsos para este pago');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Gestión de Reembolsos</Text>
        <Text style={styles.subtitle}>Mercado Pago</Text>

        {/* Payment ID Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>ID del Pago *</Text>
          <TextInput
            style={styles.input}
            placeholder="123456789"
            value={paymentId}
            onChangeText={setPaymentId}
            keyboardType="numeric"
            editable={!loading}
          />
        </View>

        {/* Refund Amount Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Monto a Reembolsar</Text>
          <Text style={styles.hint}>
            (Dejar vacío para reembolso total)
          </Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={refundAmount}
            onChangeText={setRefundAmount}
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </View>

        {/* Reason Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Razón (Opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ej: Cliente solicitó devolución"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            editable={!loading}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => processRefund(false)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Reembolso Total</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => processRefund(true)}
            disabled={loading || !refundAmount}
          >
            <Text style={styles.buttonText}>Reembolso Parcial</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonOutline]}
            onPress={fetchRefundsForPayment}
            disabled={loading}
          >
            <Text style={[styles.buttonText, styles.buttonTextOutline]}>
              Consultar Reembolsos
            </Text>
          </TouchableOpacity>
        </View>

        {/* Result Display */}
        {result && (
          <View
            style={[
              styles.resultContainer,
              result.success ? styles.resultSuccess : styles.resultError,
            ]}
          >
            <Text style={styles.resultTitle}>
              {result.success ? '✅ Éxito' : '❌ Error'}
            </Text>
            {result.success ? (
              <>
                <Text style={styles.resultText}>
                  Refund ID: {result.refund_id}
                </Text>
                <Text style={styles.resultText}>
                  Monto: ${result.amount_refunded}
                </Text>
                <Text style={styles.resultText}>
                  Estado: {result.status}
                </Text>
                <Text style={styles.resultText}>
                  Tipo: {result.refund_type === 'total' ? 'Total' : 'Parcial'}
                </Text>
              </>
            ) : (
              <Text style={styles.resultText}>{result.error}</Text>
            )}
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Información Importante</Text>
          <Text style={styles.infoText}>
            • Los reembolsos pueden tardar varios días en procesarse
          </Text>
          <Text style={styles.infoText}>
            • No se puede reembolsar más que el monto original
          </Text>
          <Text style={styles.infoText}>
            • Verifica que el pago esté aprobado antes de reembolsar
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttonGroup: {
    marginTop: 10,
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonPrimary: {
    backgroundColor: '#009EE3',
  },
  buttonSecondary: {
    backgroundColor: '#00B4CC',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#009EE3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextOutline: {
    color: '#009EE3',
  },
  resultContainer: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  resultSuccess: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
  },
  resultError: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    marginBottom: 5,
  },
  infoBox: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#856404',
  },
});
