import styles from '@/styles/styles';
import React, { useContext } from 'react';
import { ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeContext } from './ThemeContext';

type ThemedViewProps = ViewProps & {
    children: React.ReactNode,
    fullPadding?: boolean,
}

export default function ThemedView({children, fullPadding = true}: ThemedViewProps) {

    const {isDarkTheme} = useContext(ThemeContext);

  return (
    <SafeAreaView style={[styles.container, isDarkTheme ? styles.dark : styles.light, fullPadding ? {padding: 25} : undefined]}>
        { children }
    </SafeAreaView>
  )
}

