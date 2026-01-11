import styles from '@/styles/styles';
import React, { useContext } from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { ThemeContext } from './ThemeContext';

type ThemedTextProps = TextProps & {
    children : React.ReactNode,
    type?: "default" | "title" | "subtitle",
    bold?: boolean
}

export default function ThemedText({ children, type="default", bold } : ThemedTextProps) {

      const {isDarkTheme} = useContext(ThemeContext);


  return (
    <Text style={[
        isDarkTheme ? styles.darkText : styles.lightText,
        type === "default" ? textStyles.default : undefined,
        type === "title" ? textStyles.title : undefined,
        type === "subtitle" ? textStyles.subtitle : undefined,
        bold ? {fontWeight: "bold"} : undefined,
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
    subtitle: {
        marginTop: 6,
        fontSize: 13,
        color: '#6B6F7B',
    }
})
