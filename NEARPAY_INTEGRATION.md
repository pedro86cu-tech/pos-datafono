# Integración de NearPay SDK en POS Mobile

## Descripción General

NearPay es un SDK que permite procesar pagos con tarjetas NFC en dispositivos Android, iOS y Web. Existen dos modos de integración:

1. **EmbededNearpay**: Solo Android nativo con NFC
2. **RemoteNearpay**: Todas las plataformas mediante proxy

## Requisitos del Sistema

- **Android**: SDK 21+ (Android 5.0+)
- **iOS**: Compatible mediante RemoteNearpay
- **Red**: Dispositivo y proxy en la misma red WiFi (para RemoteNearpay)

---

## Instalación

```bash
npm install "https://github.com/nearpayio/nearpay-react-native-sdk.git#main" --save
```

---

## Opción 1: EmbededNearpay (Android Nativo)

### Configuración Inicial

```typescript
import {
  AuthenticationType,
  EmbededNearpay,
  Environments,
  Locale,
  NetworkConfig,
  UIPosition,
} from '@nearpaydev/react-native-nearpay-sdk';

// Crear instancia global (una sola vez)
const embededNearpay = new EmbededNearpay({
  authtype: AuthenticationType.email,
  authvalue: 'tu-email@ejemplo.com',
  tid: 'TU_TERMINAL_ID', // Opcional
  environment: Environments.sandbox, // o Environments.production
  locale: Locale.default,
  networkConfig: NetworkConfig.DEFAULT,
  uiPosition: UIPosition.DEFAULT,
  loadingUi: true,
  arabicPaymentText: 'يرجى تمرير البطاقة',
  englishPaymentText: 'Acerca tu tarjeta',
});
```

### Tipos de Autenticación

```typescript
// Opción 1: Email
AuthenticationType.email
authvalue: 'email@ejemplo.com'

// Opción 2: Móvil
AuthenticationType.mobile
authvalue: '+966500000000'

// Opción 3: JWT
AuthenticationType.jwt
authvalue: 'tu-jwt-token'

// Opción 4: Login interactivo
AuthenticationType.login
```

### Setup (Primera vez)

```typescript
// Instalar plugin y verificar credenciales
embededNearpay
  .setup()
  .then((res) => {
    console.log('Setup exitoso', res);
  })
  .catch((error) => {
    console.error('Setup falló', error);
  });
```

### Procesar un Pago

```typescript
import { v4 as uuidv4 } from 'uuid';

const procesarPago = async (monto: number) => {
  try {
    const resultado = await embededNearpay.purchase({
      amount: monto * 100, // Convertir a centavos (10.00 = 1000)
      transactionId: uuidv4(), // ID único de transacción
      customerReferenceNumber: '', // Referencia opcional
      enableReceiptUi: true, // Mostrar recibo
      enableReversalUi: true, // Permitir reversión
      enableUiDismiss: true, // Permitir cerrar UI
      finishTimeout: 60, // Timeout en segundos
    });

    console.log('Pago exitoso:', resultado);
    return { success: true, data: resultado };
  } catch (error) {
    // Manejo de errores específicos
    if (error instanceof PurchaseDeclined) {
      return { success: false, error: 'Pago rechazado' };
    } else if (error instanceof PurchaseRejected) {
      return { success: false, error: 'Compra rechazada' };
    } else if (error instanceof PurchaseGeneralFailure) {
      return { success: false, error: 'Error general' };
    } else if (error instanceof PurchaseInvalidStatus) {
      return { success: false, error: 'Estado inválido' };
    } else if (error instanceof PurchaseAuthenticationFailed) {
      return { success: false, error: 'Autenticación fallida' };
    }
    return { success: false, error: 'Error desconocido' };
  }
};
```

### Procesar Reembolso

```typescript
const procesarReembolso = async (
  monto: number,
  transactionUUID: string
) => {
  try {
    const resultado = await embededNearpay.refund({
      amount: monto * 100,
      originalTransactionUUID: transactionUUID,
      transactionId: uuidv4(),
      customerReferenceNumber: '',
      enableReceiptUi: true,
      enableReversalUi: true,
      editableReversalAmountUI: true,
      enableUiDismiss: true,
      finishTimeout: 60,
      adminPin: '0000', // PIN de administrador si es requerido
    });

    return { success: true, data: resultado };
  } catch (error) {
    if (error instanceof RefundDeclined) {
      return { success: false, error: 'Reembolso rechazado' };
    }
    return { success: false, error: 'Error en reembolso' };
  }
};
```

### Reversar Transacción

```typescript
const reversarTransaccion = async (transactionUUID: string) => {
  try {
    const resultado = await embededNearpay.reverse({
      originalTransactionUUID: transactionUUID,
      enableReceiptUi: true,
      enableUiDismiss: true,
      finishTimeout: 60,
    });

    return { success: true, data: resultado };
  } catch (error) {
    return { success: false, error: 'Error en reversión' };
  }
};
```

### Reconciliación

```typescript
const reconciliar = async () => {
  try {
    const resultado = await embededNearpay.reconcile({
      enableReceiptUi: true,
      enableUiDismiss: true,
      finishTimeout: 60,
      adminPin: '0000',
    });

    return { success: true, data: resultado };
  } catch (error) {
    return { success: false, error: 'Error en reconciliación' };
  }
};
```

