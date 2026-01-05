import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- 1. CONFIGURATION & TYPES ---

// ATTENTION : Remplace par TON IP LOCALE (ex: 192.168.1.15)
const API_URL = 'http://10.223.141.182:8000';

interface User {
  id: string | number;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// --- 2. CONTEXTE D'AUTHENTIFICATION ---

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (token) {
          const response = await axios.get(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data); 
        }
      } catch (e) {
        await SecureStore.deleteItemAsync('userToken');
      } finally {
        setIsLoading(false);
      }
    };
    loadStoredUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      const { access_token, user_id, user_name, user_email } = response.data;
      await SecureStore.setItemAsync('userToken', access_token);
      setUser({ id: user_id, email: user_email, name: user_name });
      Alert.alert("Succès", `Bonjour ${user_name} !`);
    } catch (error: any) {
      Alert.alert("Erreur", error.response?.data?.detail || "Erreur de connexion");
    }
  };

  // --- LA FONCTION QUI MANQUAIT ---
  const register = async (email: string, name: string, password: string) => {
    try {
      await axios.post(`${API_URL}/register`, { email, name, password });
      Alert.alert("Succès", "Compte créé ! Vous pouvez vous connecter.");
      // Optionnel : tu peux appeler login(email, password) ici pour connecter direct
    } catch (error: any) {
      Alert.alert("Erreur", error.response?.data?.detail || "Erreur d'inscription");
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return context;
};

// --- 3. VUE PROFIL ---

const ProfileView = () => {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mon Compte</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Utilisateur</Text>
        <Text style={styles.value}>{user?.name}</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- 4. VUE AUTHENTIFICATION ---

const AuthView = () => {
  const { login, register } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!email || !password) {
      return Alert.alert("Erreur", "Veuillez remplir tous les champs");
    }
    if (isLoginMode) {
      login(email, password);
    } else {
      if (!name) return Alert.alert("Erreur", "Le nom est requis");
      register(email, name, password);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLoginMode ? 'Connexion' : 'Inscription'}</Text>
      <View style={styles.form}>
        {!isLoginMode && (
          <TextInput 
            style={styles.input} 
            placeholder="Nom complet" 
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Mot de passe" 
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.primaryButtonText}>
            {isLoginMode ? 'Se connecter' : "Créer mon compte"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
          <Text style={styles.switchText}>
            {isLoginMode ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- 5. PAGE PRINCIPALE ---

const AccountScreenContent = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {user ? <ProfileView /> : <AuthView />}
    </SafeAreaView>
  );
};

export default function AccountScreen() {
  return (
    <AuthProvider>
      <AccountScreenContent />
    </AuthProvider>
  );
}

// --- 6. STYLES ---

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { marginBottom: 40, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 20, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  label: { fontSize: 12, color: '#888', marginBottom: 4 },
  value: { fontSize: 16, color: '#333', fontWeight: '500', marginBottom: 15 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  form: { width: '100%' },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  primaryButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { marginTop: 30, padding: 15, alignItems: 'center' },
  logoutText: { color: '#FF3B30', fontWeight: '600', fontSize: 16 },
  switchText: { marginTop: 20, color: '#007AFF', textAlign: 'center' },
});