import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import QRCode from 'react-native-qrcode-svg';
import { QrCode, DollarSign, RefreshCw, Share2 } from 'lucide-react-native';

export default function QRPaymentScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');
  const [qrData, setQrData] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [activeGateway, setActiveGateway] = useState<any>(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
      return;
    }
    loadMercadoPagoConfig();
  }, [user]);

  const loadMercadoPagoConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('gateway_name', 'mercadopago')
        .eq('is_active', true)
        .limit(1);

      if (data && data.length > 0) {
        setActiveGateway(data[0]);
      } else {
        Alert.alert(
          'Configuración requerida',
          'Debes configurar Mercado Pago en la sección de Ajustes primero.'
        );
      }
    } catch (error) {
      console.error('Error loading Mercado Pago config:', error);
    }
  };

  const generateQRPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    if (!activeGateway) {
      Alert.alert('Error', 'Mercado Pago no está configurado');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-mercadopago-payment`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency: activeGateway.currency || 'UYU',
          description: description || 'Pago POS Mobile',
          customer_email: customerEmail || undefined,
          customer_name: customerName || undefined,
          access_token: activeGateway.api_key,
          is_sandbox: activeGateway.is_sandbox,
          external_reference: `pos-${user!.id}-${Date.now()}`,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al generar el pago');
      }

      const link = result.payment_link || result.external_resource_url;
      setPaymentLink(link);
      setQrData(link);
      setPaymentId(result.payment_id);
      setShowQR(true);

      const transactionData = {
        user_id: user!.id,
        gateway_id: activeGateway.id,
        amount: parseFloat(amount),
        currency: activeGateway.currency || 'UYU',
        status: 'pending',
        payment_method: 'qr',
        gateway_transaction_id: result.payment_id,
        gateway_response: result.full_response,
      };

      await supabase.from('transactions').insert(transactionData);
    } catch (error: any) {
      console.error('Error generating QR payment:', error);
      Alert.alert('Error', error.message || 'No se pudo generar el código QR');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setCustomerEmail('');
    setCustomerName('');
    setPaymentLink('');
    setQrData('');
    setPaymentId('');
    setShowQR(false);
  };

  const sharePaymentLink = () => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(paymentLink);
      Alert.alert('Copiado', 'El link de pago ha sido copiado al portapapeles');
    } else {
      Alert.alert('Link de pago', paymentLink, [
        { text: 'Cerrar', style: 'cancel' },
      ]);
    }
  };

  if (!activeGateway) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pago con QR</Text>
        </View>
        <View style={styles.centerContainer}>
          <View style={styles.emptyCard}>
            <QrCode size={64} color="#94a3b8" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Mercado Pago no configurado</Text>
            <Text style={styles.emptySubtitle}>
              Ve a Ajustes y configura tu cuenta de Mercado Pago primero
            </Text>
            <TouchableOpacity
              style={styles.configButton}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <Text style={styles.configButtonText}>Ir a Ajustes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pago con QR</Text>
        <View style={styles.gatewayBadge}>
          <Text style={styles.gatewayText}>
            MERCADO PAGO {activeGateway.is_sandbox && '(Test)'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!showQR ? (
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Crear nuevo pago</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monto *</Text>
              <View style={styles.amountInput}>
                <DollarSign size={20} color="#94a3b8" strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.currency}>{activeGateway.currency || 'UYU'}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="Ej: Venta de productos"
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre del cliente (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textInput]}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Juan Pérez"
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email del cliente (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textInput]}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                placeholder="cliente@email.com"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.generateButton, loading && styles.buttonDisabled]}
              onPress={generateQRPayment}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <QrCode size={24} color="#fff" strokeWidth={2} />
                  <Text style={styles.generateButtonText}>Generar código QR</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Escanea el código QR</Text>

            <View style={styles.qrContainer}>
              <QRCode value={qrData} size={250} backgroundColor="#fff" />
            </View>

            <View style={styles.amountDisplay}>
              <Text style={styles.amountDisplayLabel}>Monto a pagar</Text>
              <Text style={styles.amountDisplayValue}>
                {activeGateway.currency || 'UYU'} ${parseFloat(amount).toFixed(2)}
              </Text>
            </View>

            {description && (
              <Text style={styles.descriptionText}>{description}</Text>
            )}

            <View style={styles.qrActions}>
              <TouchableOpacity style={styles.actionButton} onPress={sharePaymentLink}>
                <Share2 size={20} color="#3b82f6" strokeWidth={2} />
                <Text style={styles.actionButtonText}>Compartir link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={resetForm}
              >
                <RefreshCw size={20} color="#fff" strokeWidth={2} />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                  Nuevo pago
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.instructionText}>
              El cliente debe escanear este código QR con la app de Mercado Pago para completar
              el pago
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  gatewayBadge: {
    backgroundColor: '#00b0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  gatewayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    maxWidth: 400,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  configButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  configButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    paddingVertical: 14,
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  currency: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  generateButton: {
    backgroundColor: '#00b0f0',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  qrCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  qrTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  amountDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  amountDisplayLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  amountDisplayValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#00b0f0',
  },
  descriptionText: {
    fontSize: 16,
    color: '#e2e8f0',
    textAlign: 'center',
    marginBottom: 24,
  },
  qrActions: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#334155',
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: '#3b82f6',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  instructionText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
