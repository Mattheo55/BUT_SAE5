import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera, CameraMode, CameraType, CameraView, FlashMode } from 'expo-camera';
import { Image } from "expo-image";
import * as ImageManipulator from 'expo-image-manipulator'; // Nécessaire pour resize
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
// Nouveaux imports TFLite
import { useTensorflowModel } from 'react-native-fast-tflite';

// --- Fonction utilitaire pour convertir base64 en données binaires (Uint8Array) ---
// C'est le format attendu par les modèles TFLite quantifiés (int8)
const base64CharToIndexMap: Record<string, number> = {};
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
for (let i = 0; i < base64Chars.length; i++) {
  base64CharToIndexMap[base64Chars[i]] = i;
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Nettoyage rapide si header présent
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
  const padding = '='.repeat((4 - (cleanBase64.length % 4)) % 4);
  const base64WithPadding = cleanBase64 + padding;
  const length = (base64WithPadding.length / 4) * 3;
  const array = new Uint8Array(length);
  let arrayIndex = 0;

  for (let i = 0; i < base64WithPadding.length; i += 4) {
    const c1 = base64CharToIndexMap[base64WithPadding[i]];
    const c2 = base64CharToIndexMap[base64WithPadding[i + 1]];
    const c3 = base64CharToIndexMap[base64WithPadding[i + 2]];
    const c4 = base64CharToIndexMap[base64WithPadding[i + 3]];

    const b1 = (c1 << 2) | (c2 >> 4);
    const b2 = ((c2 & 15) << 4) | (c3 >> 2);
    const b3 = ((c3 & 3) << 6) | c4;

    array[arrayIndex++] = b1;
    if (base64WithPadding[i + 2] !== '=') array[arrayIndex++] = b2;
    if (base64WithPadding[i + 3] !== '=') array[arrayIndex++] = b3;
  }
  // On retire le padding éventuel
  let actualLength = length;
  if (base64WithPadding.endsWith('==')) actualLength -= 2;
  else if (base64WithPadding.endsWith('=')) actualLength -= 1;

  return array.slice(0, actualLength);
}
// ----------------------------------------------------------------

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [type, setType] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  
  const ref = useRef<CameraView>(null);
  const isProcessing = useRef(false);
  
  const [uri, setUri] = useState<string | null>(null);
  const [mode] = useState<CameraMode>("picture");
  const [result, setResult] = useState<string>("Chargement modèle...");

  // 1. Chargement du modèle TFLite via le hook
  const model = useTensorflowModel(require("../../assets/models/best_int8.tflite"));
  // const model = useTensorflowModel({ url: "https://tes-assets-en-ligne/best_int8.tflite" }); // Alternative si en ligne

  // Labels (DOIT correspondre exactement à l'entraînement de ton modèle)
  const labels = useMemo(() => ["Chat", "Chien", "Lion", "Humain"], []);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (model.state === "loading") setResult("Chargement modèle...");
    if (model.state === "error") setResult("Erreur modèle !");
    if (model.state === "loaded") setResult("Modèle prêt. Détection...");
  }, [model.state]);


  // 2. Détection en continu sur la caméra
  useEffect(() => {
    // On ne lance la boucle que si le modèle est bien chargé
    if (model.state !== "loaded" || !model.model || !ref.current) return;

    const interval = setInterval(async () => {
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        // A. Prendre la photo
        const photo = await ref.current.takePictureAsync({ 
            skipProcessing: true,
            shutterSound: false
        });

        if (!photo?.uri) { throw new Error("Pas d'URI photo"); }

        // B. REDIMENSIONNER l'image (Crucial pour TFLite)
        // Ton modèle YOLO attend probablement du 640x640. Adapte ces valeurs si besoin.
        const manipResult = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 640, height: 640 } }],
            { base64: true, format: ImageManipulator.SaveFormat.JPEG }
        );

        if (!manipResult.base64) { throw new Error("Échec manipulation image"); }

        // C. Convertir base64 en tableau d'octets (Uint8Array) pour le modèle int8
        const inputData = base64ToUint8Array(manipResult.base64);

        // D. Exécuter le modèle (Inférence)
        // runSync est bloquant mais rapide pour TFLite.
        const outputs = model.model.runSync([inputData]);
        
        // E. Analyser la sortie
        // outputs[0] est le premier tensor de sortie. Sa structure dépend de ton modèle.
        // Pour un modèle de classification simple, c'est souvent un tableau de probabilités.
        const outputArray = outputs[0] as Float32Array | Uint8Array;

        let maxScore = -Infinity;
        let maxIndex = -1;

        // Trouver le meilleur score
        for (let i = 0; i < outputArray.length; i++) {
            // Si c'est du Uint8 (0-255), on convertit parfois en float (0.0-1.0) selon le modèle
            const score = outputArray[i];
            if (score > maxScore) {
                maxScore = score;
                maxIndex = i;
            }
        }

        const detectedLabel = labels[maxIndex] || "Inconnu";
        // Affichage du score (si uint8, peut-être diviser par 255 pour avoir un %)
        const scoreDisplay = (maxScore).toFixed(0); 

        setResult(`${detectedLabel} (Score: ${scoreDisplay})`);

      } catch (e) {
        console.log("Erreur inference TFLite:", e);
      } finally {
        isProcessing.current = false;
      }
    // Intervalle un peu plus long car le resize prend du temps
    }, 1500); 

    return () => clearInterval(interval);
  }, [model.state, model.model]); // Dépendances mises à jour

  if (hasPermission === null) return <Text>Demande de permission...</Text>;
  if (hasPermission === false) return <Text>Permission refusée à la caméra.</Text>;

  const switchCamera = () => {
    setType((prevType) => (prevType === "back" ? "front" : "back"));
  }

  const flashCamera = () => {
    setFlash((prevFlash) => (prevFlash === "off" ? "on" : "off"));
  };

  const takePicture = async () => {
    if (ref.current) {
        const photo = await ref.current.takePictureAsync();
        if (photo?.uri) setUri(photo.uri);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      alert("La permission d'accéder à la galerie est requise !");
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, 
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
        setUri(result.assets[0].uri);
    }
  };

  // (Le reste du rendu UI est identique à avant, je l'ai gardé pour que le code soit complet)
  const renderPicture = (uri: string) => (
    <View style={{flex: 1, justifyContent: 'space-between', backgroundColor: 'black'}}>
      <View style={{ marginTop: 50 }}>
        <Image
          source={{ uri }}
          contentFit="contain"
          style={{ width: "100%", height: "80%" }}
        />
        <Text style={{ padding: 10, fontSize: 18, color: 'white', textAlign: 'center' }}>
           Dernière détection : {result}
        </Text>
      </View>

      <Pressable
        style={{ marginBottom: 30, marginHorizontal: 20, padding: 15, backgroundColor: 'white', borderRadius: 10 }}
        onPress={() => setUri(null)} 
      >
        <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>
          Prendre une nouvelle photo
        </Text>
      </Pressable>
    </View>
  );

  const renderCamera = () => (
    <View style={styles.container}>
      <CameraView style={styles.camera}  
        ref={ref}
        mode={mode}
        facing={type}
        flash={flash}
        mute={true}
        responsiveOrientationWhenOrientationLocked
      />

      <View style={styles.topControls}>
          <Pressable onPress={flashCamera} style={styles.flashButton}>
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
              <View style={[styles.shutterBtn, { opacity: pressed ? 0.5 : 1 }]}>
                <View style={[styles.shutterBtnInner, { backgroundColor: mode === "picture" ? "white" : "red" }]} />
              </View>
            )}
          </Pressable>

          <Pressable onPress={switchCamera} style={styles.iconButton}>
              <MaterialCommunityIcons name="cached" size={30} color="white" />
          </Pressable>
      </View>

      <View style={styles.resultContainer}>
        <Text style={styles.resultText}>{result}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {uri ? renderPicture(uri) : renderCamera()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  topControls: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  flashButton: {
    padding: 10,
    borderRadius: 50,
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
    bottom: 50,
  },
  iconButton: {
      padding: 12,
      borderRadius: 50, 
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
  },
  shutterBtn: {
    backgroundColor: "transparent",
    borderWidth: 5,
    borderColor: "white",
    width: 80,
    height: 80,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterBtnInner: {
    width: 65,
    height: 65,
    borderRadius: 50,
  },
  resultContainer: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  resultText: {
    color: '#00ff00',
    fontSize: 20,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }
});