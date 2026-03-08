# API de POS - Documentación de Uso

Este documento explica cómo enviar solicitudes de pago al sistema POS desde aplicaciones externas.

## Flujo del Sistema

1. **Sistema externo** envía solicitud de pago a la Edge Function
2. **POS App** escucha en tiempo real y muestra la solicitud
3. **Usuario** confirma y procesa el pago en el POS
4. **Sistema POS** notifica de vuelta al sistema externo vía webhook

## 1. Crear Solicitud de Pago

### Endpoint

```
POST https://[TU-PROYECTO].supabase.co/functions/v1/create-payment-request
```

### Headers

```json
{
  "Content-Type": "application/json"
}
```

### Body

```json
{
  "user_id": "uuid-del-usuario-pos",
  "amount": 150.50,
  "currency": "USD",
  "customer_name": "Juan Pérez",
  "customer_email": "juan@example.com",
  "note": "Orden #12345",
  "items": [
    {
      "name": "Producto A",
      "price": 100.00,
      "quantity": 1
    },
    {
      "name": "Producto B",
      "price": 50.50,
      "quantity": 1
    }
  ],
  "external_sale_id": "ORDER-12345",
  "callback_url": "https://tu-sistema.com/webhook/payment-confirmation",
  "expires_in_minutes": 30
}
```

### Parámetros

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `user_id` | string | Sí | UUID del usuario que opera el POS |
| `amount` | number | Sí | Monto total a cobrar |
| `currency` | string | No | Código de moneda (default: USD) |
| `customer_name` | string | No | Nombre del cliente |
| `customer_email` | string | No | Email del cliente |
| `note` | string | No | Nota o descripción de la venta |
| `items` | array | No | Lista de artículos de la venta |
| `external_sale_id` | string | No | ID de la venta en tu sistema |
| `callback_url` | string | No | URL donde recibir la confirmación |
| `expires_in_minutes` | number | No | Minutos antes de expirar (default: 30) |

### Respuesta Exitosa

```json
{
  "success": true,
  "payment_request": {
    "id": "uuid-de-la-solicitud",
    "user_id": "uuid-del-usuario-pos",
    "amount": 150.50,
    "currency": "USD",
    "status": "pending",
    "created_at": "2026-03-08T01:30:00Z",
    "expires_at": "2026-03-08T02:00:00Z"
  },
  "message": "Payment request created successfully"
}
```

### Respuesta de Error

```json
{
  "success": false,
  "error": "user_id and amount (> 0) are required"
}
```

## 2. Recibir Confirmación (Webhook)

Cuando el pago se procesa en el POS, tu sistema recibirá un POST en la `callback_url` que proporcionaste:

### Payload del Webhook

```json
{
  "payment_request_id": "uuid-de-la-solicitud",
  "external_sale_id": "ORDER-12345",
  "status": "completed",
  "amount": 150.50,
  "currency": "USD",
  "transaction_id": "uuid-de-la-transaccion",
  "processed_at": "2026-03-08T01:35:00Z"
}
```

### Estados Posibles

- `completed`: Pago exitoso
- `failed`: Pago fallido

### Ejemplo de Handler en Node.js

```javascript
app.post('/webhook/payment-confirmation', async (req, res) => {
  const {
    payment_request_id,
    external_sale_id,
    status,
    amount,
    transaction_id,
    error_message
  } = req.body;

  if (status === 'completed') {
    await updateOrderStatus(external_sale_id, 'paid');
    console.log(`Pago completado: ${transaction_id}`);
  } else {
    await updateOrderStatus(external_sale_id, 'failed');
    console.log(`Pago fallido: ${error_message}`);
  }

  res.status(200).json({ received: true });
});
```

## 3. Ejemplo Completo en JavaScript

```javascript
async function solicitarPago() {
  const response = await fetch(
    'https://[TU-PROYECTO].supabase.co/functions/v1/create-payment-request',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: 'abc-123-def-456',
        amount: 99.99,
        currency: 'USD',
        customer_name': 'María García',
        note: 'Compra en línea',
        items: [
          { name: 'Producto Premium', price: 99.99, quantity: 1 }
        ],
        external_sale_id: 'WEB-7890',
        callback_url: 'https://mi-sitio.com/webhook/pago',
        expires_in_minutes: 15
      })
    }
  );

  const result = await response.json();

  if (result.success) {
    console.log('Solicitud de pago creada:', result.payment_request.id);
    return result.payment_request.id;
  } else {
    console.error('Error:', result.error);
    throw new Error(result.error);
  }
}
```

## 4. Ejemplo en Python

```python
import requests

def solicitar_pago(user_id, amount, customer_name, items):
    url = "https://[TU-PROYECTO].supabase.co/functions/v1/create-payment-request"

    payload = {
        "user_id": user_id,
        "amount": amount,
        "currency": "USD",
        "customer_name": customer_name,
        "items": items,
        "callback_url": "https://mi-sistema.com/webhook/pago"
    }

    response = requests.post(url, json=payload)
    result = response.json()

    if result.get("success"):
        print(f"Solicitud creada: {result['payment_request']['id']}")
        return result['payment_request']
    else:
        raise Exception(result.get("error"))
```

## 5. Consultar Estado de una Solicitud

Para consultar el estado de una solicitud de pago, usa Supabase directamente:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://[TU-PROYECTO].supabase.co',
  '[TU-ANON-KEY]'
);

async function consultarEstado(paymentRequestId) {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*, transactions(*)')
    .eq('id', paymentRequestId)
    .single();

  if (error) throw error;

  return {
    status: data.status,
    amount: data.amount,
    transaction: data.transactions[0]
  };
}
```

## 6. Escuchar Cambios en Tiempo Real

Opcionalmente, puedes suscribirte a cambios en vez de usar webhooks:

```javascript
const channel = supabase
  .channel('payment_updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'payment_requests',
      filter: `external_sale_id=eq.ORDER-12345`
    },
    (payload) => {
      if (payload.new.status === 'completed') {
        console.log('Pago completado!');
      }
    }
  )
  .subscribe();
```

## Notas Importantes

1. **Seguridad**: La Edge Function `create-payment-request` no requiere autenticación JWT para permitir llamadas desde sistemas externos. Asegúrate de validar las solicitudes en tu backend.

2. **user_id**: Debes conocer el UUID del usuario que opera el POS. Esto se puede obtener al configurar la integración.

3. **Webhooks**: Asegúrate de que tu `callback_url` sea accesible públicamente y responda con status 200.

4. **Expiración**: Las solicitudes expiran automáticamente después del tiempo especificado.

5. **Realtime**: El POS escucha automáticamente nuevas solicitudes vía Supabase Realtime.

## Soporte

Para más información, consulta la documentación completa o contacta al equipo de desarrollo.
