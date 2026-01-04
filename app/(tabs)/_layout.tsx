import { Tabs } from 'expo-router'
import { Camera, CircleUserRound, History, House } from 'lucide-react-native'
import React from 'react'

export default function _layout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>



        <Tabs.Screen 
            name='index'
            options={{
                title: "Accueil",
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

        <Tabs.Screen 
            name='compte'
            options={{
                title: "Mon compte",
                tabBarIcon: () => <CircleUserRound />
            }}
        />

    </Tabs>
  )
}

