# Guía de Configuración de Mercado Pago

Esta guía te ayudará a configurar pagos con código QR usando Mercado Pago en tu aplicación POS Mobile.

## ¿Qué es Mercado Pago QR?

Mercado Pago QR te permite generar códigos QR que tus clientes pueden escanear con su app de Mercado Pago para realizar pagos de forma rápida y segura. Es la solución de pago más popular en LATAM.

## Paso 1: Crear una cuenta de Mercado Pago

1. Ve a [https://www.mercadopago.com.uy](https://www.mercadopago.com.uy) (o tu país)
2. Haz clic en "Crear cuenta"
3. Completa el proceso de registro
4. Verifica tu cuenta con tu documento de identidad

## Paso 2: Acceder al Panel de Desarrolladores

1. Inicia sesión en tu cuenta de Mercado Pago
2. Ve a [https://www.mercadopago.com.uy/developers](https://www.mercadopago.com.uy/developers)
3. Si es tu primera vez, acepta los términos y condiciones para desarrolladores

## Paso 3: Crear una Aplicación

1. En el panel de desarrolladores, haz clic en "Mis aplicaciones"
2. Haz clic en "Crear aplicación"
3. Completa los datos:
   - **Nombre**: POS Mobile (o el nombre que prefieras)
   - **Modelo de integración**: Pagos online
   - **Producto/Servicio**: Selecciona la categoría de tu negocio
4. Haz clic en "Crear aplicación"

## Paso 4: Obtener tus Credenciales de Prueba

Para empezar a probar, usa las credenciales de prueba:

1. En tu aplicación, ve a la sección "Credenciales"
2. Selecciona la pestaña "Credenciales de prueba"
3. Encontrarás:
   - **Public Key**: `TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Access Token**: `TEST-xxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxx`

### Importante sobre el modo de prueba

Las credenciales de prueba te permiten simular pagos sin usar dinero real. Para probar:

- Usa las [tarjetas de prueba de Mercado Pago](https://www.mercadopago.com.uy/developers/es/docs/checkout-api/additional-content/test-cards)
- Los pagos aparecerán como completados pero no moverán dinero real
- Usa usuarios de prueba para probar la experiencia completa

## Paso 5: Configurar en la App

### A. Configurar el .env (Solo para desarrollo local)

Si estás desarrollando localmente, actualiza el archivo `.env`:

```bash
EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-tu-public-key
MERCADOPAGO_ACCESS_TOKEN=TEST-tu-access-token
```

### B. Configurar en la App (Producción)

1. Abre la app POS Mobile
2. Ve a la pestaña "Configuración"
3. En la sección "Pasarelas de Pago", agrega una nueva:
   - **Gateway Name**: mercadopago
   - **API Key**: Pega tu Access Token (TEST-xxxx...)
   - **API Secret**: Puedes dejar vacío o repetir el Access Token
   - **Modo Sandbox**: Activado (para pruebas)
   - **Activo**: Activado
4. Guarda la configuración

## Paso 6: Generar tu Primer QR de Pago

1. Ve a la pestaña "QR" en la app
2. Ingresa el monto a cobrar
3. Opcionalmente, agrega:
   - Descripción del pago
   - Nombre del cliente
   - Email del cliente
4. Haz clic en "Generar código QR"
5. Muestra el código QR a tu cliente para que lo escanee con su app de Mercado Pago

## Paso 7: Probar el Pago

Para probar el flujo completo:

1. Descarga la app de Mercado Pago en otro dispositivo
2. Crea una cuenta de prueba o usa tu cuenta real (no se cobrará en modo sandbox)
3. Escanea el código QR generado
4. Completa el pago
5. Verifica que la transacción aparezca en el historial de la app POS

## Paso 8: Pasar a Producción

Cuando estés listo para aceptar pagos reales:

1. Completa el proceso de verificación de tu cuenta de Mercado Pago
2. En el panel de desarrolladores, ve a "Credenciales"
3. Selecciona "Credenciales de producción"
4. Copia tu **Access Token de producción**
5. En la app POS Mobile:
   - Ve a Configuración
   - Edita la pasarela de Mercado Pago
   - Actualiza el API Key con tu Access Token de producción
   - **DESACTIVA** el modo Sandbox
   - Guarda los cambios

## Monedas Soportadas

Mercado Pago soporta diferentes monedas según el país:

- **Uruguay**: UYU (Peso Uruguayo)
- **Argentina**: ARS (Peso Argentino)
- **Brasil**: BRL (Real)
- **México**: MXN (Peso Mexicano)
- **Chile**: CLP (Peso Chileno)
- **Colombia**: COP (Peso Colombiano)
- **Perú**: PEN (Sol)

Asegúrate de configurar la moneda correcta en la configuración del POS.

## Webhook (Opcional - Avanzado)

Para recibir notificaciones automáticas de cambios en los pagos:

1. En tu aplicación de Mercado Pago, ve a "Webhooks"
2. Agrega una nueva URL de notificación:
   - **URL**: `https://tu-proyecto.supabase.co/functions/v1/mercadopago-webhook`
3. Selecciona los eventos: `payment`
4. Guarda la configuración

## Comisiones y Tarifas

Ten en cuenta las comisiones de Mercado Pago:

- **QR Code**: ~3.99% + impuestos
- Las tarifas varían según el país y el tipo de cuenta
- Consulta [tarifas actualizadas](https://www.mercadopago.com.uy/costs-section/costs)

## Solución de Problemas

### Error: "Invalid access token"

- Verifica que copiaste correctamente el Access Token
- Asegúrate de usar el Access Token, no el Public Key
- Verifica que el token no haya expirado

### El QR no se puede escanear

- Asegúrate de que el código QR sea legible
- Verifica que la app de Mercado Pago esté actualizada
- Intenta aumentar el brillo de la pantalla

### El pago no se registra en la app

- Verifica que el webhook esté configurado correctamente
- Revisa los logs en Supabase Edge Functions
- Asegúrate de que el modo sandbox coincida en todas las configuraciones

## Recursos Adicionales

- [Documentación oficial de Mercado Pago](https://www.mercadopago.com.uy/developers/es/docs)
- [Centro de ayuda](https://www.mercadopago.com.uy/ayuda)
- [Status de la API](https://status.mercadopago.com/)

## Soporte

Si tienes problemas con la integración:

1. Revisa los logs en Supabase Dashboard
2. Verifica la configuración en el panel de Mercado Pago
3. Consulta la documentación oficial
4. Contacta al soporte de Mercado Pago si el problema persiste
