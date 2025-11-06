import { Tabs } from 'expo-router'
import { Camera, History, House } from 'lucide-react-native'
import React from 'react'
import { StyleSheet } from 'react-native'

export default function _layout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>



        <Tabs.Screen 
            name='index'
            options={{
                title: "Acceuil",
                tabBarIcon: () => <House />
            }}
        />

        <Tabs.Screen 
            name='camera'
            options={{
                title: "Caméra",
                tabBarIcon: () => <Camera />
            }}
        />
        
        <Tabs.Screen 
            name='historique'
            options={{
                title: "Historique",
                tabBarIcon: () => <History />
            }}
        />

    </Tabs>
  )
}

const styles = StyleSheet.create({})