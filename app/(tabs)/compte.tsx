import React, { createContext, ReactNode, useContext, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// --- 1. TYPES & INTERFACES ---

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string) => void;
  register: (email: string, name: string) => void;
  logout: () => void;
}

// --- 2. CONTEXTE D'AUTHENTIFICATION (Simulation) ---
// Dans une vraie app, cela serait probablement dans un fichier séparé (ex: AuthContext.tsx)

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (email: string) => {
    // Simulation d'un appel API
    console.log("Connexion avec :", email);
    setUser({ id: '123', email, name: 'Utilisateur Test' });
  };

  const register = (email: string, name: string) => {
    // Simulation d'un appel API
    console.log("Inscription de :", name);
    setUser({ id: '123', email, name });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personnalisé pour utiliser l'auth plus facilement
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return context;
};

// --- 3. COMPOSANT : VUE PROFIL (Si connecté) ---

const ProfileView = () => {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mon Compte</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.label}>Nom</Text>
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

// --- 4. COMPOSANT : VUE AUTHENTIFICATION (Si pas connecté) ---

const AuthView = () => {
  const { login, register } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true); // Switch entre Login et Sign up
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!email || !password) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }

    if (isLoginMode) {
      login(email);
    } else {
      if (!name) return Alert.alert("Erreur", "Le nom est requis");
      register(email, name);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isLoginMode ? 'Se connecter' : 'Créer un compte'}
      </Text>
      
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
            {isLoginMode ? 'Se connecter' : "S'inscrire"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
          <Text style={styles.switchText}>
            {isLoginMode 
              ? "Pas encore de compte ? S'inscrire" 
              : "Déjà un compte ? Se connecter"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- 5. PAGE PRINCIPALE (Le "Contrôleur") ---

const AccountScreenContent = () => {
  const { user } = useAuth();
  
  // C'est ici que la magie opère : Rendu conditionnel
  return (
    <SafeAreaView style={styles.safeArea}>
      {user ? <ProfileView /> : <AuthView />}
    </SafeAreaView>
  );
};

// On exporte le composant wrappé dans le Provider
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
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 30, textAlign: 'center' },
  
  // Style Carte Profil
  card: { backgroundColor: 'white', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  label: { fontSize: 12, color: '#888', marginBottom: 4 },
  value: { fontSize: 16, color: '#333', fontWeight: '500', marginBottom: 15 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  
  // Style Formulaire
  form: { width: '100%' },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  
  // Boutons
  primaryButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { marginTop: 30, padding: 15, alignItems: 'center' },
  logoutText: { color: '#FF3B30', fontWeight: '600', fontSize: 16 },
  switchText: { marginTop: 20, color: '#007AFF', textAlign: 'center' },
});