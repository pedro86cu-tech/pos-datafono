import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CircleCheck as CheckCircle } from 'lucide-react-native';

export default function PaymentSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.replace('/(tabs)');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <CheckCircle size={80} color="#10b981" strokeWidth={2} />

        <Text style={styles.title}>¡Pago Exitoso!</Text>

        <Text style={styles.message}>
          Tu pago ha sido procesado correctamente
        </Text>

        {params.payment_id && (
          <Text style={styles.paymentId}>
            ID de pago: {params.payment_id}
          </Text>
        )}

        <View style={styles.redirectContainer}>
          <ActivityIndicator size="small" color="#10b981" />
          <Text style={styles.redirectText}>
            Redirigiendo en {countdown}...
          </Text>
        </View>
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
    color: '#10b981',
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
    marginBottom: 24,
  },
  redirectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redirectText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
