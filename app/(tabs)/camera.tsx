import { Camera, CameraType } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [type, setType] = useState<CameraType>(CameraType.back);
  const cameraRef = useRef<CameraTypeRef | null>(null); // ✅ Type correct ici

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (hasPermission === null) return <Text>Demande de permission...</Text>;
  if (hasPermission === false) return <Text>Permission refusée à la caméra.</Text>;

  const switchCamera = () => {
    setType(type === CameraType.back ? CameraType.front : CameraType.back);
  };

  return (
    <View style={styles.container}>
      <Camera style={styles.camera} type={type} ref={cameraRef} />
      <View style={styles.buttonContainer}>
        <Button title="🔄 Changer caméra" onPress={switchCamera} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
});
