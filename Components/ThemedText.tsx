import styles from '@/styles/styles';
import React, { useContext } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ThemeContext } from './ThemeContext';

type ThemedTextProps = {
    children : string,
    type?: "default" | "title" | "subtitle"
}

export default function ThemedText({ children, type="default" } : ThemedTextProps) {

      const {isDarkTheme} = useContext(ThemeContext);


  return (
    <Text style={[
        isDarkTheme ? styles.darkText : styles.lightText,
        type === "default" ? textStyles.default : undefined,
        type === "title" ? textStyles.title : undefined,
        type === "subtitle" ? textStyles.subtitle : undefined,

    ]}>
        { children }
    </Text>
  )
}

const textStyles = StyleSheet.create({
    default : {},
    title: {
        fontSize: 24,
        fontWeight: "bold",
    },
    subtitle: {}
})
