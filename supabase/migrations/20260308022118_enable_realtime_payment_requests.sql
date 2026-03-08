/*
  # Habilitar Realtime para Payment Requests

  1. Cambios
    - Habilitar replicación en tiempo real para la tabla payment_requests
    - Esto permite que la app POS reciba notificaciones instantáneas cuando llega una nueva solicitud de pago

  2. Funcionalidad
    - La app móvil recibirá actualizaciones en tiempo real cuando se cree una nueva solicitud de pago vía API
    - No requiere polling o refresh manual
*/

-- Habilitar Realtime para la tabla payment_requests
ALTER PUBLICATION supabase_realtime ADD TABLE payment_requests;
