# POS Mobile - Sistema de Punto de Venta con NFC

Aplicación móvil completa de punto de venta (POS) con capacidad de procesamiento de pagos mediante NFC y pasarelas de pago.

## Características Principales

### 🔐 Autenticación
- Sistema completo de registro e inicio de sesión
- Autenticación segura con Supabase
- Protección de rutas para usuarios autenticados

### 💳 Procesamiento de Pagos
- **Lectura NFC**: Procesa pagos usando tarjetas de crédito/débito por contacto NFC
- **Pago Manual**: Opción para procesar pagos manualmente sin NFC
- Estados visuales claros: pendiente, procesando, éxito, error
- Notificaciones en tiempo real del estado del pago

### 🔌 Integración con Pasarelas de Pago
- Soporte para múltiples pasarelas:
  - MercadoPago
  - dLocal
  - Modo simulación para pruebas
- Configuración de API keys y secrets
- Modo sandbox para desarrollo
- Gestión de múltiples pasarelas por usuario

### ⚙️ Configuración del Negocio
- Información del negocio (nombre, NIT/RUC)
- Configuración de moneda
- Conexión con sistema origen (URL y API key)
- Gestión de pasarelas de pago

### 📊 Panel de Control
- Resumen de ventas del día
- Total de transacciones
- Ventas de la semana
- Transacciones pendientes

### 📜 Historial de Transacciones
- Registro completo de todas las transacciones
- Filtros por estado (todas, exitosas, pendientes, fallidas)
- Detalles de cada transacción:
  - Monto y moneda
  - Método de pago
  - Número de factura
  - Referencia de transacción
  - Mensajes de error (si aplica)
- Actualización mediante pull-to-refresh

## Arquitectura

### Base de Datos (Supabase)

#### Tablas:
1. **payment_gateways**: Configuración de pasarelas de pago
2. **pos_configurations**: Configuración del negocio y sistema origen
3. **transactions**: Registro de todas las transacciones

#### Seguridad:
- Row Level Security (RLS) habilitado en todas las tablas
- Los usuarios solo pueden acceder a sus propios datos
- Políticas restrictivas por defecto

### Edge Function

**process-payment**: Función serverless que procesa pagos
- Maneja la integración con pasarelas de pago
- Procesa pagos de MercadoPago, dLocal
- Modo simulación para pruebas
- Registra todas las transacciones

## Estructura del Proyecto

```
app/
├── auth.tsx                    # Pantalla de login/registro
├── index.tsx                   # Ruta principal con redirección
├── _layout.tsx                 # Layout raíz con AuthProvider
└── (tabs)/
    ├── _layout.tsx             # Configuración de navegación por pestañas
    ├── index.tsx               # Panel de control (Home)
    ├── payment.tsx             # Pantalla de procesamiento de pagos
    ├── history.tsx             # Historial de transacciones
    └── settings.tsx            # Configuración del negocio y pasarelas

contexts/
└── AuthContext.tsx             # Contexto de autenticación

lib/
└── supabase.ts                 # Cliente de Supabase configurado

supabase/functions/
└── process-payment/            # Edge function para procesar pagos
    └── index.ts
```

## Flujo de Uso

### Primera Configuración:
1. Registrarse o iniciar sesión
2. Ir a Configuración
3. Completar información del negocio
4. Agregar al menos una pasarela de pago
5. Activar la pasarela de pago

### Procesar un Pago:
1. Ir a la pestaña "Cobrar"
2. Ingresar el monto a cobrar
3. (Opcional) Ingresar número de factura
4. Elegir método:
   - **NFC**: Presionar "Leer Tarjeta NFC" y acercar la tarjeta
   - **Manual**: Presionar "Procesar Pago Manual"
5. Esperar confirmación
6. Ver resultado (éxito o error)

### Ver Historial:
1. Ir a la pestaña "Historial"
2. Usar filtros para ver transacciones específicas
3. Deslizar hacia abajo para actualizar

## Tecnologías Utilizadas

- **React Native**: Framework de desarrollo móvil
- **Expo**: Plataforma de desarrollo
- **TypeScript**: Tipado estático
- **Supabase**: Backend (Base de datos, autenticación, edge functions)
- **expo-nfc**: Lectura de tarjetas NFC
- **React Navigation**: Navegación
- **Lucide Icons**: Iconos

## Compatibilidad

### Plataformas:
- ✅ Web (funcionalidad limitada de NFC)
- ✅ iOS (requiere permisos de NFC)
- ✅ Android (requiere permisos de NFC)

### Requisitos:
- **Para NFC**:
  - iOS 13+ con capacidad NFC
  - Android 4.4+ (API level 19) con chip NFC
- **Para Web**:
  - Navegador moderno
  - Solo pagos manuales disponibles

## Seguridad

- Todas las API keys se almacenan en la base de datos del usuario
- Las comunicaciones con pasarelas se realizan server-side
- Row Level Security protege los datos de cada usuario
- Autenticación requerida para todas las operaciones
- Tokens JWT para validación de sesiones

## Notas Importantes

1. **NFC en Web**: La funcionalidad NFC no está disponible en la versión web
2. **Modo Sandbox**: Recomendado para desarrollo y pruebas
3. **Pasarelas Reales**: Configurar con credenciales reales solo en producción
4. **Sistema Origen**: Opcional, para integración con sistemas de facturación existentes

## Desarrollo

### Instalación:
```bash
npm install
```

### Desarrollo:
```bash
npm run dev
```

### Build Web:
```bash
npm run build:web
```

### Build Nativo:
Requiere Expo Dev Client para probar NFC en dispositivos reales
```bash
npx expo prebuild
```

## Solución de Problemas

### Error: AsyncStorage Native module is null

Si encuentras este error al conectarte desde un dispositivo móvil:

1. **Limpia la caché de Metro**:
```bash
npm run dev:clear
```

2. **Si el problema persiste, reinstala las dependencias**:
```bash
rm -rf node_modules
npm install
npm run dev:clear
```

### Error: ENOENT InternalBytecode.js

Este error está relacionado con Metro bundler. Para solucionarlo:

1. **Detén el servidor de desarrollo** (Ctrl+C)
2. **Limpia la caché**:
```bash
npm run dev:clear
```

### La app no se conecta al servidor de desarrollo

1. Asegúrate de que tu dispositivo móvil y tu computadora estén en la misma red WiFi
2. Verifica que no haya un firewall bloqueando la conexión
3. Intenta reiniciar el servidor con:
```bash
npm run dev:clear
```

### NFC no funciona en el dispositivo

1. Verifica que tu dispositivo tenga capacidad NFC
2. Asegúrate de que NFC esté activado en la configuración del dispositivo
3. En iOS, necesitas crear una build nativa (Expo Dev Client)
4. En Android, verifica los permisos en la configuración de la app

### Problemas de autenticación

1. Verifica que las variables de entorno en `.env` sean correctas
2. Asegúrate de tener una conexión a internet activa
3. Revisa la consola para ver mensajes de error específicos
