import NewsCarousel from '@/Components/NewsCarrousel';
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
import { ActivityIndicator, Button, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  );

  return (
    <ScrollView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>

        <View style={styles.header}>
          <ThemedText type='title'>DeepWild</ThemedText>
          <ThemeModeButton/>
        </View>

        {/* SECTION HISTORIQUE */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText bold>Dernier animal reconnu</ThemedText>
            <Pressable onPress={() => router.push("/(tabs)/historique")}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ThemedText style={{ fontSize: 14, color: 'gray' }}> Historique </ThemedText>
                <MoveRight size={16} color="gray" /> 
              </View>
            </Pressable>
          </View>

          {user ? (
              isFetching ? (
                  <ActivityIndicator size="large" style={{marginTop: 20}} />
              ) : lastHistoryItem ? (
                  <RenderCarte item={lastHistoryItem} />
              ) : (
                  <ThemedText style={styles.emptyText}>Aucune analyse récente</ThemedText>
              )
          ) : (
              <ThemedText style={{marginTop: 10, opacity: 0.7}}>Connectez-vous pour voir vos scans</ThemedText> 
          )}
        </View>

        

        <View style={styles.section}>
          <ThemedText bold style={{marginBottom: 10}}>Aider l'IA à apprendre</ThemedText>
          <ThemedText style={{marginBottom: 15, fontSize: 14, opacity: 0.7}}>
            Contribuez à la science en dessinant les contours des animaux sur vos photos.
          </ThemedText>
          <Button
            title='Contribuer au Dataset'
            onPress={() => router.push('/(tabs)/contribute')}
          />
        </View>

        <View style={styles.section}>
          <ThemedText bold>Actualité du monde animale</ThemedText>
          <NewsCarousel/>
        </View>

      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20, // Padding global sur les côtés
    paddingTop: 20,
  },
  header: {
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 25
  },
  section: {
    marginBottom: 30, // Espace entre les blocs
  },
  sectionHeader: { 
    marginBottom: 15, 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  emptyText: {
    opacity: 0.6, 
    fontStyle: 'italic', 
    marginTop: 10,
    textAlign: 'center'
  }
});