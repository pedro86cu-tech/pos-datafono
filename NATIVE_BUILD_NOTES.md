# Notas para Builds Nativos (iOS/Android)

## ⚠️ IMPORTANTE: Esta es una App Móvil

Esta aplicación está diseñada para correr en **dispositivos móviles** (Android/iOS), no en web.

### Cómo Correr en Desarrollo:

```bash
# Android (recomendado)
npm run android

# iOS
npm run ios

# Menú de opciones
npm start
```

**NO uses `npm run web`** - la funcionalidad estará limitada (sin NFC, sin Stripe).

## Stripe Configuration

Cuando estés listo para hacer un build nativo de la app para iOS o Android (para usar NFC y Stripe), necesitas agregar el plugin de Stripe de vuelta a `app.json`.

### Paso 1: Agregar el plugin de Stripe

En `app.json`, en la sección `plugins`, agrega:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-web-browser",
      [
        "expo-camera",
        {
          "cameraPermission": "Esta aplicación necesita acceso a la cámara para escanear códigos QR y códigos de barras"
        }
      ],
      [
        "@stripe/stripe-react-native",
        {
          "merchantIdentifier": "merchant.com.ayalait.posmobile",
          "enableGooglePay": true,
          "enableApplePay": false
        }
      ]
    ]
  }
}
```

### Paso 2: Crear un nuevo build

```bash
# Para iOS
eas build --platform ios

# Para Android
eas build --platform android
```

## ¿Por qué se removió el plugin de app.json?

El plugin de Stripe causa problemas al correr la app en modo web durante desarrollo, ya que intenta cargar módulos nativos que no existen en web.

El código de la app ya maneja correctamente la carga condicional de Stripe solo en plataformas nativas (ver `app/_layout.tsx` y `app/(tabs)/payment.tsx`), por lo que para desarrollo web no se necesita el plugin.

Para builds nativos, sí necesitas agregar el plugin de nuevo para que Stripe funcione correctamente en iOS y Android.

## Plataformas Soportadas

- **Web**: ✅ Funciona sin Stripe (usa solo Mercado Pago)
- **iOS**: ✅ Requiere plugin de Stripe en app.json
- **Android**: ✅ Requiere plugin de Stripe en app.json

## Alternativa: app.config.js

Si prefieres tener configuración dinámica por plataforma, puedes convertir `app.json` a `app.config.js`:

```javascript
module.exports = ({ config }) => {
  const plugins = [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    [
      'expo-camera',
      {
        cameraPermission: 'Esta aplicación necesita acceso a la cámara para escanear códigos QR y códigos de barras'
      }
    ]
  ];

  // Solo agregar Stripe para builds nativos
  if (process.env.EXPO_PUBLIC_PLATFORM !== 'web') {
    plugins.push([
      '@stripe/stripe-react-native',
      {
        merchantIdentifier: 'merchant.com.ayalait.posmobile',
        enableGooglePay: true,
        enableApplePay: false
      }
    ]);
  }

  return {
    ...config,
    plugins
  };
};
```
