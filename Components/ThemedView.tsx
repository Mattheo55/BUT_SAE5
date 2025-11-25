import styles from '@/styles/styles';
import React, { useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeContext } from './ThemeContext';

type ThemedViewProps = {
    children: React.ReactNode
}

export default function ThemedView(props: ThemedViewProps) {

    const {isDarkTheme} = useContext(ThemeContext);

  return (
    <SafeAreaView style={[styles.container, isDarkTheme ? styles.dark : styles.light]}>
        { props.children }
    </SafeAreaView>
  )
}

