# 🚀 Instrucciones de Configuración - API de Reembolsos

Sigue estos pasos para configurar la funcionalidad de reembolsos en tu aplicación.

## 📋 Pasos de Configuración

### Paso 1: Aplicar Migración de Base de Datos

Aplica el SQL contenido en el archivo `CREATE_REFUNDS_TABLE.sql` a tu base de datos de Supabase.

**Opción A: Desde el Dashboard de Supabase**
1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a SQL Editor
3. Copia el contenido de `CREATE_REFUNDS_TABLE.sql`
4. Pégalo en el editor
5. Haz clic en "Run" para ejecutar la migración

**Opción B: Usando la herramienta MCP (si está disponible)**
```bash
# Si tienes acceso a las herramientas MCP de Supabase
mcp__supabase__apply_migration CREATE_REFUNDS_TABLE.sql
```

### Paso 2: Desplegar la Función Edge

La función edge `refund-mercadopago-payment` necesita ser desplegada a Supabase.

**Ubicación de la función:**
```
supabase/functions/refund-mercadopago-payment/index.ts
```

**Opción A: Despliegue Automático (si está configurado en Bolt)**
- La función se desplegará automáticamente al guardar cambios en el archivo

**Opción B: Usando la herramienta MCP (si está disponible)**
```bash
mcp__supabase__deploy_edge_function refund-mercadopago-payment
```

**Opción C: Manual usando Supabase CLI**
```bash
# Si tienes Supabase CLI instalado localmente
supabase functions deploy refund-mercadopago-payment
```

### Paso 3: Verificar el Despliegue

1. Ve a tu Dashboard de Supabase
2. Navega a Edge Functions
3. Verifica que `refund-mercadopago-payment` esté listada
4. Verifica que el estado sea "Active"

### Paso 4: Probar la Función

Usa el siguiente comando cURL para probar (reemplaza los valores):

```bash
curl -X POST \
  https://TU-PROYECTO.supabase.co/functions/v1/refund-mercadopago-payment \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TU-ANON-KEY' \
  -d '{
    "payment_id": 123456789,
    "access_token": "TEST-tu-access-token"
  }'
```

## 📚 Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `CREATE_REFUNDS_TABLE.sql` | Migración SQL para crear la tabla de refunds |
| `supabase/functions/refund-mercadopago-payment/index.ts` | Función edge para procesar reembolsos |
| `REFUND_API_GUIDE.md` | Guía completa de uso de la API |
| `REFUND_EXAMPLE_COMPONENT.tsx` | Componente de ejemplo React Native |

## 🔍 Verificación de Configuración

### Verificar que la tabla existe:
```sql
SELECT * FROM refunds LIMIT 1;
```

### Verificar políticas RLS:
```sql
SELECT * FROM pg_policies WHERE tablename = 'refunds';
```

### Verificar función edge:
```bash
curl https://TU-PROYECTO.supabase.co/functions/v1/refund-mercadopago-payment \
  -H 'Authorization: Bearer TU-ANON-KEY'
```

## 🎯 Próximos Pasos

1. ✅ Aplicar migración SQL
2. ✅ Desplegar función edge
3. ✅ Probar endpoint con cURL
4. 📱 Integrar en tu app usando `REFUND_EXAMPLE_COMPONENT.tsx`
5. 📖 Leer `REFUND_API_GUIDE.md` para ejemplos completos

## ⚠️ Notas Importantes

- **Seguridad**: Nunca expongas tu `access_token` de Mercado Pago en el código del cliente
- **Testing**: Usa el modo sandbox de Mercado Pago para pruebas
- **Producción**: Cambia a credenciales de producción cuando estés listo
- **Logs**: Revisa los logs en Supabase Dashboard > Edge Functions para debugging

## 🆘 Solución de Problemas

### La función no aparece en el dashboard
- Verifica que el despliegue se haya completado sin errores
- Revisa los logs de despliegue en tu consola
- Intenta redesplegar la función

### Error "Table refunds does not exist"
- Asegúrate de haber ejecutado la migración SQL
- Verifica en SQL Editor: `SELECT * FROM refunds;`

### Error 401 Unauthorized
- Verifica que estés usando el `SUPABASE_ANON_KEY` correcto
- Confirma que el header `Authorization` esté bien formado

### Error "refund not allowed"
- El pago puede no ser elegible para reembolso
- Verifica que el pago esté aprobado
- Confirma que no se haya reembolsado previamente

## 📞 Soporte

Para más información consulta:
- `REFUND_API_GUIDE.md` - Guía completa de la API
- [Documentación de Mercado Pago](https://www.mercadopago.com.uy/developers)
- [Documentación de Supabase Edge Functions](https://supabase.com/docs/guides/functions)
