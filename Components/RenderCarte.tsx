import { formaterDate } from '@/helper/formateDate';
import { HistoriqueItem } from '@/Type/Item';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View
} from 'react-native';

type RenderCarteProps = {
  item: HistoriqueItem
}

export default function RenderCarte({ item }: RenderCarteProps) {
  const router = useRouter();
  const [isSharing, setIsSharing] = useState(false); // 👈 État pour le chargement

  const handleShare = async (e: any) => {
  e.stopPropagation();
  if (isSharing) return;
  setIsSharing(true);

  try {
    const message = `Regarde ce que j'ai trouvé ! Un ${item.animale_name} reconnu à ${item.animale_rate_reconize}% grâce à DeepWild !`;

    if (Platform.OS === 'ios') {
      // --- SUR IOS : ON PARTAGE LE FICHIER LOCAL (MARCHE TRÈS BIEN) ---
      const extension = item.uri.split('.').pop() || 'jpg';
      const localUri = `${FileSystem.cacheDirectory}share_${item.id}.${extension}`;
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      
      if (!fileInfo.exists) {
        await FileSystem.downloadAsync(item.uri, localUri);
      }

      await Share.share({
        message: message,
        url: localUri, // iOS affiche l'image et le texte
      });
    } else {
      // --- SUR ANDROID : ON UTILISE L'URL WEB POUR GARDER LE TEXTE ---
      // Android va générer un aperçu du lien avec l'image et afficher ton texte
      await Share.share({
        message: `${message}\n\n${item.uri}`, 
      });
    }

  } catch (error) {
    console.error("Erreur partage:", error);
    Alert.alert("Oups", "Impossible de partager");
  } finally {
    setIsSharing(false);
  }
};

      

  return (
    <Pressable
      style={styles.carte}
      onPress={() => {
        router.push({
          pathname: "/result",
          params: {
            id: item.id,
            animale_name: item.animale_name,
            animale_rate_reconize: item.animale_rate_reconize,
            date: formaterDate(item.date),
            uri: item.uri
          }
        });
      }}
    >
      <Image source={{ uri: item.uri }} style={styles.carteImage} />
      
      {/* BOUTON DE PARTAGE AVEC FEEDBACK VISUEL */}
      <Pressable style={styles.shareBtn} onPress={handleShare} disabled={isSharing}>
        {isSharing ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Share2 size={20} color="#007AFF" />
        )}
      </Pressable>

      <View style={styles.carteCorps}>
        <View style={{ justifyContent: "space-between", flexDirection: "row", alignItems: 'center' }}>
          <Text style={styles.carteTitre}>{item.animale_name}</Text>
          <Text style={styles.rateText}>{item.animale_rate_reconize} %</Text>
        </View>
        <Text style={styles.carteMeta}>{formaterDate(item.date)}</Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  carte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 16, // Espacement entre les cartes
    position: 'relative',
  },
  carteImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#E4E6ED',
  },
  shareBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
  rateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  carteMeta: {
    fontSize: 12,
    color: '#6B6F7B',
  },
});