### Obtener Detalles de Transacción

```typescript
const obtenerTransaccion = async (transactionUUID: string) => {
  try {
    const resultado = await embededNearpay.getTransaction({
      transactionUUID: transactionUUID,
      adminPin: '0000',
    });

    return { success: true, data: resultado };
  } catch (error) {
    return { success: false, error: 'Error obteniendo transacción' };
  }
};
```

---

## Opción 2: RemoteNearpay (Android, iOS, Web)

### Configuración

```typescript
import {
  RemoteNearPay,
  NearpayProvider,
  useNearpay,
} from '@nearpaydev/react-native-nearpay-sdk';

// Crear instancia
const remoteNearpay = new RemoteNearPay({
  autoReconnect: true, // Reconectar automáticamente
  connectToLastUser: true, // Conectar al último usuario
});
```

### Provider Pattern

```typescript
// App.tsx
import { NearpayProvider } from '@nearpaydev/react-native-nearpay-sdk';

export default function App() {
  return (
    <NearpayProvider remoteNearpay={remoteNearpay}>
      <YourApp />
    </NearpayProvider>
  );
}
```

### Usar en Componentes

```typescript
import { useNearpay } from '@nearpaydev/react-native-nearpay-sdk';

function PaymentScreen() {
  const { remoteNearpay, connectionState } = useNearpay();

  // Conectar al proxy
  const conectar = async () => {
    await remoteNearpay.connect({
      ip: '192.168.1.100', // IP del proxy
      port: 8080, // Puerto del proxy
    });
  };

  // Procesar pago
  const procesarPago = async (monto: number) => {
    const terminal = remoteNearpay.getTerminal();
    const resultado = await terminal.purchase({
      amount: monto * 100,
      transactionId: uuidv4(),
    });
    return resultado;
  };

  return (
    <View>
      <Text>Estado: {connectionState}</Text>
      <Button title="Conectar" onPress={conectar} />
      <Button title="Pagar" onPress={() => procesarPago(10.00)} />
    </View>
  );
}
```

---

## Integración con la App Actual

### 1. Crear Servicio de NearPay

```typescript
// lib/nearpay.ts
import {
  AuthenticationType,
  EmbededNearpay,
  Environments,
  Locale,
} from '@nearpaydev/react-native-nearpay-sdk';
import { Platform } from 'react-native';

class NearPayService {
  private embededNearpay: EmbededNearpay | null = null;

  initialize(email: string, terminalId?: string) {
    if (Platform.OS !== 'android') {
      console.warn('EmbededNearpay solo funciona en Android');
      return;
    }

    this.embededNearpay = new EmbededNearpay({
      authtype: AuthenticationType.email,
      authvalue: email,
      tid: terminalId,
      environment: Environments.sandbox,
      locale: Locale.default,
      loadingUi: true,
      englishPaymentText: 'Acerca tu tarjeta',
    });
  }

  async setup() {
    if (!this.embededNearpay) {
      throw new Error('NearPay no inicializado');
    }
    return await this.embededNearpay.setup();
  }

  async purchase(amount: number, transactionId: string) {
    if (!this.embededNearpay) {
      throw new Error('NearPay no inicializado');
    }

    return await this.embededNearpay.purchase({
      amount: Math.round(amount * 100),
      transactionId,
      enableReceiptUi: true,
      enableReversalUi: true,
      enableUiDismiss: true,
      finishTimeout: 60,
    });
  }

  async refund(amount: number, originalTransactionUUID: string) {
    if (!this.embededNearpay) {
      throw new Error('NearPay no inicializado');
    }

    return await this.embededNearpay.refund({
      amount: Math.round(amount * 100),
      originalTransactionUUID,
      enableReceiptUi: true,
      enableUiDismiss: true,
      finishTimeout: 60,
    });
  }
}

export const nearPayService = new NearPayService();
```

### 2. Modificar Base de Datos

Agregar campo a `payment_gateways`:

```sql
ALTER TABLE payment_gateways
ADD COLUMN nearpay_terminal_id TEXT,
ADD COLUMN nearpay_email TEXT;
```

### 3. Actualizar Pantalla de Pagos

Modificar `app/(tabs)/payment.tsx` para usar NearPay en lugar de expo-nfc.

---

## Ventajas de NearPay

✅ **SDK oficial certificado** para pagos
✅ **Soporte completo** de purchase, refund, reverse, reconcile
✅ **Manejo de errores robusto**
✅ **UI incluida** para procesar pagos
✅ **Soporte multi-plataforma** con RemoteNearpay
✅ **Cumplimiento PCI-DSS** manejado por NearPay
✅ **Documentación completa**

---

## Consideraciones

⚠️ **Android Nativo**: EmbededNearpay requiere Expo Dev Client o eject
⚠️ **Credenciales**: Necesitas registrarte en NearPay para obtener credenciales
⚠️ **Testing**: Usa Environments.sandbox para pruebas
⚠️ **Proxy**: RemoteNearpay requiere un proxy corriendo en la misma red

---

## Recursos

- 📚 [Repositorio Oficial](https://github.com/nearpayio/nearpay-react-native-sdk)
- 📖 [Documentación](https://docs.nearpay.io)
- 🌐 [Sitio Web](https://nearpay.io)
