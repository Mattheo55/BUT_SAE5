import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BarChart3, Calendar, ChevronLeft } from 'lucide-react-native'; // Ajout de ChevronLeft
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'; // Ajout de Pressable
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Pour gérer l'encoche (Notch)

import ThemedText from '@/Components/ThemedText';
import ThemedView from '@/Components/ThemedView';

export default function ResultatPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets(); // Pour savoir où commence l'écran (sous la caméra)

  function backButtonPressed() {
    router.back()
  }

  if (!params.uri) {
    return (
        <ThemedView style={styles.center}>
            <ThemedText>Erreur : Aucune donnée reçue.</ThemedText>
        </ThemedView>
    )
  }

  return (
    <ThemedView style={{ flex: 1 }} fullPadding={false}>
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable 
        onPress={backButtonPressed} 
        style={[styles.backBtn, { top: insets.top + 10 }]}
      >
        <ChevronLeft color="#000" size={28} />
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        <Image source={{ uri: params.uri as string }} style={styles.heroImage} />

        <View style={styles.contentContainer}>
          
          <View style={styles.headerRow}>
            <ThemedText type="title" style={styles.title}>{params.animale_name}</ThemedText>
            <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>{params.animale_rate_reconize}%</ThemedText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoBlock}>
                <Calendar size={20} color="gray" style={{marginBottom: 5}}/>
                <ThemedText style={styles.label}>Date</ThemedText>
                <ThemedText bold>{params.date}</ThemedText>
            </View>

            <View style={styles.infoBlock}>
                <BarChart3 size={20} color="gray" style={{marginBottom: 5}}/>
                <ThemedText style={styles.label}>Précision</ThemedText>
                <ThemedText bold>{params.animale_rate_reconize}%</ThemedText>
            </View>
          </View>

          <View style={styles.divider} />

          <ThemedText type="subtitle" style={{ marginBottom: 10 }}>Description</ThemedText>
          <ThemedText style={{ lineHeight: 24, opacity: 0.8 }}>
            Ceci est un {params.animale_name}. L'IA est sûre à {params.animale_rate_reconize}%.
          </ThemedText>

        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Style du bouton retour
  backBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 10, // Pour passer au-dessus de l'image
    backgroundColor: 'white', // Fond blanc
    padding: 8,
    borderRadius: 50, // Rond
    shadowColor: "#000", // Ombre pour le relief
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  heroImage: { width: '100%', height: 350, resizeMode: 'cover' }, // J'ai enlevé le border radius pour coller en haut
  contentContainer: { 
    padding: 20, 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    backgroundColor: '#fff', // Important: fond blanc pour couvrir le bas de l'image
    marginTop: -30 // Remonte sur l'image
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 10 },
  title: { fontSize: 28, textTransform: 'capitalize' },
  badge: { backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: 'white', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#ccc', opacity: 0.3, marginVertical: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-around' },
  infoBlock: { alignItems: 'center' },
  label: { fontSize: 12, opacity: 0.6, marginBottom: 2 },
});