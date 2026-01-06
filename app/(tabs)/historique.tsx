import ThemedText from '@/Components/ThemedText';
import { API_URL } from '@/helper/constant';
import axios from 'axios';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './compte';


type Vignette = {
  id: string;
  uri: string;
};

type HistoriqueItem = {
  id: string;
  user_id: string,
  animale_name: string; 
  animale_rate_reconize: number;
  date: string;     
  uri: string;
};

export default function Historique() {
  const router = useRouter();
  const largeurEcran = Dimensions.get('window').width;

  const [historyData, setHistoryData] = React.useState<HistoriqueItem[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);

  const { user, isLoading } = useAuth();

  useEffect(() => {
    if(!user) {
      Alert.alert("Connexion requise", "Pour accéder à l'historique, vous devez vous connecter.", [
        {
          text: "Connexion",
          onPress: () => router.replace('/(tabs)/compte')
        }
      ])
    }
  }, [user, isLoading]);

  useFocusEffect(
    useCallback(() => {
      if(user) {
        fetchData();
      }
    } , [user])
  );

  async function fetchData() {
    if(!user?.id) return;
    setIsFetching(true);
    try {
      const response = await axios.get(`${API_URL}/get_history`, {params: {user_id: user.id}});
      setHistoryData(response.data);
    } catch (error: any) {
        Alert.alert("Erreur", error.response?.data?.detail || "Erreur de connexion");
    } finally {
      setIsFetching(false)
    }
  }

  const vignettes: Vignette[] = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        id: `vignette-${i + 1}`,
        uri: 'https://via.placeholder.com/160x160.png?text=%20',
      })),
    [historyData]
  );

  const NB_VIGNETTES_PAR_LIGNE = 5;
  const espacement = 8;
  const margeHorizontale = 16;
  const tailleVignette =
    (largeurEcran - margeHorizontale * 2 - espacement * (NB_VIGNETTES_PAR_LIGNE - 1)) /
    NB_VIGNETTES_PAR_LIGNE;

  const renderVignette = ({ item }: { item: Vignette }) => (
    <Pressable
      onPress={() => {
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

  const renderCarte = ({ item }: { item: HistoriqueItem }) => (
    <Pressable
      style={styles.carte}
      onPress={() => {
        // router.push({ pathname: '/result', params: { id: item.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${item.animale_name} reconnu le ${item.date}`}
    >
      <Image source={{ uri: item.uri }} style={styles.carteImage} />
      <View style={styles.carteCorps}>
        <View style={{ justifyContent: "space-between", flexDirection: "row" }}>
          <Text style={styles.carteTitre}>{item.animale_name}</Text>
          <Text>{item.animale_rate_reconize} %</Text>
        </View>
        <Text style={styles.carteMeta}>{item.date}</Text>
      </View>
    </Pressable>
  );
  
  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }
  if(!user) {
    return <SafeAreaView style={{ justifyContent: "center", alignItems: "center", flex: 1 }}>
      <ThemedText type='title'>Connectez-vous</ThemedText>
      <ThemedText>Connectez-vous pour accéder a l'historique</ThemedText>
    </SafeAreaView>
  } // si user pas connecte
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
              data={historyData}
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