import React, { useContext } from 'react';
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from '../../styles/styles';
import { ThemeContext } from '../ThemeContext';

export default function Index() {

  const {isDarkTheme, setIsDarkTheme} = useContext(ThemeContext);

  return (
    <SafeAreaView style={[styles.container, isDarkTheme ? styles.dark : styles.light]}>
      <Text style={[styles.title, isDarkTheme ? styles.darkText : styles.lightText]}>
        Acceuil &lt;Nom de l'app&gt;
      </Text>

      <Pressable 
          style={styles.button}
          onPress={() => setIsDarkTheme(!isDarkTheme)}
      >
          <Text style={styles.buttonText}>
            Thème sombre 
            {isDarkTheme ? "🌞" : "🌙"}
          </Text>
      </Pressable>
    </SafeAreaView>
  );
}
