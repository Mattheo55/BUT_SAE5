import React, { useContext } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from '../../styles/styles';
import { ThemeContext } from '../ThemeContext';

export default function historique() {

  const {isDarkTheme} = useContext(ThemeContext);

  return (
    <SafeAreaView style={[styles.container, isDarkTheme ? styles.dark : styles.light]}>
      <Text style={[styles.title, isDarkTheme ? styles.darkText : styles.lightText]}>
        Historique
      </Text>
    </SafeAreaView>
  )
}