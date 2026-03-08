# Guía de Deployment - POS Mobile

Esta guía te ayudará a deployar la aplicación POS Mobile en iOS y Android usando Expo Application Services (EAS).

## Prerrequisitos

1. Cuenta de Expo: [https://expo.dev/signup](https://expo.dev/signup)
2. EAS CLI instalado: `npm install -g eas-cli`
3. Cuenta de Apple Developer (para iOS)
4. Cuenta de Google Play Developer (para Android)

## Paso 1: Configuración Inicial

### 1.1 Iniciar sesión en Expo

```bash
eas login
```

### 1.2 Configurar el proyecto

```bash
eas init
```

Esto creará un `projectId` único para tu app. Actualiza `app.json` con el ID generado.

### 1.3 Actualizar Bundle Identifiers

En `app.json`, actualiza:

```json
{
  "ios": {
    "bundleIdentifier": "com.tuempresa.posmobile"
  },
  "android": {
    "package": "com.tuempresa.posmobile"
  }
}
```

## Paso 2: Configuración de iOS

### 2.1 Preparar credenciales de Apple

```bash
eas credentials
```

Selecciona iOS y sigue las instrucciones para:
- Crear un App ID
- Generar certificados de desarrollo y distribución
- Crear provisioning profiles

### 2.2 Configurar App Store Connect

1. Ve a [App Store Connect](https://appstoreconnect.apple.com)
2. Crea una nueva app
3. Configura la información básica
4. Agrega capturas de pantalla (6.7", 6.5", y 5.5" requeridas)

### 2.3 Configurar permisos especiales

Para NFC (requerido para pagos contactless):
1. En [Apple Developer Portal](https://developer.apple.com)
2. Ve a Certificates, Identifiers & Profiles
3. Selecciona tu App ID
4. Habilita "NFC Tag Reading" capability
5. Solicita el entitlement especial para pagos NFC (requiere aprobación de Apple)

## Paso 3: Configuración de Android

### 3.1 Generar Keystore

```bash
eas credentials
```

Selecciona Android y deja que EAS genere el keystore automáticamente.

### 3.2 Configurar Google Play Console

1. Ve a [Google Play Console](https://play.google.com/console)
2. Crea una nueva aplicación
3. Completa el contenido de la tienda:
   - Título de la app
   - Descripción corta (80 caracteres)
   - Descripción completa (4000 caracteres)
   - Capturas de pantalla (mínimo 2)
   - Icono de alta resolución (512x512)
   - Gráfico de funciones (1024x500)

### 3.3 Configurar Service Account (para submit automático)

1. En Google Cloud Console, crea un Service Account
2. Dale permisos de "Release Manager"
3. Descarga el JSON key
4. Guárdalo como `google-service-account.json` en la raíz del proyecto
5. Actualiza `eas.json` con la ruta correcta

## Paso 4: Build de la Aplicación

### 4.1 Build de Desarrollo

Para probar en dispositivos físicos:

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

### 4.2 Build de Preview

Para testing interno:

```bash
# iOS (archivo .ipa)
eas build --profile preview --platform ios

# Android (archivo .apk)
eas build --profile preview --platform android
```

### 4.3 Build de Producción

Para las tiendas:

```bash
# iOS (App Store)
eas build --profile production --platform ios

# Android (Google Play)
eas build --profile production --platform android

# Ambas plataformas
eas build --profile production --platform all
```

## Paso 5: Submit a las Tiendas

### 5.1 Submit a App Store

```bash
eas submit --platform ios
```

Necesitarás:
- Apple ID
- App-specific password
- ASC App ID (del App Store Connect)

### 5.2 Submit a Google Play

```bash
eas submit --platform android
```

Esto subirá el .aab al track "internal" en Google Play Console.

## Paso 6: Updates Over-The-Air (OTA)

Expo permite actualizar tu app sin pasar por las tiendas:

```bash
# Publicar update
eas update --branch production --message "Fix de bugs"

# Ver updates publicados
eas update:list
```

Los usuarios recibirán el update automáticamente la próxima vez que abran la app.

## Configuración de Variables de Entorno

Para producción, configura las variables en EAS:

```bash
# Configurar secretos
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://tu-proyecto.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "tu-anon-key"

# Listar secretos
eas secret:list
```

## Testing

### Testing en iOS

1. **TestFlight**: Después del build, invita testers en App Store Connect
2. Los testers recibirán un link para instalar vía TestFlight
3. Pueden enviar feedback directamente

### Testing en Android

1. **Internal Testing**: Crea una lista de testers en Google Play Console
2. Comparte el link de testing
3. Los testers pueden instalar desde Google Play

## Checklist Final

### Antes de lanzar:

- [ ] Logo y splash screen configurados
- [ ] Bundle identifiers únicos
- [ ] Variables de entorno configuradas
- [ ] Builds de prueba exitosos
- [ ] Testing en dispositivos reales
- [ ] Permisos de NFC probados
- [ ] Integración con Stripe/NearPay funcionando
- [ ] Screenshots y assets de tiendas listos
- [ ] Privacy policy URL configurado
- [ ] Términos de servicio disponibles

### iOS específico:

- [ ] Capability de NFC habilitada
- [ ] Entitlements especiales solicitados (para pagos)
- [ ] App Store metadata completa
- [ ] Export compliance configurado

### Android específico:

- [ ] Permisos NFC declarados
- [ ] Adaptive icon configurado
- [ ] Google Play listing completo
- [ ] Content rating completado

## Comandos Útiles

```bash
# Ver builds en progreso
eas build:list --status in-progress

# Ver builds completados
eas build:list --status finished

# Cancelar un build
eas build:cancel

# Ver logs de un build
eas build:view [build-id]

# Configurar credenciales
eas credentials

# Ver información del proyecto
eas project:info

# Ver webhooks configurados
eas webhook:list
```

## Solución de Problemas

### Build falla en iOS

- Verifica que los certificados estén válidos
- Revisa que el bundle ID esté registrado en Apple Developer
- Asegúrate de tener los entitlements necesarios

### Build falla en Android

- Verifica el keystore
- Revisa los permisos en AndroidManifest
- Asegúrate que el package name sea único

### La app no se actualiza (OTA)

- Verifica que la app esté conectada a internet
- Revisa el canal de updates en app.json
- Usa `eas update:view` para ver el status

## Recursos

- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo Submit](https://docs.expo.dev/submit/introduction/)
- [EAS Update](https://docs.expo.dev/eas-update/introduction/)
- [Apple Developer](https://developer.apple.com)
- [Google Play Console](https://play.google.com/console)

## Soporte

Para problemas específicos de deployment, consulta:
- [Expo Forums](https://forums.expo.dev)
- [Expo Discord](https://chat.expo.dev)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/expo)
