import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Circle as XCircle } from 'lucide-react-native';

export default function PaymentFailure() {
  const router = useRouter();
  const params = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <XCircle size={80} color="#ef4444" strokeWidth={2} />

        <Text style={styles.title}>Pago Rechazado</Text>

        <Text style={styles.message}>
          Lo sentimos, no pudimos procesar tu pago
        </Text>

        {params.payment_id && (
          <Text style={styles.paymentId}>
            ID de pago: {params.payment_id}
          </Text>
        )}

        <Text style={styles.helpText}>
          Por favor, verifica tus datos de pago e intenta nuevamente
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.buttonText}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 24,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  paymentId: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
