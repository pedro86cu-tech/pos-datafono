# API de POS - Documentación de Uso

Este documento explica cómo enviar solicitudes de pago al sistema POS desde aplicaciones externas usando **API Keys**.

## Flujo del Sistema

1. **Generar API Key** en la app POS (Settings → API Keys)
2. **Sistema externo** envía solicitud de pago con la API Key
3. **POS App** escucha en tiempo real y muestra la solicitud
4. **Usuario** confirma y procesa el pago en el POS
5. **Sistema POS** notifica de vuelta al sistema externo vía webhook

## 1. Obtener tu API Key

### Paso 1: Ir a Settings en la app POS

1. Abre la app POS
2. Ve a la pestaña "Settings" (Configuración)
3. Encuentra la sección "API Keys para Integraciones"

### Paso 2: Crear una nueva API Key

1. Ingresa un nombre descriptivo (ej: "Sistema Web", "App E-commerce")
2. Click en "Generar API Key"
3. **COPIA LA API KEY INMEDIATAMENTE** - no podrás verla de nuevo
4. Guárdala en un lugar seguro

Tu API Key se verá así: `pos_ABC123def456GHI789jkl012MNO345pqr678STU901vwx234`

## 2. Crear Solicitud de Pago

### Endpoint

```
POST https://[TU-PROYECTO].supabase.co/functions/v1/create-payment-request
```

### Headers (IMPORTANTE)

```json
{
  "Content-Type": "application/json",
  "X-API-Key": "pos_ABC123def456GHI789jkl012MNO345pqr678STU901vwx234"
}
```

**El header `X-API-Key` es OBLIGATORIO**

### Body

```json
{
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
| `amount` | number | **Sí** | Monto total a cobrar (> 0) |
| `currency` | string | No | Código de moneda (default: USD) |
| `customer_name` | string | No | Nombre del cliente |
| `customer_email` | string | No | Email del cliente |
| `note` | string | No | Nota o descripción de la venta |
| `items` | array | No | Lista de artículos de la venta |
| `external_sale_id` | string | No | ID de la venta en tu sistema |
| `callback_url` | string | No | URL donde recibir la confirmación |
| `expires_in_minutes` | number | No | Minutos antes de expirar (default: 30) |

**Nota**: Ya NO se requiere `user_id` - el sistema lo obtiene automáticamente de tu API Key.

### Respuesta Exitosa (200)

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

### Respuestas de Error

**401 - Sin API Key**
```json
{
  "success": false,
  "error": "API Key is required. Provide X-API-Key header."
}
```

**401 - API Key Inválida**
```json
{
  "success": false,
  "error": "Invalid API Key"
}
```

**403 - API Key Inactiva**
```json
{
  "success": false,
  "error": "API Key is inactive"
}
```

**400 - Monto Inválido**
```json
{
  "success": false,
  "error": "amount (> 0) is required"
}
```

## 3. Ejemplo con cURL

### Básico

```bash
curl -X POST \
  https://[TU-PROYECTO].supabase.co/functions/v1/create-payment-request \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pos_ABC123def456GHI789jkl012MNO345pqr678STU901vwx234" \
  -d '{
    "amount": 1250.00,
    "currency": "USD"
  }'
```

### Completo (Restaurante)

```bash
curl -X POST \
  https://[TU-PROYECTO].supabase.co/functions/v1/create-payment-request \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pos_ABC123def456GHI789jkl012MNO345pqr678STU901vwx234" \
  -d '{
    "amount": 1250.00,
    "currency": "USD",
    "customer_name": "Juan Pérez",
    "customer_email": "juan.perez@email.com",
    "note": "Mesa #7 - 4 personas",
    "items": [
      {
        "name": "Hamburguesa Deluxe",
        "description": "Con queso y tocino",
        "price": 850.00,
        "quantity": 1
      },
      {
        "name": "Papas Fritas",
        "price": 200.00,
        "quantity": 1
      },
      {
        "name": "Refresco",
        "price": 200.00,
        "quantity": 1
      }
    ],
    "external_sale_id": "ORDEN-2024-12345",
    "callback_url": "https://mi-restaurante.com/api/webhook/payment-confirmation",
    "expires_in_minutes": 15
  }'
```

### E-commerce

```bash
curl -X POST \
  https://tuproyecto.supabase.co/functions/v1/create-payment-request \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pos_ABC123def456GHI789jkl012MNO345pqr678STU901vwx234" \
  -d '{
    "amount": 2599.99,
    "currency": "USD",
    "customer_name": "María García",
    "customer_email": "maria.garcia@example.com",
    "note": "Compra en línea - Recojo en tienda",
    "items": [
      {
        "name": "Laptop Dell XPS 15",
        "price": 2399.99,
        "quantity": 1
      },
      {
        "name": "Mouse inalámbrico",
        "price": 99.99,
        "quantity": 1
      },
      {
        "name": "Envío express",
        "price": 100.00,
        "quantity": 1
      }
    ],
    "external_sale_id": "WEB-98765",
    "callback_url": "https://mi-tienda.com/webhooks/payment"
  }'
