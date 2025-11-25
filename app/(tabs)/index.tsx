import ThemedText from '@/Components/ThemedText';
import ThemedView from '@/Components/ThemedView';
import ThemeModeButton from '@/Components/ThemeModeButton';
import React from 'react';
import { View } from 'react-native';

export default function Index() {


  return (
    <ThemedView>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <ThemedText type='title'>Accueil</ThemedText>
        <ThemeModeButton/>
      </View>

    </ThemedView>
  );
}
