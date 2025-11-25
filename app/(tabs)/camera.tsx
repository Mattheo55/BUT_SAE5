import { Camera, CameraMode, CameraType, CameraView } from 'expo-camera';
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [type, setType] = useState<CameraType>("back");
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
  }

  const takePicture = async () => {
    const photo = await ref.current?.takePictureAsync();
    if (photo?.uri) setUri(photo.uri);
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
            Take another picture
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
          mute={false}
          responsiveOrientationWhenOrientationLocked/>
        <View style={styles.buttonContainer}>
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
            <Button title="🔄 Changer caméra" onPress={switchCamera} />
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
  buttonContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 20,
    bottom: 40,
    alignSelf: 'center',
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