```

## 4. Recibir Confirmación (Webhook)

Cuando el pago se procesa en el POS, tu sistema recibirá un POST en la `callback_url`:

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

- `completed`: Pago exitoso ✅
- `failed`: Pago fallido ❌

### Ejemplo de Handler (Node.js/Express)

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
    // Pago exitoso
    await db.orders.update(external_sale_id, {
      status: 'paid',
      transaction_id: transaction_id
    });

    console.log(`✅ Pago completado: ${transaction_id}`);

    // Enviar email de confirmación, etc.
  } else {
    // Pago fallido
    await db.orders.update(external_sale_id, {
      status: 'payment_failed',
      error: error_message
    });

    console.log(`❌ Pago fallido: ${error_message}`);
  }

  // Siempre responder 200 para confirmar recepción
  res.status(200).json({ received: true });
});
```

## 5. Ejemplo Completo en JavaScript

```javascript
const API_KEY = 'pos_ABC123def456GHI789jkl012MNO345pqr678STU901vwx234';
const SUPABASE_URL = 'https://tuproyecto.supabase.co';

async function enviarSolicitudPago(orderData) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/create-payment-request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,  // ← IMPORTANTE
        },
        body: JSON.stringify({
          amount: orderData.total,
          currency: 'USD',
          customer_name: orderData.customerName,
          customer_email: orderData.customerEmail,
          note: `Orden #${orderData.orderId}`,
          items: orderData.items,
          external_sale_id: `ORDER-${orderData.orderId}`,
          callback_url: 'https://mi-sitio.com/webhook/pago',
          expires_in_minutes: 30
        })
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('✅ Solicitud enviada al POS:', result.payment_request.id);
      return result.payment_request;
    } else {
      console.error('❌ Error:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error);
    throw error;
  }
}

// Uso
const miOrden = {
  orderId: 12345,
  total: 99.99,
  customerName: 'Carlos López',
  customerEmail: 'carlos@example.com',
  items: [
    { name: 'Producto Premium', price: 99.99, quantity: 1 }
  ]
};

enviarSolicitudPago(miOrden);
```

## 6. Ejemplo en Python

```python
import requests

API_KEY = "pos_ABC123def456GHI789jkl012MNO345pqr678STU901vwx234"
SUPABASE_URL = "https://tuproyecto.supabase.co"

def enviar_solicitud_pago(amount, customer_name, items):
    url = f"{SUPABASE_URL}/functions/v1/create-payment-request"

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY  # ← IMPORTANTE
    }

    payload = {
        "amount": amount,
        "currency": "USD",
        "customer_name": customer_name,
        "items": items,
        "callback_url": "https://mi-sistema.com/webhook/pago"
    }

    response = requests.post(url, json=payload, headers=headers)
    result = response.json()

    if result.get("success"):
        print(f"✅ Solicitud enviada: {result['payment_request']['id']}")
        return result['payment_request']
    else:
        raise Exception(f"❌ Error: {result.get('error')}")

# Uso
enviar_solicitud_pago(
    amount=150.50,
    customer_name="Ana Martínez",
    items=[
        {"name": "Café Latte", "price": 75.00, "quantity": 2}
    ]
)
```

## 7. Seguridad

### Protege tu API Key

- ✅ **Guárdala en variables de entorno**
- ✅ **NUNCA la incluyas en código público**
- ✅ **Usa HTTPS siempre**
- ✅ **Rota las keys periódicamente**
- ❌ **NUNCA la compartas o expongas**

### Ejemplo de Variables de Entorno

```bash
# .env
POS_API_KEY=pos_ABC123def456GHI789jkl012MNO345pqr678STU901vwx234
POS_URL=https://tuproyecto.supabase.co
```

```javascript
// En tu código
const API_KEY = process.env.POS_API_KEY;
const POS_URL = process.env.POS_URL;
```

### Gestión de Keys

En la app POS puedes:
- ✅ Crear múltiples API Keys (una por sistema/ambiente)
- ✅ Desactivar temporalmente una key (🔒)
- ✅ Ver última vez que se usó
- ✅ Eliminar keys comprometidas
- ✅ Copiar keys existentes

## 8. Monitoreo

### Ver Uso de API Keys

En Settings → API Keys verás:
- Fecha de creación
- Última vez usada
- Estado (Activa/Inactiva)

### Logs

El POS registra automáticamente:
- Cada uso de la API Key (actualiza `last_used_at`)
- Solicitudes de pago creadas
- Pagos procesados

## Notas Importantes

1. **API Key en Header**: Siempre envía `X-API-Key` en el header
2. **Seguridad**: Las keys tienen 52 caracteres y empiezan con `pos_`
3. **Múltiples Keys**: Puedes tener varias (desarrollo, producción, etc.)
4. **Desactivación**: Si una key se compromete, desactívala inmediatamente
5. **Webhooks**: Asegúrate que tu `callback_url` sea pública y responda 200
6. **Expiración**: Las solicitudes expiran automáticamente
7. **Realtime**: El POS escucha nuevas solicitudes en tiempo real

## Soporte

Para más información:
- Revisa los logs de Edge Functions en Supabase Dashboard
- Verifica el estado de tus API Keys en Settings
- Consulta la tabla `payment_requests` en tu base de datos

---

**¿Necesitas ayuda?** Contacta al equipo de desarrollo.
