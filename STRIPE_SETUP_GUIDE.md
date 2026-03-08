# Guía de Configuración de Stripe (Modo Desarrollo)

## ✅ Lo que ya está implementado

- ✅ Stripe SDK instalado (`@stripe/stripe-react-native`)
- ✅ Edge function actualizada para procesar pagos con Stripe
- ✅ Pantalla de pago con soporte para Stripe Tap to Pay
- ✅ Configuración de StripeProvider en el layout principal

## 🔧 Pasos para configurar Stripe

### 1. Obtener tus claves de Stripe (Test Mode)

1. Ve a tu dashboard de Stripe: https://dashboard.stripe.com/test/dashboard
2. Haz clic en "Developers" en el menú lateral
3. Selecciona "API keys"
4. Copia las siguientes claves:
   - **Publishable key** (empieza con `pk_test_...`)
   - **Secret key** (empieza con `sk_test_...`)

### 2. Configurar variables de entorno

Edita el archivo `.env` y reemplaza:

```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_TU_CLAVE_AQUI
```

### 3. Agregar Stripe como gateway de pago

1. Abre la app y ve a la pestaña **Ajustes** (Settings)
2. En la sección "Pasarelas de Pago", completa el formulario:
   - **Nombre**: `stripe`
   - **API Key**: Pega tu Secret Key (`sk_test_...`)
   - **API Secret**: Déjalo vacío (no se necesita)
   - **✅ Activar**: Marca esta opción
   - **✅ Modo Sandbox**: Marca esta opción
3. Haz clic en "Agregar Pasarela"

### 4. Probar pagos con Stripe

#### Opción A: Stripe Tap to Pay (Solo dispositivos móviles nativos)

1. Ve a la pestaña **Payment**
2. Ingresa un monto (ej: `10.00`)
3. Haz clic en el botón **"Stripe Tap to Pay"** (color violeta #635bff)
4. La app mostrará "Acerca la tarjeta o dispositivo..."
5. Usa una tarjeta de prueba de Stripe

**Tarjetas de prueba:**
- Número: `4242 4242 4242 4242`
- Fecha: Cualquier fecha futura
- CVC: Cualquier 3 dígitos
- ZIP: Cualquier 5 dígitos

#### Opción B: Simular Pago (Para testing rápido)

1. Ve a la pestaña **Payment**
2. Ingresa un monto
3. Haz clic en **"Simular Pago"**
4. Este botón crea el PaymentIntent pero no requiere confirmar con tarjeta

### 5. Verificar transacciones

1. Ve a la pestaña **Historial** para ver todas las transacciones
2. También puedes verificar en tu Stripe Dashboard: https://dashboard.stripe.com/test/payments

## 📱 Limitaciones importantes

### ❌ NO funciona en Web
Stripe Tap to Pay requiere dispositivos móviles nativos (iOS/Android). La versión web no tiene acceso a funcionalidades nativas de pago.

### ❌ Stripe Terminal (hardware) no incluido
Esta implementación usa el SDK básico de Stripe. Para usar lectores físicos de Stripe Terminal necesitarías:
- Comprar hardware de Stripe Terminal
- Implementar el SDK de Stripe Terminal (más complejo)
- Configuración adicional de cuenta business

### ✅ Lo que SÍ funciona en modo desarrollo
- Crear PaymentIntents desde la app
- Procesar pagos de prueba
- Ver historial de transacciones
- Integración con Supabase
- Modo sandbox completo

## 🌎 ¿Qué pasa si estás en Uruguay?

Como estás en Uruguay, tienes estas opciones:

### Opción 1: Usar Stripe en modo Test (actual) ✅
- **Ventaja**: Puedes desarrollar y probar todo
- **Limitación**: NO puedes procesar pagos reales de producción desde Uruguay
- **Uso**: Perfecto para desarrollo y testing

### Opción 2: Stripe Atlas ($500 USD)
Si necesitas procesar pagos reales:
1. Crear empresa en USA con Stripe Atlas: https://stripe.com/atlas
2. Costo: $500 USD setup + mantenimiento anual
3. Acceso completo a Stripe para producción

### Opción 3: Cambiar a MercadoPago (Recomendado para LATAM)
- ✅ Gratis
- ✅ Disponible en Uruguay
- ✅ Métodos de pago locales
- ⚠️ Point Tap (NFC) solo en app oficial, no SDK para desarrolladores

## 🚀 Próximos pasos recomendados

1. **Para seguir desarrollando**: Usa Stripe en modo test (actual)
2. **Para producción en LATAM**: Considera MercadoPago
3. **Para producción global**: Necesitarás Stripe Atlas o empresa fuera de Uruguay

## 📚 Recursos adicionales

- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe React Native SDK](https://stripe.dev/stripe-react-native/)
- [Stripe Atlas](https://stripe.com/atlas)

## ❓ Preguntas frecuentes

### ¿Puedo usar NFC con Stripe?
Sí, pero solo en dispositivos móviles nativos. Stripe Tap to Pay está implementado y funciona con el SDK de `@stripe/stripe-react-native`.

### ¿Necesito un lector físico?
No para Stripe Tap to Pay. El celular actúa como terminal. Pero SI necesitas hardware para Stripe Terminal tradicional.

### ¿Funciona en producción desde Uruguay?
No. Stripe solo permite cuentas merchant en Brasil y México en LATAM. Necesitarías Stripe Atlas o empresa en país soportado.

---

**¿Dudas?** La implementación está completa y lista para testing en modo desarrollo.
