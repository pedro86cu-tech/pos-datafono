import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { CreditCard, CircleCheck as CheckCircle, Circle as XCircle, Nfc, Smartphone, Receipt, RefreshCw, QrCode, DollarSign, ArrowRightLeft } from 'lucide-react-native';

let useStripe: any = null;
if (Platform.OS !== 'web') {
  try {
    const StripeModule = require('@stripe/stripe-react-native');
    useStripe = StripeModule.useStripe;
  } catch (error) {
    console.log('Stripe SDK not available');
  }
}

type ScreenState = 'waiting' | 'payment_ready' | 'processing' | 'success' | 'error';

interface PaymentRequest {
  id: string;
  amount: number;
  currency: string;
  customer_name?: string;
  customer_email?: string;
  note?: string;
  items?: any[];
  external_sale_id?: string;
  callback_url?: string;
  payment_type?: string;
}

interface PaymentResult {
  card_last4?: string;
  card_brand?: string;
  transaction_id?: string;
  qr_code?: string;
  qr_code_base64?: string;
  payment_link?: string;
}

export default function POSScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const stripe = Platform.OS !== 'web' && useStripe ? useStripe() : null;

  const [screenState, setScreenState] = useState<ScreenState>('waiting');
  const [currentRequest, setCurrentRequest] = useState<PaymentRequest | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [activeGateway, setActiveGateway] = useState<any>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
      return;
    }
    loadConfig();
    const cleanup = setupRealtimeListener();
    return cleanup;
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadConfig();
      checkForPendingRequests();
    }, [])
  );

  useEffect(() => {
    if (screenState === 'processing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [screenState]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (data && data.length > 0) {
        setActiveGateway(data[0]);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const checkForPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setCurrentRequest(data[0]);
        setScreenState('payment_ready');
      }
    } catch (error) {
      console.error('Error checking pending requests:', error);
    }
  };

  const setupRealtimeListener = () => {
    const channel = supabase
      .channel('payment_requests_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payment_requests',
          filter: `user_id=eq.${user!.id}`,
        },
        (payload) => {
          console.log('New payment request:', payload);
          if (payload.new.status === 'pending') {
            setCurrentRequest(payload.new as PaymentRequest);
            setScreenState('payment_ready');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user!.id}`,
        },
        (payload) => {
          console.log('Transaction updated:', payload);

          if (payload.new.status === 'completed' && screenState === 'processing') {
            const transactionId = payload.new.id;

            setPaymentResult(prev => ({
              ...prev,
              transaction_id: transactionId,
            }));

            setScreenState('success');
          } else if (payload.new.status === 'failed' && screenState === 'processing') {
            setScreenState('error');
            setTimeout(() => resetToWaiting(), 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const startPayment = async () => {
    if (!currentRequest) {
      Alert.alert('Error', 'No hay solicitud de pago');
      return;
    }

    const paymentType = currentRequest.payment_type || 'card_debit';

    if (paymentType === 'qr_mp') {
      await processMercadoPagoQR();
      return;
    }

    if (!activeGateway) {
      Alert.alert('Error', 'No hay pasarela activa');
      return;
    }

    setScreenState('processing');

    await supabase
      .from('payment_requests')
      .update({ status: 'processing' })
      .eq('id', currentRequest.id);

    if (activeGateway.gateway_name === 'stripe' && stripe) {
      await processStripePayment();
    } else {
      await processGenericPayment();
    }
  };

  const processStripePayment = async () => {
    let transactionId: string | null = null;

    try {
      const transactionData = {
        user_id: user!.id,
        gateway_id: activeGateway.id,
        amount: currentRequest!.amount,
        currency: currentRequest!.currency,
        status: 'pending',
        payment_method: 'card',
      };

      const { data: transaction, error: insertError } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (insertError) throw insertError;
      transactionId = transaction.id;

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-payment`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: transaction.id,
          amount: currentRequest!.amount,
          currency: currentRequest!.currency,
          gateway_name: 'stripe',
          api_key: activeGateway.api_key,
          is_sandbox: activeGateway.is_sandbox,
        }),
      });

      const result = await response.json();

      if (!result.success || !result.gateway_response?.client_secret) {
        throw new Error(result.error || 'Error al crear el pago');
      }

      const { error: initError } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: result.gateway_response.client_secret,
        merchantDisplayName: 'POS Mobile',
        applePay: {
          merchantCountryCode: 'US',
        },
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: activeGateway.is_sandbox,
        },
        allowsDelayedPaymentMethods: true,
      });

      if (initError) {
        throw new Error(initError.message);
      }

      const { error: presentError } = await stripe.presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          await handlePaymentError(transaction.id, 'Pago cancelado por el usuario');
        } else {
          await handlePaymentError(transaction.id, presentError.message);
        }
        return;
      }

      await handlePaymentSuccess(transaction.id, {
        card_last4: null,
        card_brand: null,
      });
    } catch (error: any) {
      console.error('Stripe payment error:', error);

      if (transactionId) {
        await handlePaymentError(transactionId, error.message || 'Error desconocido');
      } else {
        setScreenState('error');
        setTimeout(() => resetToWaiting(), 3000);
      }
    }
  };

  const processGenericPayment = async () => {
    let transactionId: string | null = null;

    try {
      const transactionData = {
        user_id: user!.id,
        gateway_id: activeGateway.id,
        amount: currentRequest!.amount,
        currency: currentRequest!.currency,
        status: 'completed',
        payment_method: 'manual',
      };

      const { data: transaction, error } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error) throw error;
      transactionId = transaction.id;

      await handlePaymentSuccess(transaction.id, {});
    } catch (error: any) {
      console.error('Payment error:', error);

      if (transactionId) {
        await handlePaymentError(transactionId, error.message || 'Error en el pago');
      } else {
        if (currentRequest) {
          const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/confirm-payment`;
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_request_id: currentRequest.id,
              transaction_id: null,
              status: 'failed',
              error_message: error.message || 'Error al crear la transacción',
            }),
          });
        }

        setScreenState('error');
        setTimeout(() => resetToWaiting(), 3000);
      }
    }
  };

  const processMercadoPagoQR = async () => {
    let transactionId: string | null = null;

    try {
      setScreenState('processing');

      await supabase
        .from('payment_requests')
        .update({ status: 'processing' })
        .eq('id', currentRequest!.id);

      const { data: mpGateway } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('gateway_name', 'mercadopago')
        .eq('is_active', true)
        .maybeSingle();

      if (!mpGateway) {
        throw new Error('Mercado Pago no está configurado');
      }

      const transactionData = {
        user_id: user!.id,
        gateway_id: mpGateway.id,
        amount: currentRequest!.amount,
        currency: currentRequest!.currency,
        status: 'pending',
        payment_method: 'qr_mp',
        payment_request_id: currentRequest!.id,
      };

      const { data: transaction, error: insertError } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (insertError) throw insertError;
      transactionId = transaction.id;

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-mercadopago-payment`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: currentRequest!.amount,
          currency: currentRequest!.currency,
          description: currentRequest!.note || 'Pago POS Mobile',
          customer_email: currentRequest!.customer_email,
          customer_name: currentRequest!.customer_name,
          external_reference: currentRequest!.external_sale_id,
          access_token: mpGateway.api_key,
          is_sandbox: mpGateway.is_sandbox,
          payment_request_id: currentRequest!.id,
          transaction_id: transaction.id,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al crear el QR de Mercado Pago');
      }

      setPaymentResult({
        transaction_id: transaction.id,
        qr_code: result.qr_code,
        qr_code_base64: result.qr_code_base64,
        payment_link: result.payment_link,
      });

      console.log('QR generado exitosamente:', result);
    } catch (error: any) {
      console.error('Mercado Pago QR error:', error);

      if (transactionId) {
        await handlePaymentError(transactionId, error.message || 'Error desconocido');
      } else {
        setScreenState('error');
        setTimeout(() => resetToWaiting(), 3000);
      }
    }
  };

  const handlePaymentSuccess = async (transactionId: string, cardInfo: any) => {
    try {
      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      console.log('Calling confirm-payment for request:', currentRequest!.id);
      console.log('Callback URL:', currentRequest?.callback_url);

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/confirm-payment`;
      const confirmResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_request_id: currentRequest!.id,
          transaction_id: transactionId,
          status: 'completed',
        }),
      });

      const confirmResult = await confirmResponse.json();
      console.log('Confirm payment response:', confirmResult);

      if (!confirmResponse.ok) {
        console.error('Error confirming payment:', confirmResult);
      }

      setPaymentResult({
        transaction_id: transactionId,
        card_last4: cardInfo.card_last4,
        card_brand: cardInfo.card_brand,
      });
      setScreenState('success');
    } catch (error) {
      console.error('Error confirming payment:', error);
    }
  };

  const handlePaymentError = async (transactionId: string, errorMessage: string) => {
    await supabase
      .from('transactions')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', transactionId);

    const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/confirm-payment`;
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_request_id: currentRequest!.id,
        transaction_id: transactionId,
        status: 'failed',
        error_message: errorMessage,
      }),
    });

    setScreenState('error');
    setTimeout(() => resetToWaiting(), 3000);
  };

  const resetToWaiting = () => {
    setCurrentRequest(null);
    setPaymentResult(null);
    setScreenState('waiting');
    checkForPendingRequests();
  };

  const getPaymentTypeIcon = (paymentType: string) => {
    switch (paymentType) {
      case 'cash':
        return <DollarSign size={80} color="#3b82f6" strokeWidth={2} />;
      case 'card_debit':
      case 'card_credit':
        return <CreditCard size={80} color="#3b82f6" strokeWidth={2} />;
      case 'qr':
      case 'qr_mp':
        return <QrCode size={80} color="#3b82f6" strokeWidth={2} />;
      case 'transfer':
        return <ArrowRightLeft size={80} color="#3b82f6" strokeWidth={2} />;
      case 'nfc':
        return <Nfc size={80} color="#3b82f6" strokeWidth={2} />;
      default:
        return <CreditCard size={80} color="#3b82f6" strokeWidth={2} />;
    }
  };

  const getPaymentTypeLabel = (paymentType: string) => {
    switch (paymentType) {
      case 'cash':
        return 'Efectivo';
      case 'card_debit':
        return 'Tarjeta de Débito';
      case 'card_credit':
        return 'Tarjeta de Crédito';
      case 'transfer':
        return 'Transferencia';
      case 'qr':
        return 'QR/Billetera Digital';
      case 'qr_mp':
        return 'QR Mercado Pago';
      case 'check':
        return 'Cheque';
      case 'credit_note':
        return 'Nota de Crédito';
      case 'nfc':
        return 'Pago NFC/Contactless';
      default:
        return 'Tarjeta de Débito';
    }
  };

  const getPaymentTypeInstructions = (paymentType: string) => {
    switch (paymentType) {
      case 'cash':
        return 'Recibe el efectivo del cliente';
      case 'card_debit':
      case 'card_credit':
        return 'Ingrese los datos de la tarjeta';
      case 'qr':
      case 'qr_mp':
        return 'Cliente debe escanear el código QR';
      case 'transfer':
        return 'Cliente debe realizar la transferencia';
      case 'nfc':
        return 'Acerque la tarjeta o dispositivo';
      default:
        return 'Ingrese los datos de la tarjeta';
    }
  };

  const renderWaitingState = () => (
    <View style={styles.centerContainer}>
      <View style={styles.emptyCard}>
        <CreditCard size={64} color="#94a3b8" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Esperando venta</Text>
        <Text style={styles.emptySubtitle}>
          El sistema está listo para recibir solicitudes de pago
        </Text>
      </View>
    </View>
  );

  const renderPaymentReadyState = () => (
    <View style={styles.centerContainer}>
      <View style={styles.paymentCard}>
        <Text style={styles.cardTitle}>Nueva Venta</Text>

        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>{currentRequest?.currency || 'USD'}</Text>
          <Text style={styles.amountValue}>{currentRequest?.amount.toFixed(2)}</Text>
        </View>

        {currentRequest?.customer_name && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cliente:</Text>
            <Text style={styles.infoValue}>{currentRequest.customer_name}</Text>
          </View>
        )}

        {currentRequest?.note && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nota:</Text>
            <Text style={styles.infoValue}>{currentRequest.note}</Text>
          </View>
        )}

        {currentRequest?.items && currentRequest.items.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsTitle}>Artículos:</Text>
            {currentRequest.items.map((item: any, index: number) => (
              <Text key={index} style={styles.itemText}>
                • {item.name || item.description} - ${item.price}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.payButton}
          onPress={startPayment}
          disabled={!activeGateway}
        >
          <Text style={styles.payButtonText}>PAGAR</Text>
          <Text style={styles.payButtonAmount}>$ {currentRequest?.amount.toFixed(2)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const cancelPayment = async () => {
    if (currentRequest) {
      await supabase
        .from('payment_requests')
        .update({ status: 'cancelled' })
        .eq('id', currentRequest.id);

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/confirm-payment`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_request_id: currentRequest.id,
          transaction_id: null,
          status: 'failed',
          error_message: 'Pago cancelado por el usuario',
        }),
      });
    }

    resetToWaiting();
  };

  const renderProcessingState = () => {
    const paymentType = currentRequest?.payment_type || 'card_debit';
    const isQRPayment = paymentType === 'qr_mp' || paymentType === 'qr';

    if (isQRPayment && paymentResult?.qr_code_base64) {
      return (
        <View style={styles.centerContainer}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Escanea el QR para pagar</Text>

            <View style={styles.qrContainer}>
              {Platform.OS === 'web' ? (
                <img
                  src={`data:image/png;base64,${paymentResult.qr_code_base64}`}
                  alt="QR Code"
                  style={{ width: 280, height: 280 }}
                />
              ) : (
                <Text style={styles.qrPlaceholder}>QR Code aquí</Text>
              )}
            </View>

            <View style={styles.amountBadge}>
              <Text style={styles.amountBadgeText}>
                $ {currentRequest?.amount.toFixed(2)}
              </Text>
            </View>

            <Text style={styles.qrInstructions}>
              El pago se confirmará automáticamente cuando el cliente pague
            </Text>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelPayment}
            >
              <Text style={styles.cancelButtonText}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <View style={styles.processingCard}>
          <Text style={styles.processingTitle}>Procesando pago...</Text>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            {getPaymentTypeIcon(paymentType)}
          </Animated.View>

          <Text style={styles.processingText}>{getPaymentTypeInstructions(paymentType)}</Text>
          <Text style={styles.processingSubtext}>
            {getPaymentTypeLabel(paymentType)}
          </Text>

          <View style={styles.amountBadge}>
            <Text style={styles.amountBadgeText}>
              $ {currentRequest?.amount.toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelPayment}
          >
            <Text style={styles.cancelButtonText}>CANCELAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSuccessState = () => (
    <View style={styles.centerContainer}>
      <View style={styles.successCard}>
        <CheckCircle size={64} color="#22c55e" strokeWidth={2} />

        <Text style={styles.successTitle}>Pago aprobado</Text>

        <View style={styles.successAmount}>
          <Text style={styles.successAmountText}>
            $ {currentRequest?.amount.toFixed(2)}
          </Text>
        </View>

        {paymentResult?.card_brand && paymentResult?.card_last4 && (
          <Text style={styles.cardInfo}>
            {paymentResult.card_brand.toUpperCase()} •••• {paymentResult.card_last4}
          </Text>
        )}

        <View style={styles.successActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Receipt size={20} color="#3b82f6" strokeWidth={2} />
            <Text style={styles.actionButtonText}>Enviar recibo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={resetToWaiting}
          >
            <RefreshCw size={20} color="#fff" strokeWidth={2} />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>
              Nueva venta
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <View style={styles.errorCard}>
        <XCircle size={64} color="#ef4444" strokeWidth={2} />
        <Text style={styles.errorTitle}>Error en el pago</Text>
        <Text style={styles.errorText}>
          No se pudo procesar el pago. Intenta nuevamente.
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Procesar Pago</Text>
        {activeGateway && (
          <View style={styles.gatewayBadge}>
            <Text style={styles.gatewayText}>
              {activeGateway.gateway_name.toUpperCase()}
              {activeGateway.is_sandbox && ' (Sandbox)'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {screenState === 'waiting' && renderWaitingState()}
        {screenState === 'payment_ready' && renderPaymentReadyState()}
        {screenState === 'processing' && renderProcessingState()}
        {screenState === 'success' && renderSuccessState()}
        {screenState === 'error' && renderErrorState()}
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
    backgroundColor: '#3b82f6',
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
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    width: '100%',
    maxWidth: 400,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  paymentCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 20,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#fff',
  },
  itemsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  itemsTitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  itemText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  payButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  payButtonAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  processingCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 32,
  },
  processingText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 32,
    marginBottom: 8,
  },
  processingSubtext: {
    fontSize: 14,
    color: '#94a3b8',
  },
  amountBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 24,
  },
  amountBadgeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  successCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 24,
  },
  successAmount: {
    marginBottom: 12,
  },
  successAmountText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#22c55e',
  },
  cardInfo: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  successActions: {
    width: '100%',
    gap: 12,
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
  errorCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  qrCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  qrPlaceholder: {
    width: 280,
    height: 280,
    textAlign: 'center',
    lineHeight: 280,
    color: '#64748b',
  },
  qrInstructions: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
});
