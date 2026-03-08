import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Building, CreditCard, Save, Trash2, Key, Copy, Plus, Edit2, X } from 'lucide-react-native';

interface POSConfig {
  business_name: string;
  business_id: string;
  currency: string;
  origin_system_url: string;
  origin_system_api_key: string;
}

interface Gateway {
  id?: string;
  gateway_name: string;
  api_key: string;
  api_secret: string;
  is_active: boolean;
  is_sandbox: boolean;
}

interface APIKey {
  id: string;
  key: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

export default function SettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<POSConfig>({
    business_name: '',
    business_id: '',
    currency: 'USD',
    origin_system_url: '',
    origin_system_api_key: '',
  });
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [newGateway, setNewGateway] = useState<Gateway>({
    gateway_name: 'mercadopago',
    api_key: '',
    api_secret: '',
    is_active: false,
    is_sandbox: true,
  });
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [editingGatewayId, setEditingGatewayId] = useState<string | null>(null);
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
      return;
    }
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const [configResult, gatewaysResult, apiKeysResult] = await Promise.all([
        supabase.from('pos_configurations').select('*').maybeSingle(),
        supabase.from('payment_gateways').select('*'),
        supabase.from('api_keys').select('*').order('created_at', { ascending: false }),
      ]);

      if (configResult.data) {
        setConfig({
          business_name: configResult.data.business_name || '',
          business_id: configResult.data.business_id || '',
          currency: configResult.data.currency || 'USD',
          origin_system_url: configResult.data.origin_system_url || '',
          origin_system_api_key: configResult.data.origin_system_api_key || '',
        });
      }

      if (gatewaysResult.data) {
        setGateways(gatewaysResult.data);
      }

      if (apiKeysResult.data) {
        setApiKeys(apiKeysResult.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config.business_name) {
      Alert.alert('Error', 'El nombre del negocio es requerido');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('pos_configurations')
        .upsert(
          {
            user_id: user!.id,
            business_name: config.business_name,
            business_id: config.business_id,
            currency: config.currency,
            origin_system_url: config.origin_system_url,
            origin_system_api_key: config.origin_system_api_key,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        );

      if (error) throw error;
      Alert.alert('Éxito', 'Configuración guardada correctamente');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const addGateway = async () => {
    if (!newGateway.api_key) {
      Alert.alert('Error', 'La API Key es requerida');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('payment_gateways').insert({
        user_id: user!.id,
        gateway_name: newGateway.gateway_name,
        api_key: newGateway.api_key,
        api_secret: newGateway.api_secret,
        is_active: newGateway.is_active,
        is_sandbox: newGateway.is_sandbox,
      });

      if (error) throw error;
      Alert.alert('Éxito', 'Pasarela agregada correctamente');
      setNewGateway({
        gateway_name: 'mercadopago',
        api_key: '',
        api_secret: '',
        is_active: false,
        is_sandbox: true,
      });
      loadSettings();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo agregar la pasarela');
    } finally {
      setSaving(false);
    }
  };

  const editGateway = (gateway: Gateway) => {
    setEditingGatewayId(gateway.id!);
    setEditingGateway({ ...gateway });
  };

  const cancelEditGateway = () => {
    setEditingGatewayId(null);
    setEditingGateway(null);
  };

  const saveGateway = async () => {
    if (!editingGateway || !editingGateway.api_key) {
      Alert.alert('Error', 'La API Key es requerida');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('payment_gateways')
        .update({
          gateway_name: editingGateway.gateway_name,
          api_key: editingGateway.api_key,
          api_secret: editingGateway.api_secret,
          is_active: editingGateway.is_active,
          is_sandbox: editingGateway.is_sandbox,
        })
        .eq('id', editingGatewayId!);

      if (error) throw error;
      Alert.alert('Éxito', 'Pasarela actualizada correctamente');
      setEditingGatewayId(null);
      setEditingGateway(null);
      loadSettings();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la pasarela');
    } finally {
      setSaving(false);
    }
  };

  const deleteGateway = async (id: string) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de eliminar esta pasarela?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('payment_gateways')
                .delete()
                .eq('id', id);

              if (error) throw error;
              loadSettings();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const generateAPIKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'pos_';
    for (let i = 0; i < 48; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const createAPIKey = async () => {
    if (!newApiKeyName.trim()) {
      Alert.alert('Error', 'El nombre de la API Key es requerido');
      return;
    }

    setSaving(true);
    try {
      const newKey = generateAPIKey();
      const { error } = await supabase.from('api_keys').insert({
        user_id: user!.id,
        key: newKey,
        name: newApiKeyName.trim(),
        is_active: true,
      });

      if (error) throw error;

      Alert.alert(
        'API Key Creada',
        `Tu nueva API Key es:\n\n${newKey}\n\nCópiala ahora, no podrás verla de nuevo.`,
        [{ text: 'Copiar', onPress: () => copyToClipboard(newKey) }]
      );

      setNewApiKeyName('');
      loadSettings();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo crear la API Key');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(text);
      Alert.alert('Copiado', 'API Key copiada al portapapeles');
    } else {
      Alert.alert('API Key', text);
    }
  };

  const deleteAPIKey = async (id: string) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de eliminar esta API Key?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('api_keys')
                .delete()
                .eq('id', id);

              if (error) throw error;
              loadSettings();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const toggleAPIKey = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadSettings();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Building size={24} color="#2563eb" strokeWidth={2} />
            <Text style={styles.sectionTitle}>Información del Negocio</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Nombre del negocio *"
            value={config.business_name}
            onChangeText={(text) => setConfig({ ...config, business_name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="NIT / RUC / ID Fiscal"
            value={config.business_id}
            onChangeText={(text) => setConfig({ ...config, business_id: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Moneda (USD, COP, etc.)"
            value={config.currency}
            onChangeText={(text) => setConfig({ ...config, currency: text.toUpperCase() })}
          />
          <TextInput
            style={styles.input}
            placeholder="URL del sistema origen"
            value={config.origin_system_url}
            onChangeText={(text) => setConfig({ ...config, origin_system_url: text })}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="API Key del sistema origen"
            value={config.origin_system_api_key}
            onChangeText={(text) => setConfig({ ...config, origin_system_api_key: text })}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={saveConfig}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save size={20} color="#fff" strokeWidth={2} />
                <Text style={styles.buttonText}>Guardar Configuración</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Key size={24} color="#2563eb" strokeWidth={2} />
            <Text style={styles.sectionTitle}>API Keys para Integraciones</Text>
          </View>

          <View style={styles.helpBox}>
            <Text style={styles.helpTitle}>¿Para qué sirven las API Keys?</Text>
            <Text style={styles.helpText}>
              Las API Keys permiten que tus sistemas externos (web, apps, etc.) envíen solicitudes de pago a este POS de forma segura.
            </Text>
          </View>

          {apiKeys.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              {apiKeys.map((apiKey) => (
                <View key={apiKey.id} style={styles.apiKeyCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.apiKeyName}>{apiKey.name}</Text>
                    <Text style={styles.apiKeyValue}>
                      {apiKey.key.substring(0, 16)}...{apiKey.key.substring(apiKey.key.length - 8)}
                    </Text>
                    <View style={styles.apiKeyInfo}>
                      <Text style={styles.apiKeyDate}>
                        Creada: {new Date(apiKey.created_at).toLocaleDateString()}
                      </Text>
                      {apiKey.last_used_at && (
                        <Text style={styles.apiKeyDate}>
                          Último uso: {new Date(apiKey.last_used_at).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    {apiKey.is_active && (
                      <View style={[styles.badge, { backgroundColor: '#dcfce7', marginTop: 8 }]}>
                        <Text style={[styles.badgeText, { color: '#16a34a' }]}>Activa</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity onPress={() => copyToClipboard(apiKey.key)}>
                      <Copy size={20} color="#2563eb" strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleAPIKey(apiKey.id, apiKey.is_active)}>
                      <Text style={{ fontSize: 20 }}>{apiKey.is_active ? '🔓' : '🔒'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteAPIKey(apiKey.id)}>
                      <Trash2 size={20} color="#dc2626" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.newApiKeyForm}>
            <Text style={styles.formLabel}>Crear Nueva API Key</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre descriptivo (ej: Sistema Web, App Móvil)"
              value={newApiKeyName}
              onChangeText={setNewApiKeyName}
            />
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, saving && styles.buttonDisabled]}
              onPress={createAPIKey}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <>
                  <Plus size={20} color="#2563eb" strokeWidth={2} />
                  <Text style={[styles.buttonText, { color: '#2563eb' }]}>
                    Generar API Key
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CreditCard size={24} color="#2563eb" strokeWidth={2} />
            <Text style={styles.sectionTitle}>Pasarelas de Pago</Text>
          </View>

          {gateways.map((gateway) => {
            const isEditing = editingGatewayId === gateway.id;

            if (isEditing && editingGateway) {
              return (
                <View key={gateway.id} style={styles.editGatewayForm}>
                  <View style={styles.editHeader}>
                    <Text style={styles.formLabel}>Editando Pasarela</Text>
                    <TouchableOpacity onPress={cancelEditGateway}>
                      <X size={20} color="#64748b" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>Gateway</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="stripe, mercadopago, dlocal"
                    value={editingGateway.gateway_name}
                    onChangeText={(text) =>
                      setEditingGateway({ ...editingGateway, gateway_name: text.toLowerCase() })
                    }
                    autoCapitalize="none"
                  />

                  <Text style={styles.fieldLabel}>API Key / Secret Key</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Tu API Key"
                    value={editingGateway.api_key}
                    onChangeText={(text) =>
                      setEditingGateway({ ...editingGateway, api_key: text })
                    }
                    autoCapitalize="none"
                    multiline={false}
                  />

                  <Text style={styles.fieldLabel}>API Secret (solo para dLocal)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Dejar vacío para Stripe y MercadoPago"
                    value={editingGateway.api_secret}
                    onChangeText={(text) =>
                      setEditingGateway({ ...editingGateway, api_secret: text })
                    }
                    autoCapitalize="none"
                  />

                  <View style={styles.checkboxGroup}>
                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() =>
                        setEditingGateway({
                          ...editingGateway,
                          is_active: !editingGateway.is_active,
                        })
                      }
                    >
                      <View
                        style={[
                          styles.checkboxBox,
                          editingGateway.is_active && styles.checkboxBoxChecked,
                        ]}
                      />
                      <Text style={styles.checkboxLabel}>Activar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() =>
                        setEditingGateway({
                          ...editingGateway,
                          is_sandbox: !editingGateway.is_sandbox,
                        })
                      }
                    >
                      <View
                        style={[
                          styles.checkboxBox,
                          editingGateway.is_sandbox && styles.checkboxBoxChecked,
                        ]}
                      />
                      <Text style={styles.checkboxLabel}>Modo Sandbox</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[
                        styles.button,
                        { flex: 1, backgroundColor: '#e2e8f0' },
                      ]}
                      onPress={cancelEditGateway}
                    >
                      <Text style={[styles.buttonText, { color: '#64748b' }]}>
                        Cancelar
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, { flex: 1 }, saving && styles.buttonDisabled]}
                      onPress={saveGateway}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Save size={20} color="#fff" strokeWidth={2} />
                          <Text style={styles.buttonText}>Guardar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            return (
              <View key={gateway.id} style={styles.gatewayCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gatewayName}>{gateway.gateway_name}</Text>
                  <Text style={styles.gatewayKey}>
                    {gateway.api_key.substring(0, 20)}...
                  </Text>
                  <View style={styles.gatewayBadges}>
                    {gateway.is_active && (
                      <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
                        <Text style={[styles.badgeText, { color: '#16a34a' }]}>Activa</Text>
                      </View>
                    )}
                    {gateway.is_sandbox && (
                      <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
                        <Text style={[styles.badgeText, { color: '#ca8a04' }]}>Sandbox</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => editGateway(gateway)}>
                    <Edit2 size={20} color="#2563eb" strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteGateway(gateway.id!)}>
                    <Trash2 size={20} color="#dc2626" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <View style={styles.newGatewayForm}>
            <Text style={styles.formLabel}>Agregar Nueva Pasarela</Text>

            {newGateway.gateway_name === 'stripe' && (
              <View style={styles.helpBox}>
                <Text style={styles.helpTitle}>Cómo obtener tu API Key de Stripe:</Text>
                <Text style={styles.helpText}>
                  1. Ve a: dashboard.stripe.com/test/apikeys{'\n'}
                  2. Copia tu "Secret key" (empieza con sk_test_){'\n'}
                  3. Pégala en el campo "API Key" abajo{'\n'}
                  4. Activa "Modo Sandbox" para pruebas
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Gateway</Text>
            <TextInput
              style={styles.input}
              placeholder="stripe, mercadopago, dlocal"
              value={newGateway.gateway_name}
              onChangeText={(text) =>
                setNewGateway({ ...newGateway, gateway_name: text.toLowerCase() })
              }
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>
              API Key / Secret Key {newGateway.gateway_name === 'stripe' && '(sk_test_...)'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={
                newGateway.gateway_name === 'stripe'
                  ? 'sk_test_51...'
                  : 'Tu API Key'
              }
              value={newGateway.api_key}
              onChangeText={(text) => setNewGateway({ ...newGateway, api_key: text })}
              autoCapitalize="none"
              multiline={false}
            />

            <Text style={styles.fieldLabel}>API Secret (solo para dLocal)</Text>
            <TextInput
              style={styles.input}
              placeholder="Dejar vacío para Stripe y MercadoPago"
              value={newGateway.api_secret}
              onChangeText={(text) => setNewGateway({ ...newGateway, api_secret: text })}
              autoCapitalize="none"
            />

            <View style={styles.checkboxGroup}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() =>
                  setNewGateway({ ...newGateway, is_active: !newGateway.is_active })
                }
              >
                <View
                  style={[
                    styles.checkboxBox,
                    newGateway.is_active && styles.checkboxBoxChecked,
                  ]}
                />
                <Text style={styles.checkboxLabel}>Activar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkbox}
                onPress={() =>
                  setNewGateway({ ...newGateway, is_sandbox: !newGateway.is_sandbox })
                }
              >
                <View
                  style={[
                    styles.checkboxBox,
                    newGateway.is_sandbox && styles.checkboxBoxChecked,
                  ]}
                />
                <Text style={styles.checkboxLabel}>Modo Sandbox</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, saving && styles.buttonDisabled]}
              onPress={addGateway}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text style={[styles.buttonText, { color: '#2563eb' }]}>
                  Agregar Pasarela
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonSecondary: {
    backgroundColor: '#dbeafe',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  gatewayCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  gatewayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    textTransform: 'capitalize',
  },
  gatewayKey: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  gatewayBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  newGatewayForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 6,
    marginTop: 8,
  },
  helpBox: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 20,
  },
  checkboxGroup: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 4,
  },
  checkboxBoxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  apiKeyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  apiKeyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  apiKeyValue: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#64748b',
    marginBottom: 8,
  },
  apiKeyInfo: {
    gap: 4,
  },
  apiKeyDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  newApiKeyForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  editGatewayForm: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
});
