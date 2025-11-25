import { Pressable } from 'react-native'
import React, { useContext } from 'react'
import ThemedText from './ThemedText'
import { ThemeContext } from './ThemeContext';
import styles from '@/styles/styles';

export default function ThemeModeButton() {

      const {isDarkTheme, setIsDarkTheme} = useContext(ThemeContext);


  return (
    <Pressable style={styles.button} onPress={() => setIsDarkTheme(!isDarkTheme)}>
        <ThemedText>{isDarkTheme ? "🌞" : "🌙"}</ThemedText>
    </Pressable>
  )
}

