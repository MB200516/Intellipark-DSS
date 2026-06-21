import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { officerLogin } from '../lib/api';

export default function LoginScreen({ navigation }) {
  const [badge, setBadge] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await officerLogin(badge.trim(), password);
      navigation.replace('Home', { officer: data.officer });
    } catch (e) {
      console.log('LOGIN ERROR:', e.message);
      setError(e.message || 'Invalid badge or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brandBlock}>
        <Text style={styles.agency}>BENGALURU TRAFFIC POLICE</Text>
        <Text style={styles.title}>INTELLIPARK</Text>
        <Text style={styles.subtitle}>OFFICER FIELD UNIT</Text>
        <View style={styles.rule} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>BADGE NUMBER</Text>
        <TextInput
          style={styles.input}
          value={badge}
          onChangeText={setBadge}
          placeholder="e.g. BTP-A1"
          placeholderTextColor="#999"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          placeholderTextColor="#999"
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading || !badge || !password}
        >
          {loading ? (
            <ActivityIndicator color="#F0EDE8" />
          ) : (
            <Text style={styles.buttonText}>SIGN IN</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>Demo: BTP-A1 / officer123</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0EDE8', justifyContent: 'center', padding: 28 },
  brandBlock: { marginBottom: 48, alignItems: 'center' },
  agency: { fontSize: 11, letterSpacing: 2, color: '#A0141E', fontWeight: '700', marginBottom: 8 },
  title: { fontSize: 30, letterSpacing: 3, color: '#111', fontWeight: '700' },
  subtitle: { fontSize: 12, letterSpacing: 3, color: '#555', marginTop: 6, fontWeight: '600' },
  rule: { width: 50, height: 3, backgroundColor: '#A0141E', marginTop: 16 },
  form: { width: '100%' },
  label: { fontSize: 12, letterSpacing: 1.2, color: '#333', fontWeight: '700', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)', borderBottomWidth: 2,
    borderBottomColor: 'rgba(160,20,30,0.4)', padding: 14, fontSize: 16,
    backgroundColor: '#fff', color: '#111',
  },
  error: { color: '#7B0D14', marginTop: 14, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  button: {
    backgroundColor: '#A0141E', padding: 16, alignItems: 'center',
    marginTop: 28, justifyContent: 'center', minHeight: 52,
  },
  buttonText: { color: '#F0EDE8', fontSize: 14, letterSpacing: 2, fontWeight: '700' },
  hint: { textAlign: 'center', color: '#999', fontSize: 13, marginTop: 16 },
});
