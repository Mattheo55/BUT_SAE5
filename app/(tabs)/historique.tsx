import RenderCarte from '@/Components/RenderCarte';
import ThemedText from '@/Components/ThemedText';
import { API_URL } from '@/helper/constant';
import { HistoriqueItem } from '@/Type/Item';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './compte';

export default function Historique() {
  const router = useRouter();
  const [historyData, setHistoryData] = React.useState<HistoriqueItem[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);
  const { user, isLoading } = useAuth();

  // Redirection si pas connecté
  useEffect(() => {
    if (!isLoading && !user) {
        // Optionnel : tu peux laisser l'affichage "Connectez-vous" plus bas au lieu de forcer l'alerte
    }
  }, [user, isLoading]);

  // Chargement des données quand la page prend le focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchData();
      }
    }, [user])
  );

  async function fetchData() {
    if (!user?.id) return;
    setIsFetching(true);
    try {
      const response = await axios.get(`${API_URL}/get_history`, { params: { user_id: user.id } });
      setHistoryData(response.data);
    } catch (error: any) {
      console.log(error); // Evite de spammer l'alerte si pas de réseau
    } finally {
      setIsFetching(false);
    }
  }

  // --- Affichage Chargement ---
  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  // --- Affichage Non Connecté ---
  if (!user) {
    return (
      <SafeAreaView style={{ justifyContent: "center", alignItems: "center", flex: 1, backgroundColor: '#F6F7FB' }}>
        <ThemedText type='title'>Connectez-vous</ThemedText>
        <ThemedText style={{marginTop: 10, textAlign: 'center', paddingHorizontal: 20}}>
            Connectez-vous dans l'onglet Compte pour accéder à votre historique personnel.
        </ThemedText>
      </SafeAreaView>
    );
  }

  // --- Affichage Liste Historique ---
  return (
    <SafeAreaView style={styles.zoneSecurisee} edges={['top', 'left', 'right']}>
      
      {/* Correction : On utilise FlatList comme conteneur principal 
         au lieu d'une ScrollView pour la performance 
      */}
      <FlatList
        data={historyData}
        keyExtractor={(item) => item.id.toString()} // Assure-toi que ID est string
        contentContainerStyle={styles.contenuScroll}
        
        // Header de la liste (Titre + Sous-titre)
        ListHeaderComponent={
          <View>
             <View style={styles.entete}>
                <Text style={styles.titre}>Historique</Text>
             </View>
             <Text style={styles.titreBloc}>Vos analyses récentes</Text>
          </View>
        }

        // Cas où la liste est vide
        ListEmptyComponent={
            !isFetching ? (
                <View style={{alignItems: 'center', marginTop: 50}}>
                    <Text style={{color: 'gray'}}>Aucun historique pour le moment.</Text>
                </View>
            ) : <ActivityIndicator style={{marginTop: 20}} />
        }

        // Correction : renderItem doit être une fonction
        renderItem={({ item }) => (
            <RenderCarte item={item} />
        )}

        // Espacement entre les items
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  zoneSecurisee: {
    flex: 1,
    backgroundColor: '#F6F7FB',
    padding: 20,
  },
  contenuScroll: {
    paddingBottom: 20,
    paddingTop: 10,
  },
  entete: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  titre: {
    fontSize: 28, // Un peu plus grand pour faire moderne
    fontWeight: '800',
    color: '#0F1222',
  },
  titreBloc: {
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6F7B',
    marginBottom: 16,
  },
});