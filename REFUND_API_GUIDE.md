# Guía de API de Anulaciones (Refunds) - Mercado Pago

Esta guía explica cómo usar el endpoint de anulaciones para procesar reembolsos parciales o totales en Mercado Pago.

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Endpoint de Anulación](#endpoint-de-anulación)
3. [Ejemplos de Uso](#ejemplos-de-uso)
4. [Respuestas](#respuestas)
5. [Errores Comunes](#errores-comunes)

---

## Configuración Inicial

### 1. Aplicar Migración de Base de Datos

Primero, aplica la siguiente migración SQL para crear la tabla de refunds:

```sql
/*
  # Create refunds table

  1. New Tables
    - `refunds`
      - `id` (uuid, primary key)
      - `transaction_id` (uuid, foreign key to transactions)
      - `payment_id` (text, Mercado Pago payment ID)
      - `refund_id` (text, Mercado Pago refund ID)
      - `amount` (decimal, refund amount)
      - `status` (text, refund status)
      - `reason` (text, refund reason)
      - `gateway_response` (jsonb, full response from Mercado Pago)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `refunds` table
    - Add policies for authenticated users to read their own refunds
*/

-- Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  payment_id text NOT NULL,
  refund_id text NOT NULL,
  amount decimal(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  reason text,
  gateway_response jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view refunds for their transactions"
  ON refunds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = refunds.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

-- Service role has full access to refunds
CREATE POLICY "Service role has full access to refunds"
  ON refunds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_refunds_transaction_id ON refunds(transaction_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_refund_id ON refunds(refund_id);
```

### 2. Desplegar la Función Edge

La función `refund-mercadopago-payment` ya está creada en:
```
supabase/functions/refund-mercadopago-payment/index.ts
```

---

## Endpoint de Anulación

### URL
```
POST https://[tu-proyecto].supabase.co/functions/v1/refund-mercadopago-payment
```

### Headers Requeridos
```
Content-Type: application/json
Authorization: Bearer [SUPABASE_ANON_KEY]
```

### Body Request

#### Anulación Total
```json
{
  "payment_id": 123456789,
  "access_token": "TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789"
}
```

#### Anulación Parcial
```json
{
  "payment_id": 123456789,
  "amount": 50.00,
  "access_token": "TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789",
  "reason": "Cliente solicitó reembolso parcial",
  "transaction_id": "uuid-de-tu-transaccion"
}
```

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `payment_id` | number | ✅ Sí | ID del pago en Mercado Pago |
| `access_token` | string | ✅ Sí | Access Token de Mercado Pago |
| `amount` | number | ❌ No | Monto a reembolsar (omitir para reembolso total) |
| `reason` | string | ❌ No | Razón del reembolso |
| `transaction_id` | string | ❌ No | ID de la transacción en tu base de datos |

---

## Ejemplos de Uso

### Ejemplo 1: Anulación Total con JavaScript/TypeScript

```typescript
const refundPayment = async (paymentId: number) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const accessToken = 'TEST-1234567890-123456-abcdef1234567890-123456789';

  const response = await fetch(
    `${supabaseUrl}/functions/v1/refund-mercadopago-payment`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        payment_id: paymentId,
        access_token: accessToken,
      }),
    }
  );

  const result = await response.json();

  if (result.success) {
    console.log('Reembolso exitoso:', result.refund_id);
    console.log('Monto reembolsado:', result.amount_refunded);
  } else {
    console.error('Error:', result.error);
  }

  return result;
};

// Uso
await refundPayment(123456789);
```

### Ejemplo 2: Anulación Parcial con React Native

```typescript
import { supabase } from './lib/supabase';

const refundPartialPayment = async (
  paymentId: number,
  amount: number,
  transactionId: string
) => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  // Obtener access token de la base de datos
  const { data: apiKey } = await supabase
    .from('api_keys')
    .select('mercadopago_access_token')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .single();

  const response = await fetch(
    `${supabaseUrl}/functions/v1/refund-mercadopago-payment`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        payment_id: paymentId,
        amount: amount,
        access_token: apiKey?.mercadopago_access_token,
        reason: 'Reembolso parcial solicitado por el cliente',
        transaction_id: transactionId,
      }),
    }
  );

  const result = await response.json();
  return result;
};

// Uso
const result = await refundPartialPayment(123456789, 50.00, 'uuid-transaction');
```

### Ejemplo 3: Anulación con cURL

#### Anulación Total
```bash
curl -X POST \
  https://[tu-proyecto].supabase.co/functions/v1/refund-mercadopago-payment \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [SUPABASE_ANON_KEY]' \
  -d '{
    "payment_id": 123456789,
    "access_token": "TEST-1234567890-123456-abcdef1234567890-123456789"
  }'
```

#### Anulación Parcial
```bash
curl -X POST \
  https://[tu-proyecto].supabase.co/functions/v1/refund-mercadopago-payment \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [SUPABASE_ANON_KEY]' \
  -d '{
    "payment_id": 123456789,
    "amount": 50.00,
    "access_token": "TEST-1234567890-123456-abcdef1234567890-123456789",
    "reason": "Reembolso parcial",
    "transaction_id": "uuid-de-tu-transaccion"
  }'
```

---

## Respuestas

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "refund_id": 987654321,
  "payment_id": 123456789,
  "amount_refunded": 100.00,
  "status": "approved",
  "refund_type": "total",
  "details": {
    "id": 987654321,
    "payment_id": 123456789,
    "amount": 100.00,
    "status": "approved",
    "date_created": "2024-03-09T12:34:56.000Z",
    "...": "otros campos de Mercado Pago"
  }
}
```

### Campos de Respuesta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `success` | boolean | Indica si el reembolso fue exitoso |
| `refund_id` | number | ID del reembolso en Mercado Pago |
| `payment_id` | number | ID del pago original |
| `amount_refunded` | number | Monto reembolsado |
| `status` | string | Estado del reembolso (approved, rejected, etc) |
| `refund_type` | string | Tipo de reembolso (total o partial) |
| `details` | object | Respuesta completa de Mercado Pago |

### Estados Posibles

- `approved`: Reembolso aprobado
- `pending`: Reembolso pendiente
- `rejected`: Reembolso rechazado
- `cancelled`: Reembolso cancelado

---

## Errores Comunes

### Error 400: Parámetros Faltantes
```json
{
  "success": false,
  "error": "payment_id y access_token son requeridos"
}
```

**Solución**: Verifica que estés enviando `payment_id` y `access_token`.

### Error 401: Token Inválido
```json
{
  "success": false,
  "error": "Unauthorized",
  "details": {
    "message": "Invalid credentials",
    "status": 401
  }
}
```

**Solución**: Verifica que tu `access_token` de Mercado Pago sea válido y no haya expirado.

### Error 404: Pago No Encontrado
```json
{
  "success": false,
  "error": "Payment not found",
  "details": {
    "message": "payment not found",
    "status": 404
  }
}
```

**Solución**: Verifica que el `payment_id` sea correcto y que el pago exista en Mercado Pago.

### Error 400: Pago No Puede Ser Reembolsado
```json
{
  "success": false,
  "error": "refund not allowed",
  "details": {
    "message": "refund not allowed",
    "status": 400
  }
}
```

**Solución**: El pago puede no ser elegible para reembolso (por ejemplo, ya fue reembolsado, está en proceso, o el método de pago no permite reembolsos).

---

## Consideraciones Importantes

### ⏰ Tiempo de Procesamiento
- Los reembolsos pueden tardar varios días en reflejarse en la cuenta del cliente
- El tiempo depende del método de pago original

### 💰 Límites de Reembolso
- No puedes reembolsar más que el monto original del pago
- Puedes hacer múltiples reembolsos parciales hasta el monto total

### 🔒 Seguridad
- Nunca expongas tu `access_token` en el código del cliente
- Guarda el `access_token` de forma segura en tu base de datos
- Usa el `service_role` de Supabase para operaciones sensibles

### 📊 Auditoría
- Todos los reembolsos se guardan en la tabla `refunds`
- Las transacciones relacionadas se actualizan a estado "refunded"
- La respuesta completa de Mercado Pago se guarda en `gateway_response`

---

## Consultar Reembolsos

### Obtener Reembolsos de una Transacción

```typescript
const { data: refunds } = await supabase
  .from('refunds')
  .select('*')
  .eq('transaction_id', 'uuid-de-transaccion')
  .order('created_at', { ascending: false });

console.log('Reembolsos:', refunds);
```

### Obtener Total Reembolsado

```typescript
const { data: refunds } = await supabase
  .from('refunds')
  .select('amount')
  .eq('payment_id', '123456789');

const totalRefunded = refunds?.reduce((sum, r) => sum + Number(r.amount), 0);
console.log('Total reembolsado:', totalRefunded);
```

---

## Recursos Adicionales

- [Documentación oficial de Mercado Pago - Refunds](https://www.mercadopago.com.uy/developers/es/docs/checkout-api/payment-management/refunds-and-cancellations)
- [API Reference - Refunds](https://www.mercadopago.com.uy/developers/es/reference/chargebacks/_payments_id_refunds/post)

---

## Soporte

Si tienes problemas:
1. Verifica los logs de la función edge en el dashboard de Supabase
2. Revisa que tu access token de Mercado Pago sea válido
3. Confirma que el pago existe y es elegible para reembolso
4. Consulta la documentación oficial de Mercado Pago
