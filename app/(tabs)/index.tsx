import RenderCarte from '@/Components/RenderCarte';
import ThemedText from '@/Components/ThemedText';
import ThemedView from '@/Components/ThemedView';
import ThemeModeButton from '@/Components/ThemeModeButton';
import { HistoriqueItem } from '@/Type/Item';
import { useRouter } from 'expo-router';
import { MoveRight } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

export default function Index() {

  const lastAnimalScan : HistoriqueItem =  { id: 'h1', animal: 'Chien', date: '12/01/2025 • 14:32', uri: 'https://via.placeholder.com/640x420.png' }
  const rouer = useRouter();

  return (
    <ThemedView>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 }}>
        <ThemedText type='title'>Accueil</ThemedText>
        <ThemeModeButton/>
      </View>

      <View>
        <View style={{ marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <ThemedText bold> Dernier animal reconnue</ThemedText>
          <Pressable onPress={() => rouer.push("/(tabs)/historique")}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ThemedText> Historique </ThemedText>
              <MoveRight />
            </View>
          </Pressable>
        </View>

        <RenderCarte item={lastAnimalScan} />
      </View>
    </ThemedView>
  );
}
