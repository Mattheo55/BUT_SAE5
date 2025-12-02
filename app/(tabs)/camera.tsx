import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera, CameraMode, CameraType, CameraView, FlashMode } from 'expo-camera';
import { Image } from "expo-image";
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [type, setType] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const ref = useRef<CameraView>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [mode] = useState<CameraMode>("picture");

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (hasPermission === null) return <Text>Demande de permission...</Text>;
  if (hasPermission === false) return <Text>Permission refusée à la caméra.</Text>;

  const switchCamera = () => {
    setType((prevType) => (prevType === "back" ? "front" : "back"));
    console.log('Flash mode:', flash); //a enlever après test
  }

  const flashCamera = () => {
    setFlash((prevFlash) => (prevFlash === "off" ? "on" : "off"));
    console.log('Flash mode: (inversé)', flash); //a enlever après test
  };

  const takePicture = async () => {
    const photo = await ref.current?.takePictureAsync();
    if (photo?.uri) setUri(photo.uri);
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      alert("La permission d'accéder à la galerie est requise pour cette fonctionnalité !");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, 
      quality: 1,
    });

    if (!result.canceled) {
      if (result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setUri(selectedUri);
      }
    }
  };

  const renderPicture = (uri: string) => {
    return (
      <View style={{flex: 1, justifyContent: 'space-between'}}>
        <View>
          <Image
            source={{ uri }}
            contentFit="cover"
            style={{ width: "auto", aspectRatio: 1 }}
          />
          <Text style={{ padding: 10, fontSize: 16 }}>
            Voila votre photo !
            Vous êtes a 36% un humain. 
          </Text>
        </View>

        <Pressable
          style={{ marginBottom: 10, padding: 10, backgroundColor: 'lightblue' }}
          onPress={() => setUri(null)} 
        >
          <Text>
            Prendre une nouvelle photo
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderCamera = () => {
    return (
      <View style={styles.container}>

        <CameraView style={styles.camera}  
          ref={ref}
          mode={mode}
          facing={type}
          flash={flash}
          mute={false}
          responsiveOrientationWhenOrientationLocked/>

        <View style={styles.topControls}>
            <Pressable
              onPress={flashCamera}
              style={styles.flashButton} 
            >
              <MaterialCommunityIcons
                name={flash === "on" ? "flash" : "flash-off"} 
                size={30}
                color={flash === "on" ? "yellow" : "white"} 
              />
            </Pressable>
        </View>

        <View style={styles.bottomControls}>

            <Pressable onPress={pickImage} style={styles.iconButton}>
                <MaterialCommunityIcons name="image-multiple" size={30} color="white" />
            </Pressable>

          <Pressable onPress={takePicture}>
              {({ pressed }) => (
                <View
                  style={[
                    styles.shutterBtn,
                    {
                      opacity: pressed ? 0.5 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.shutterBtnInner,
                      {
                        backgroundColor: mode === "picture" ? "white" : "red",
                      },
                    ]}
                  />
                </View>
              )}
            </Pressable>

            <Pressable onPress={switchCamera} style={styles.iconButton}>
                <MaterialCommunityIcons name="cached" size={30} color="white" />
            </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {uri ? renderPicture(uri) : renderCamera()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },

  topControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },

  flashButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomControls: {
    position: 'absolute',
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%', 
    paddingHorizontal: 30,
    bottom: 40,
  },

  iconButton: {
      padding: 10,
      borderRadius: 50, 
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
  },

  shutterBtn: {
    backgroundColor: "transparent",
    borderWidth: 5,
    borderColor: "white",
    width: 85,
    height: 85,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterBtnInner: {
    width: 70,
    height: 70,
    borderRadius: 50,
  },

});