import { Camera, CameraType, CameraView } from 'expo-camera';
import React, { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [type, setType] = useState<CameraType>("back");

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (hasPermission === null) return <Text>Demande de permission...</Text>;
  if (hasPermission === false) return <Text>Permission refusée à la caméra.</Text>;

 function switchCamera() {
  setType((prevType) => (prevType === "back" ? "front" : "back"));
}

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={type} />
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
