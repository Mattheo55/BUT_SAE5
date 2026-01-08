import { Tabs } from 'expo-router';
import { Camera, CircleUserRound, History, House } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from './compte';

function TabsLayout() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#007AFF" />
        </View>
        );
    }
    
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
                    tabBarIcon: () => <History />,
                }}
            />

            <Tabs.Screen 
                name='compte'
                options={{
                    title: "Mon compte",
                    tabBarIcon: () => <CircleUserRound />
                }}
            />

            <Tabs.Screen
                name='contribute'
                options={{
                    href: null
                }}
            />

        </Tabs>
    )
}

export default function Layout() {
  return (
    <AuthProvider>
      <TabsLayout />
    </AuthProvider>
  );
}