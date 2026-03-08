# Guía de SDKs de Pago para LATAM - React Native

## 🌎 Resumen Ejecutivo

Esta guía presenta las mejores opciones de SDKs de pago compatibles con LATAM, enfocadas en facilidad de integración y acceso para desarrolladores.

---

## 📊 Comparación de SDKs

| SDK | Países LATAM | Facilidad | SDK Oficial | Documentación | Expo Compatible |
|-----|--------------|-----------|-------------|---------------|-----------------|
| **Stripe** | 🇧🇷 🇲🇽 🇨🇴 🇵🇪 🇨🇱 🇦🇷 | ⭐⭐⭐⭐⭐ | ✅ | Excelente | ✅ |
| **MercadoPago** | 🇦🇷 🇧🇷 🇨🇱 🇨🇴 🇲🇽 🇵🇪 🇺🇾 | ⭐⭐⭐⭐ | ❌ (comunidad) | Buena | ⚠️ Requiere config |
| **Openpay** | 🇲🇽 | ⭐⭐⭐ | ✅ | Buena | ⚠️ |
| **PagSeguro** | 🇧🇷 | ⭐⭐⭐ | ✅ | Media | ⚠️ |
| **dLocal** | Todos LATAM | ⭐⭐⭐⭐ | ✅ | Buena | ✅ |

---

## 🏆 RECOMENDACIÓN #1: Stripe (MÁS FÁCIL)

### ✅ Ventajas

- **SDK oficial** para React Native con soporte completo
- **Expo compatible** - funciona con Expo managed workflow
- **Documentación excelente** - ejemplos claros y completos
- **PCI compliant** - seguridad certificada
- **Fácil de implementar** - menos de 30 minutos
- **PaymentSheet integrado** - UI lista para usar
- **Soporte LATAM**: Brasil, México, Colombia, Perú, Chile, Argentina

### 📦 Instalación

```bash
# Con Expo (RECOMENDADO)
expo install @stripe/stripe-react-native

# Con npm
npm install @stripe/stripe-react-native
```

### ⚙️ Configuración en app.json

```json
{
  "expo": {
    "plugins": [
      [
        "@stripe/stripe-react-native",
        {
          "merchantIdentifier": "merchant.com.tuapp",
          "enableGooglePay": true
        }
      ]
    ]
  }
}
```

### 💻 Implementación Básica

#### 1. Configurar Provider

```typescript
// App.tsx
import { StripeProvider } from '@stripe/stripe-react-native';

export default function App() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!;

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.tuapp"
    >
      <YourApp />
    </StripeProvider>
  );
}
```

#### 2. Crear Pantalla de Pago

```typescript
import { useStripe } from '@stripe/stripe-react-native';
import { useState } from 'react';
import { View, Button, Alert } from 'react-native';

export default function PaymentScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const initializePayment = async (amount: number) => {
    try {
      // Llamar a tu backend para crear PaymentIntent
      const response = await fetch('https://tu-backend.com/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount * 100 }), // Convertir a centavos
      });

      const { clientSecret } = await response.json();

      // Inicializar PaymentSheet
      const { error } = await initPaymentSheet({
        merchantDisplayName: 'Tu Negocio',
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          name: 'Cliente',
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return false;
      }

      return true;
    } catch (error) {
      Alert.alert('Error', 'No se pudo inicializar el pago');
      return false;
    }
  };

  const handlePayment = async () => {
    setLoading(true);

    // Inicializar
    const initialized = await initializePayment(100.00); // $100.00
    if (!initialized) {
      setLoading(false);
      return;
    }

    // Mostrar PaymentSheet
    const { error } = await presentPaymentSheet();

    if (error) {
      Alert.alert('Pago Cancelado', error.message);
    } else {
      Alert.alert('¡Éxito!', 'Tu pago fue procesado correctamente');
    }

    setLoading(false);
  };

  return (
    <View style={{ padding: 20 }}>
      <Button
        title={loading ? 'Procesando...' : 'Pagar $100.00'}
        onPress={handlePayment}
        disabled={loading}
      />
    </View>
  );
}
```

#### 3. Backend (Edge Function de Supabase)

```typescript
// supabase/functions/create-payment-intent/index.ts
import Stripe from 'npm:stripe@14.17.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-11-20.acacia',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { amount } = await req.json();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // En centavos
      currency: 'mxn', // Cambiar según tu país: mxn, brl, cop, pen, clp, ars
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
```

### 🌍 Monedas LATAM Soportadas

```typescript
const currencies = {
  mexico: 'mxn',      // Peso Mexicano
  brasil: 'brl',      // Real Brasileño
  colombia: 'cop',    // Peso Colombiano
  peru: 'pen',        // Sol Peruano
  chile: 'clp',       // Peso Chileno
  argentina: 'ars',   // Peso Argentino
};
```

### 📱 Métodos de Pago Incluidos

- ✅ Tarjetas de crédito/débito
- ✅ Apple Pay (iOS)
- ✅ Google Pay (Android)
- ✅ SEPA (Europa)
- ✅ Otros métodos regionales

### 🔑 Obtener Credenciales

