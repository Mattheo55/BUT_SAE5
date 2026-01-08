import RenderCarte from '@/Components/RenderCarte';
import ThemedText from '@/Components/ThemedText';
import ThemedView from '@/Components/ThemedView';
import ThemeModeButton from '@/Components/ThemeModeButton';
import { API_URL } from '@/helper/constant';
import { HistoriqueItem } from '@/Type/Item';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import { MoveRight } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native'; // 👈 N'oublie pas d'importer ActivityIndicator
import { useAuth } from './compte';

export default function Index() {

  const {user, isLoading} = useAuth();

  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [lastHistoryItem, setLastHistoryItem] = useState<HistoriqueItem | null>(null);

  const router = useRouter();

  async function fetchData() {
    if(!user?.id) return;
    setIsFetching(true);
    try {
      const response = await axios.get(`${API_URL}/last_history`, {params: {user_id: user.id}});
      setLastHistoryItem(response.data);
    } catch (e : any) {
        console.log(e);
    } finally {
      setIsFetching(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      if(user) {
        fetchData()
      }
    }, [user])
  )

  return (
    <ThemedView>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 }}>
        <ThemedText type='title'>DeepWild</ThemedText>
        <ThemeModeButton/>
      </View>

      <View>
        <View style={{ marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          {/* Correction orthographe : reconnu */}
          <ThemedText bold>Dernier animal reconnu</ThemedText>
          <Pressable onPress={() => router.push("/(tabs)/historique")}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ThemedText> Historique </ThemedText>
              <MoveRight size={20} color="gray" /> 
            </View>
          </Pressable>
        </View>

        {user ? (
            isFetching ? (
                // Cas 1 : Ça charge, on montre la roue
                <ActivityIndicator size="large" style={{marginTop: 20}} />
            ) : lastHistoryItem ? (
                // Cas 2 : On a trouvé un animal
                <RenderCarte item={lastHistoryItem} />
            ) : (
                // Cas 3 : Connecté mais liste vide
                <ThemedText style={{opacity: 0.6, fontStyle: 'italic', marginTop: 10}}>Aucune analyse récente</ThemedText>
            )
        ) : (
            // Cas 4 : Pas connecté
            <ThemedText style={{marginTop: 10}}>Connectez-vous pour enregistrer tous vos scans</ThemedText> 
        )}
        
      </View>
    </ThemedView>
  );
}