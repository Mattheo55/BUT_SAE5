import { formaterDate } from '@/helper/formateDate';
import { HistoriqueItem } from '@/Type/Item';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type RenderCarteProps = {
    item: HistoriqueItem
}

export default function RenderCarte({item}: RenderCarteProps) {
  const router = useRouter()



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
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir ${item.animale_name} reconnu le ${item.date}`}
        >
          <Image source={{ uri: item.uri }} style={styles.carteImage} />
          <View style={styles.carteCorps}>
            <View style={{ justifyContent: "space-between", flexDirection: "row" }}>
              <Text style={styles.carteTitre}>{item.animale_name}</Text>
              <Text>{item.animale_rate_reconize} %</Text>
            </View>
            <Text style={styles.carteMeta}>{formaterDate(item.date)}</Text>
          </View>
        </Pressable>
  
  )
}

const styles = StyleSheet.create({


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