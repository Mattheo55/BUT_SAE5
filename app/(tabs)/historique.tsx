import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

type Vignette = {
  id: string;
  uri: string;
};

type HistoriqueItem = {
  id: string;
  animal: string;
  date: string;     // format d’affichage, ex : "12/01/2025 • 14:32"
  uri: string;
};

export default function Historique() {
  const router = useRouter();
  const largeurEcran = Dimensions.get('window').width;

  // --- Données fictives : à remplacer plus tard par les vraies valeurs ---
  const vignettes: Vignette[] = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        id: `vignette-${i + 1}`,
        uri: 'https://via.placeholder.com/160x160.png?text=%20',
      })),
    []
  );

  const elements: HistoriqueItem[] = useMemo(
    () => [
      { id: 'h1', animal: 'Chien', date: '12/01/2025 • 14:32', uri: 'https://via.placeholder.com/640x420.png' },
      { id: 'h2', animal: 'Cheval',    date: '11/01/2025 • 19:05', uri: 'https://via.placeholder.com/640x420.png' },
      { id: 'h3', animal: 'Сhat',    date: '10/01/2025 • 08:47', uri: 'https://via.placeholder.com/640x420.png' },
      { id: 'h4', animal: 'Pigeon',   date: '09/01/2025 • 21:13', uri: 'https://via.placeholder.com/640x420.png' },
    ],
    []
  );

  // --- Configuration de la grille des vignettes (5 colonnes, 2 lignes = 10 images) ---
  const NB_VIGNETTES_PAR_LIGNE = 5;
  const espacement = 8;
  const margeHorizontale = 16;
  const tailleVignette =
    (largeurEcran - margeHorizontale * 2 - espacement * (NB_VIGNETTES_PAR_LIGNE - 1)) /
    NB_VIGNETTES_PAR_LIGNE;

  // --- Affichage d’une vignette ---
  const renderVignette = ({ item }: { item: Vignette }) => (
    <Pressable
      onPress={() => {
        // Navigation vers la page du résultat (à activer plus tard)
        // router.push({ pathname: '/result', params: { id: item.id } });
      }}
      style={[
        styles.vignetteBox,
        { width: tailleVignette, height: tailleVignette, marginRight: espacement, marginBottom: espacement },
      ]}
      accessibilityRole="imagebutton"
      accessibilityLabel="Ouvrir la reconnaissance"
    >
      <Image source={{ uri: item.uri }} style={styles.vignetteImg} />
    </Pressable>
  );

  // --- Affichage d’une carte d’historique ---
  const renderCarte = ({ item }: { item: HistoriqueItem }) => (
    <Pressable
      style={styles.carte}
      onPress={() => {
        // router.push({ pathname: '/result', params: { id: item.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${item.animal} reconnu le ${item.date}`}
    >
      <Image source={{ uri: item.uri }} style={styles.carteImage} />
      <View style={styles.carteCorps}>
        <Text style={styles.carteTitre}>{item.animal}</Text>
        <Text style={styles.carteMeta}>{item.date}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.zoneSecurisee} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.contenuScroll}>
        {/* --- En-tête de la page --- */}
        <View style={styles.entete}>
          <Text style={styles.titre}>Historique</Text>
          <Text style={styles.sousTitre}>Liste des 10 dernières photos</Text>
        </View>

        {/* --- Grille des vignettes --- */}
        <View style={styles.section}>
          <FlatList
            data={vignettes}
            renderItem={renderVignette}
            keyExtractor={(t) => t.id}
            numColumns={NB_VIGNETTES_PAR_LIGNE}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: margeHorizontale }}
          />
        </View>

        {/* --- Liste des cartes avec nom + date --- */}
        <View style={styles.section}>
          <Text style={styles.titreBloc}>Nom de l’animal et date de reconnaissance</Text>
          <FlatList
            data={elements}
            keyExtractor={(i) => i.id}
            renderItem={renderCarte}
            scrollEnabled={false}
            contentContainerStyle={styles.cartesWrap}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        </View>

        {/* --- Marge inférieure pour le confort visuel --- */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles de la page Historique ---
const styles = StyleSheet.create({
  zoneSecurisee: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  contenuScroll: {
    paddingBottom: 16,
  },

  // En-tête
  entete: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  titre: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F1222',
  },
  sousTitre: {
    marginTop: 6,
    fontSize: 13,
    color: '#6B6F7B',
  },

  // Section principale
  section: {
    marginTop: 8,
  },
  titreBloc: {
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F1222',
    marginBottom: 10,
  },

  // Grille de vignettes
  vignetteBox: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E4E6ED',
  },
  vignetteImg: {
    width: '100%',
    height: '100%',
    contentFit: 'cover',
  },

  // Cartes d’historique
  cartesWrap: {
    paddingHorizontal: 16,
  },
  carte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  carteImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#E4E6ED',
    contentFit: 'cover',
  },
  carteCorps: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  carteTitre: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1222',
    marginBottom: 4,
  },
  carteMeta: {
    fontSize: 12,
    color: '#6B6F7B',
  },
});