1. Crear cuenta en [stripe.com](https://dashboard.stripe.com/register)
2. Ir a Developers > API keys
3. Copiar:
   - **Publishable key** (para el frontend)
   - **Secret key** (para el backend)

### 💰 Costos

- **Sin cuota mensual**
- **2.9% + $0.30 USD por transacción exitosa** (varía por país)
- Sin cargos por setup o integración

---

## 🥈 OPCIÓN #2: MercadoPago (Popular en LATAM)

### ✅ Ventajas

- **Más popular en LATAM** - ampliamente usado
- **7 países**: Argentina, Brasil, Chile, Colombia, México, Perú, Uruguay
- **Métodos de pago locales** - Pix, Oxxo, boleto, etc.
- **Cuotas/parcelamento** - pagos en cuotas
- **Gratis para crear cuenta**

### ⚠️ Consideraciones

- No tiene SDK oficial para React Native
- Requiere usar soluciones de la comunidad
- Documentación menos clara para React Native

### 📦 Instalación

```bash
npm install react-native-mercadopago-px
```

### 💻 Uso Básico

```typescript
import MercadoPago from 'react-native-mercadopago-px';

// Inicializar
MercadoPago.initialize({
  publicKey: 'TU_PUBLIC_KEY',
  locale: 'es-MX',
});

// Crear preferencia en tu backend
const preference = await fetch('/api/create-preference', {
  method: 'POST',
  body: JSON.stringify({ amount: 100 }),
});

const { preferenceId } = await preference.json();

// Abrir checkout
const result = await MercadoPago.startCheckout({
  preferenceId: preferenceId,
});

if (result.status === 'approved') {
  console.log('¡Pago aprobado!');
}
```

### 🔑 Obtener Credenciales

1. Crear cuenta en [mercadopago.com](https://www.mercadopago.com)
2. Ir a Developers > Credenciales
3. Copiar Public Key y Access Token

---

## 🥉 OPCIÓN #3: Openpay (Solo México)

### ✅ Ventajas

- Diseñado específicamente para México
- Tarjetas, SPEI, efectivo en tiendas
- Comisiones competitivas

### 📦 Instalación

```bash
npm install openpay-react-native
```

### 💻 Uso Básico

```typescript
import Openpay from 'openpay-react-native';

Openpay.setId('TU_MERCHANT_ID');
Openpay.setApiKey('TU_PUBLIC_KEY');
Openpay.setProductionMode(false); // sandbox

const tokenParams = {
  card_number: '4111111111111111',
  holder_name: 'Juan Perez',
  expiration_year: '25',
  expiration_month: '12',
  cvv2: '123',
};

const token = await Openpay.createToken(tokenParams);
```

---

## 🌐 OPCIÓN #4: dLocal (Todos los países LATAM)

### ✅ Ventajas

- Soporta **TODOS los países de LATAM**
- Métodos de pago locales de cada país
- Infraestructura robusta
- Buena para empresas grandes

### 💻 Integración

Usa WebView con SDK JavaScript:

```typescript
import { WebView } from 'react-native-webview';

<WebView
  source={{ uri: 'https://tu-backend.com/dlocal-checkout' }}
  onMessage={(event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.status === 'success') {
      // Pago exitoso
    }
  }}
/>
```

---

## 🎯 Tabla de Decisión

### ¿Qué SDK elegir?

| Tu Situación | SDK Recomendado |
|--------------|-----------------|
| Necesitas la **implementación MÁS FÁCIL** | ⭐ **Stripe** |
| Operas en **múltiples países LATAM** | **MercadoPago** o **dLocal** |
| Solo necesitas **México** | **Openpay** |
| Solo necesitas **Brasil** | **PagSeguro** |
| Necesitas **UI lista para usar** | ⭐ **Stripe** |
| Necesitas **pagos en cuotas** | **MercadoPago** |
| Necesitas **métodos locales** (Pix, Oxxo, etc.) | **MercadoPago** |
| Usas **Expo** y quieres 0 configuración nativa | ⭐ **Stripe** |

---

## 🚀 Mi Recomendación Final

### Para tu caso (POS Mobile):

**Usar Stripe** porque:

1. ✅ **Instalación en 5 minutos** con Expo
2. ✅ **Documentación perfecta** - ejemplos claros
3. ✅ **UI incluida** - PaymentSheet listo para usar
4. ✅ **Funciona con Expo Go** - sin necesidad de build nativo
5. ✅ **Soporte oficial** - actualizaciones constantes
6. ✅ **PCI compliant** - seguridad garantizada
7. ✅ **Gratis para empezar** - solo pagas por transacciones exitosas
8. ✅ **Soporta 6 países LATAM** incluyendo los principales

### Flujo de Implementación:

```
1. Crear cuenta Stripe (5 min)
2. Instalar SDK (1 min)
3. Configurar app.json (2 min)
4. Crear Edge Function para PaymentIntent (10 min)
5. Implementar pantalla de pago (15 min)
6. Probar con tarjetas de prueba (5 min)

TOTAL: ~40 minutos para estar funcionando
```

---

## 📚 Recursos

### Stripe
- [Documentación Oficial](https://stripe.com/docs/payments/accept-a-payment?platform=react-native)
- [SDK React Native](https://github.com/stripe/stripe-react-native)
- [Dashboard](https://dashboard.stripe.com)

### MercadoPago
- [SDK React](https://github.com/mercadopago/sdk-react)
- [Developers](https://www.mercadopago.com.ar/developers)
- [React Native Community](https://github.com/BlackBoxVision/react-native-mercadopago-px)

### Openpay
- [Documentación](https://www.openpay.mx/docs/)
- [React Native](https://github.com/open-pay/openpay-react-native)

### dLocal
- [Sitio Web](https://www.dlocal.com/)
- [Documentación](https://docs.dlocal.com/)

---

## ⚡ Próximo Paso

¿Quieres que implemente **Stripe** en tu aplicación? Puedo:

1. ✅ Configurar el SDK en tu proyecto
2. ✅ Crear la Edge Function para PaymentIntents
3. ✅ Actualizar la pantalla de pagos con PaymentSheet
4. ✅ Configurar las variables de entorno
5. ✅ Agregar guardado de transacciones en Supabase

Todo listo en menos de 30 minutos y **funcionando en Expo** sin necesidad de build nativo.
