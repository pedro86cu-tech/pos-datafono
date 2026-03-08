# Plan de Implementación de NearPay en POS Mobile

## 🎯 Objetivo

Integrar NearPay SDK como opción de procesamiento de pagos NFC, reemplazando/complementando la implementación actual de expo-nfc.

---

## 📋 Requisitos Previos

1. ✅ Cuenta en NearPay ([nearpay.io](https://nearpay.io))
2. ✅ Credenciales de autenticación (email/móvil/JWT)
3. ✅ Terminal ID (opcional pero recomendado)
4. ✅ Expo Dev Client (para testing en Android nativo)

---

## 🔧 Pasos de Implementación

### Fase 1: Preparación (30 min)

#### 1.1 Instalar NearPay SDK

```bash
npm install "https://github.com/nearpayio/nearpay-react-native-sdk.git#main" --save
npm install uuid @types/uuid
```

#### 1.2 Actualizar Base de Datos

Agregar campos de NearPay a la tabla `payment_gateways`:

```sql
-- Migration: add_nearpay_fields
ALTER TABLE payment_gateways
ADD COLUMN IF NOT EXISTS nearpay_email TEXT,
ADD COLUMN IF NOT EXISTS nearpay_terminal_id TEXT,
ADD COLUMN IF NOT EXISTS nearpay_environment TEXT DEFAULT 'sandbox';
```

#### 1.3 Configurar Expo para Build Nativo

Actualizar `app.json`:

```json
{
  "expo": {
    "plugins": [
      "@nearpaydev/react-native-nearpay-sdk"
    ]
  }
}
```

---

### Fase 2: Servicios Backend (45 min)

#### 2.1 Crear Servicio de NearPay

Crear `lib/nearpay-service.ts`:

```typescript
import {
  AuthenticationType,
  EmbededNearpay,
  Environments,
  Locale,
  PurchaseDeclined,
  PurchaseRejected,
  PurchaseGeneralFailure,
} from '@nearpaydev/react-native-nearpay-sdk';
import { Platform } from 'react-native';

interface NearPayConfig {
  email: string;
  terminalId?: string;
  environment: 'sandbox' | 'production';
}

class NearPayService {
  private instance: EmbededNearpay | null = null;
  private isInitialized: boolean = false;

  isAvailable(): boolean {
    return Platform.OS === 'android';
  }

  initialize(config: NearPayConfig) {
    if (!this.isAvailable()) {
      throw new Error('NearPay solo está disponible en Android nativo');
    }

    this.instance = new EmbededNearpay({
      authtype: AuthenticationType.email,
      authvalue: config.email,
      tid: config.terminalId,
      environment:
        config.environment === 'production'
          ? Environments.production
          : Environments.sandbox,
      locale: Locale.default,
      loadingUi: true,
      englishPaymentText: 'Por favor acerca tu tarjeta',
      arabicPaymentText: 'يرجى تمرير البطاقة',
    });

    this.isInitialized = true;
  }

  async setup(): Promise<void> {
    if (!this.instance) {
      throw new Error('NearPay no ha sido inicializado');
    }

    try {
      await this.instance.setup();
    } catch (error) {
      console.error('Error en setup de NearPay:', error);
      throw error;
    }
  }

  async purchase(
    amount: number,
    transactionId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.instance) {
      return {
        success: false,
        error: 'NearPay no ha sido inicializado',
      };
    }

    try {
      const result = await this.instance.purchase({
        amount: Math.round(amount * 100), // Convertir a centavos
        transactionId,
        enableReceiptUi: true,
        enableReversalUi: true,
        enableUiDismiss: true,
        finishTimeout: 60,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      let errorMessage = 'Error desconocido';

      if (error instanceof PurchaseDeclined) {
        errorMessage = 'Pago rechazado por el banco';
      } else if (error instanceof PurchaseRejected) {
        errorMessage = 'Compra rechazada';
      } else if (error instanceof PurchaseGeneralFailure) {
        errorMessage = 'Error general en el procesamiento';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async refund(
    amount: number,
    originalTransactionUUID: string,
    transactionId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.instance) {
      return {
        success: false,
        error: 'NearPay no ha sido inicializado',
      };
    }

    try {
      const result = await this.instance.refund({
        amount: Math.round(amount * 100),
        originalTransactionUUID,
        transactionId,
        enableReceiptUi: true,
        enableUiDismiss: true,
        finishTimeout: 60,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Error procesando reembolso',
      };
    }
  }

  async getTransaction(
    transactionUUID: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.instance) {
      return {
        success: false,
        error: 'NearPay no ha sido inicializado',
      };
    }

    try {
      const result = await this.instance.getTransaction({
        transactionUUID,
        adminPin: '0000',
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Error obteniendo transacción',
      };
    }
  }

  updateAuthentication(email: string, terminalId?: string) {
    if (!this.instance) {
      throw new Error('NearPay no ha sido inicializado');
    }

    this.instance.updateAuthentication({
      authtype: AuthenticationType.email,
      authvalue: email,
      tid: terminalId,
    });
  }

  async logout(): Promise<void> {
    if (!this.instance) {
      return;
    }

    try {
      await this.instance.logout();
      this.isInitialized = false;
    } catch (error) {
      console.error('Error en logout:', error);
    }
  }
}

export const nearPayService = new NearPayService();
```

#### 2.2 Crear Context para NearPay

Crear `contexts/NearPayContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { nearPayService } from '@/lib/nearpay-service';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface NearPayContextType {
  isAvailable: boolean;
  isConfigured: boolean;
  isReady: boolean;
  initializeNearPay: () => Promise<void>;
  processPurchase: (
    amount: number,
    transactionId: string
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
}

const NearPayContext = createContext<NearPayContextType>({
  isAvailable: false,
  isConfigured: false,
  isReady: false,
  initializeNearPay: async () => {},
  processPurchase: async () => ({ success: false }),
});

export const useNearPay = () => useContext(NearPayContext);

export const NearPayProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isConfigured, setIsConfigured] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const isAvailable = Platform.OS === 'android';

  const initializeNearPay = async () => {
    if (!isAvailable || !user) return;

    try {
      // Obtener configuración de NearPay de la base de datos
      const { data: gateway } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('gateway_name', 'nearpay')
        .eq('is_active', true)
        .maybeSingle();

      if (!gateway || !gateway.nearpay_email) {
        setIsConfigured(false);
        return;
      }

      nearPayService.initialize({
        email: gateway.nearpay_email,
        terminalId: gateway.nearpay_terminal_id,
        environment: gateway.nearpay_environment || 'sandbox',
      });

      await nearPayService.setup();
      setIsConfigured(true);
      setIsReady(true);
    } catch (error) {
      console.error('Error inicializando NearPay:', error);
      setIsConfigured(false);
      setIsReady(false);
    }
  };

  const processPurchase = async (amount: number, transactionId: string) => {
    if (!isReady) {
      return {
        success: false,
        error: 'NearPay no está configurado',
      };
    }

    return await nearPayService.purchase(amount, transactionId);
  };

  useEffect(() => {
    if (user && isAvailable) {
      initializeNearPay();
    }
  }, [user]);

  return (
    <NearPayContext.Provider
      value={{
        isAvailable,
        isConfigured,
        isReady,
        initializeNearPay,
        processPurchase,
      }}
    >
      {children}
    </NearPayContext.Provider>
  );
};
```

---

### Fase 3: Frontend (60 min)

#### 3.1 Actualizar Pantalla de Configuración

Modificar `app/(tabs)/settings.tsx` para incluir campos de NearPay:

```typescript
// Agregar campos al formulario de pasarelas
<TextInput
  placeholder="Email de NearPay"
  value={newGateway.nearpay_email}
  onChangeText={(text) =>
    setNewGateway({ ...newGateway, nearpay_email: text })
  }
/>
<TextInput
  placeholder="Terminal ID (opcional)"
  value={newGateway.nearpay_terminal_id}
  onChangeText={(text) =>
    setNewGateway({ ...newGateway, nearpay_terminal_id: text })
  }
/>
```

#### 3.2 Actualizar Pantalla de Pagos

Modificar `app/(tabs)/payment.tsx` para usar NearPay:

```typescript
import { useNearPay } from '@/contexts/NearPayContext';

export default function PaymentScreen() {
  const { isAvailable, isReady, processPurchase } = useNearPay();

  const handleNearPayPayment = async () => {
    if (!isReady) {
      Alert.alert('Error', 'NearPay no está configurado');
      return;
    }

    setStatus('processing');
    setMessage('Procesando pago con NearPay...');

    const result = await processPurchase(
      parseFloat(amount),
      uuidv4()
    );

    if (result.success) {
      setStatus('success');
      setMessage('¡Pago exitoso!');
      // Guardar transacción en DB
    } else {
      setStatus('error');
      setMessage(result.error || 'Error procesando pago');
    }
  };

  return (
    <>
      {isAvailable && isReady && (
        <TouchableOpacity
          style={styles.button}
          onPress={handleNearPayPayment}
        >
          <Text>Pagar con NearPay</Text>
        </TouchableOpacity>
      )}
    </>
  );
}
```

---

### Fase 4: Testing (30 min)

#### 4.1 Build Nativo

```bash
# Crear build de desarrollo
npx expo prebuild --platform android

# O usar EAS Build
eas build --profile development --platform android
```

#### 4.2 Tests a Realizar

- ✅ Configurar credenciales de NearPay en Settings
- ✅ Procesar un pago de prueba
- ✅ Verificar que la transacción se guarde en la BD
- ✅ Probar rechazo de pago
- ✅ Verificar UI de recibo
- ✅ Probar reversión de transacción

---

## 🚀 Despliegue

### Modo Sandbox (Desarrollo)
- Usar `Environments.sandbox`
- Credenciales de prueba de NearPay

### Modo Producción
- Cambiar a `Environments.production`
- Usar credenciales reales
- Realizar certificación PCI-DSS si es necesario

---

## ⚠️ Consideraciones Importantes

1. **Android Nativo Requerido**: EmbededNearpay requiere compilación nativa
2. **No funciona en Expo Go**: Necesitas Expo Dev Client o build nativo
3. **iOS**: Usar RemoteNearpay con un proxy Android
4. **Red Local**: RemoteNearpay requiere misma red WiFi
5. **Credenciales**: Registrarse en nearpay.io para obtener acceso

---

## 📱 Alternativa: RemoteNearpay para iOS

Si necesitas soporte iOS nativo, usa RemoteNearpay:

1. Instalar proxy en un dispositivo Android con NFC
2. Configurar RemoteNearpay en la app
3. Conectar via WebSocket al proxy
4. Procesar pagos a través del proxy

Ver `NEARPAY_INTEGRATION.md` sección "RemoteNearpay" para detalles.

---

## 📊 Comparación: expo-nfc vs NearPay

| Característica | expo-nfc | NearPay |
|---------------|----------|---------|
| Android | ✅ | ✅ |
| iOS | ✅ | ✅ (con proxy) |
| Web | ❌ | ✅ (con proxy) |
| Certificación PCI | ❌ | ✅ |
| UI Incluida | ❌ | ✅ |
| Refund/Reverse | ❌ | ✅ |
| Reconciliación | ❌ | ✅ |
| Soporte Comercial | ❌ | ✅ |

---

## 🎯 Resultado Final

Después de la implementación, tendrás:

✅ Procesamiento de pagos NFC certificado con NearPay
✅ Soporte para Android nativo
✅ Opción de iOS mediante RemoteNearpay
✅ UI profesional incluida
✅ Manejo completo de errores
✅ Refunds y reversiones
✅ Reconciliación de transacciones
✅ Cumplimiento PCI-DSS

---

## 📚 Referencias

- [Repositorio NearPay React Native](https://github.com/nearpayio/nearpay-react-native-sdk)
- [Documentación NearPay](https://docs.nearpay.io)
- [Sitio Web NearPay](https://nearpay.io)
