import { NewsItem } from '@/Type/NewsItem';
import { Image } from 'expo-image';
import { ExternalLink } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useColorScheme
} from 'react-native';

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?q=80&w=800&auto=format&fit=crop";


export default function NewsCarousel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const theme = useColorScheme(); 

  const RSS_URL = "https://www.sciencesetavenir.fr/animaux/rss.xml";
  const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      
      if (data.status === 'ok') {
        const cleanItems = data.items.map((item: any) => ({
            ...item,
            thumbnail: item.thumbnail && item.thumbnail !== "" ? item.thumbnail : PLACEHOLDER_IMAGE
        }));
        setNews(cleanItems);
      }
    } catch (error) {
      console.error("Erreur chargement news:", error);
    } finally {
      setLoading(false);
    }
  };

  const openArticle = (url: string) => {
    Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: NewsItem }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => openArticle(item.link)}
      activeOpacity={0.9}
    >
      <Image 
        source={{ uri: item.thumbnail }} 
        style={styles.image} 
        contentFit="cover"
        transition={500}
      />
      <View style={styles.overlay}>
        <Text style={styles.date}>{item.pubDate.split(' ')[0]}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.readMore}>
           <Text style={styles.readMoreText}>Lire l'article</Text>
           <ExternalLink size={12} color="#4CAF50" style={{marginLeft: 4}}/>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <ActivityIndicator size="small" color="#4CAF50" style={{ marginVertical: 20 }} />;
  }

  if (news.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={news}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.link + index} 
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={260} 
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 20,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 10, 
  },
  card: {
    width: 250,
    height: 160,
    marginRight: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#222', 
    position: 'relative',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2}
  },
  image: {
    width: '100%',
    height: '100%',
    opacity: 0.8, 
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', 
  },
  date: {
    color: '#ddd',
    fontSize: 10,
    marginBottom: 4,
    fontWeight: '600',
  },
  title: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 18,
    marginBottom: 6,
  },
  readMore: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  readMoreText: {
      color: '#4CAF50',
      fontSize: 10,
      fontWeight: 'bold'
  }
});