import { API_URL } from '@/helper/constant';
import axios from 'axios';
import { Buffer } from 'buffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as jpeg from 'jpeg-js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import {
  Camera,
  CameraPosition,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor
} from 'react-native-vision-camera';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useAuth } from './compte';

export default function CameraScreen() {
  const {user} = useAuth();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef<Camera>(null);

  const [detectionLabel, setDetectionLabel] = useState<string>(""); 
  const [detectionScore, setDetectionScore] = useState<string>(""); 
  const [uri, setUri] = useState<string | null>(null);
  const [capturedResult, setCapturedResult] = useState<{label: string, score: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const objectDetection = useTensorflowModel(require("../../assets/models/best_float16.tflite"));
  const model = objectDetection.model;
  const { resize } = useResizePlugin();

  const isBusy = useSharedValue(false);

  useEffect(() => {
  if (model) {
    console.log("Détails du modèle :", {
      inputs: model.inputs,
      outputs: model.outputs
    });
  }
}, [model]);
  
  const labels = useMemo(() => [
      'Ours', 'Guépard', "Crocodile", 'Éléphant', 'Renard', 
      'Girafe', 'Hérisson', 'Humain', 'Léopard', 'Lion', 
      'Lynx', 'Autruche', 'Rhinocéros', 'Tigre', 'Zèbre'
  ], []);

  const format = useMemo(() => {
    if (!device) return undefined;
    return device.formats.find(f => 
      f.videoWidth === 1280 && f.videoHeight === 720 && f.maxFps <= 30
    ) || device.formats[0];
  }, [device]);

  useEffect(() => { requestPermission(); }, [requestPermission]);

  const updateResultOnJS = Worklets.createRunOnJS((label: string, score: string) => {
    setDetectionLabel(label);
    setDetectionScore(score);
  });

 const processOutput = (data: any) => {
  // data est un Float32Array de 159 600 éléments (19 * 8400)
  const numAnchors = 8400;
  const numClasses = 15;
  
  let bestScore = 0.50; // Seuil de confiance
  let bestClassIdx = -1;

  // On ne boucle QUE sur les lignes des classes (de la ligne 4 à 18)
  for (let c = 0; c < numClasses; c++) {
    const rowOffset = (4 + c) * numAnchors; // On saute les 4 lignes de coordonnées
    
    for (let i = 0; i < numAnchors; i++) {
      const score = data[rowOffset + i];
      if (score > bestScore) {
        bestScore = score;
        bestClassIdx = c;
      }
    }
  }

  if (bestClassIdx !== -1) {
    return {
      label: labels[bestClassIdx],
      score: `${Math.round(bestScore * 100)}%`
    };
  }
  
  return { label: "Inconnu", score: "" };
};

  const toggleCamera = () => setCameraPosition((cur) => (cur === 'back' ? 'front' : 'back'));
  const toggleFlash = () => setFlash((cur) => (cur === 'off' ? 'on' : 'off'));

  // ✅ Worklet permanent pour l'inférence sur images de galerie
  const runGalleryInference = Worklets.createRunOnJS((pixelData: number[]) => {
    'worklet';
    if (!model) {
      console.log("Model not loaded");
      return null;
    }
    
    try {
      console.log("Dans worklet, création Float32Array...");
      // Créer le Float32Array dans le worklet
      const float32 = new Float32Array(pixelData.length);
      for (let i = 0; i < pixelData.length; i++) {
        float32[i] = pixelData[i];
      }
      
      console.log("Float32 créé, premiers:", float32[0], float32[1], float32[2]);
      console.log("Appel model.runSync...");
      
      // Tenter l'inférence
      const result = model.runSync([float32]);
      console.log("✅ runSync réussi! Sorties:", result.length);
      return result;
    } catch (error) {
      console.error("Gallery inference error:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
      } 
      return null;
    }
  });

  const processImageFromGallery = async (imageUri: string) => {
  if (!model) return;
  setLoading(true);

  try {
    // 1. Préparation Image
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri, [{ resize: { width: 640, height: 640 } }],
      { format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    const imgBuffer = Buffer.from(manipResult.base64!, 'base64');
    const rawData = jpeg.decode(imgBuffer, { useTArray: true });
    
    // 2. Création d'un buffer "frais"
    const float32Data = new Float32Array(1228800);
    for (let i = 0; i < 409600; i++) {
      float32Data[i * 3]     = rawData.data[i * 4] / 255.0;
      float32Data[i * 3 + 1] = rawData.data[i * 4 + 1] / 255.0;
      float32Data[i * 3 + 2] = rawData.data[i * 4 + 2] / 255.0;
    }

    // --- LE FIX POUR ANDROID ---
    // On libère manuellement les grosses variables avant l'appel CPU intensif
    // @ts-ignore
    manipResult.base64 = null;
    
    console.log("Exécution Inférence...");

    // On utilise run() au lieu de runSync() pour laisser le thread UI respirer
    // et éviter le "Watchdog" Android qui tue l'app si runSync prend 200ms
    const outputs = await model.run([float32Data]);

    if (outputs && outputs.length > 0) {
      console.log("Inférence terminée. Taille sortie:", outputs[0].length);
      
      // Sécurité : on vérifie que la sortie fait bien 19 * 8400 = 159600
      if (outputs[0].length === 159600) {
        const result = processOutput(outputs[0]);
        setCapturedResult(result);
        setUri(imageUri);
      } else {
        console.error("Taille de sortie inattendue:", outputs[0].length);
      }
    }
  } catch (error) {
    console.error("Crash intercepté par Catch:", error);
    Alert.alert("Désolé", "L'analyse a échoué. Ton téléphone bloque peut-être l'usage du processeur pour ce modèle.");
  } finally {
    setLoading(false);
  }
};

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission requise", "Tu dois autoriser l'accès à la galerie !");
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, 
      aspect: [1, 1],      
      quality: 0.7,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      await processImageFromGallery(result.assets[0].uri);
    }
  };

  const takePicture = async () => {
    try {
      const result = { label: detectionLabel, score: detectionScore }
      setCapturedResult(result);
      
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePhoto({
          flash: flash,
          enableShutterSound: true
        });
        
        if (photo?.path) {
          const fullUri = `file://${photo.path}`;
          setUri(fullUri);
          putInHistory(result.label, result.score, fullUri);
        } 
          
      }
    } catch (error) { 
      console.error("Erreur prise de photo:", error); 
    }
  };

  const closePhoto = () => { 
    setUri(null); 
    setCapturedResult(null); 
  };

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (model == null || isBusy.value) return;
    runAtTargetFps(2, () => {
      'worklet';
      isBusy.value = true; 
      try {
        const resized = resize(frame, {
          scale: { width: 640, height: 640 },
          pixelFormat: 'rgb', 
          dataType: 'float32', 
        });
        const outputs = model.runSync([resized]);
        const data = outputs[0];
        
        if (data && data.length > 0) {
          const numAnchors = 8400;
          const numClass = 15;
          let bestScore = 0.55; 
          let bestClassIdx = -1;
          for (let c = 0; c < numClass; c++) {
            const rowOffset = (4 + c) * numAnchors;
            for (let i = 0; i < numAnchors; i++) {
              const score = (data as any)[rowOffset + i];
              if (score > bestScore) { 
                bestScore = score; 
                bestClassIdx = c; 
              }
            }
          }
          if (bestClassIdx !== -1) { 
            const labelStr = labels[bestClassIdx] ?? "Animal";
            updateResultOnJS(labelStr, `${Math.round(bestScore * 100)}%`);
          } else { 
            updateResultOnJS("", ""); 
          }
        }
      } catch (e) { 
        console.log(e); 
      } finally { 
        isBusy.value = false; 
      }
    });
  }, [model, labels]);


  async function putInHistory(label: string, scoreStr: string, imageUri: string) {
    if (!user || !label || label === "Inconnu") return;
    const numericScore = parseInt(scoreStr.replace("%", ""), 10);

      try {
        const formData = new FormData();
        formData.append('file',{
          uri: imageUri,
          type: 'image/jpeg',
          name: "upload.jpg"
        } as any)

        formData.append('upload_preset', 'animal_sae'); 
        const cloudName = 'dpwbxqmvt';

        const cloudRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

        const imageUrlOnWeb = cloudRes.data.secure_url;

        await axios.post(`${API_URL}/add_history`, {user_id: user.id, animale_name: label, animale_rate_reconize: numericScore, uri: imageUrlOnWeb})
      } catch (error: any) {
        console.error("Erreur historique:", error.response?.data || error.message);
        Alert.alert("Erreur", error.response?.data?.detail || "Erreur de connexion, impossible d'enregistrer dans l'historique");
      }
  
  }

  if (uri) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white', marginBottom: 20, fontSize: 18 }}>Résultat :</Text>
        <Image source={{ uri: uri }} style={{ width: '90%', height: '60%', borderRadius: 10 }} resizeMode="contain" />
        <View style={styles.resultContainer}>
            {loading ? (
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <ActivityIndicator color="#00ff00" />
                    <Text style={[styles.finalResultText, {marginLeft: 10}]}>Analyse en cours...</Text>
                </View>
            ) : capturedResult && capturedResult.label !== "Inconnu" && capturedResult.label !== "" ? (
                <Text style={styles.finalResultText}>C'est un {capturedResult.label} ({capturedResult.score}) !</Text>
            ) : (
                <Text style={styles.finalResultText}>Aucun animal identifié.</Text>
            )}
        </View>
        <TouchableOpacity onPress={closePhoto} style={styles.btnRetour}>
            <Text style={styles.textBtn}>Retour caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasPermission || !device) return <View style={styles.center}><Text style={styles.whiteText}>Chargement...</Text></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!uri}
        format={format}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        videoStabilizationMode="off" 
        photo={true}
      />
      
      {device?.hasFlash && (
        <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
             <Text style={styles.iconText}>{flash === 'on' ? '⚡️' : '🚫'}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.overlay}>
         {detectionLabel ? (
            <View style={styles.resultCard}>
              <Text style={styles.labelText}>{detectionLabel}</Text>
              <Text style={styles.scoreText}>{detectionScore}</Text>
            </View>
         ) : (
            <View style={styles.searchingBox}>
                <Text style={styles.searchingText}>Recherche...</Text>
            </View>
         )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
            <Text style={styles.iconText}>🖼️</Text>
        </TouchableOpacity>

        <Pressable onPress={takePicture}>
           <View style={styles.shutterOuter}><View style={styles.shutterInner} /></View>
        </Pressable>

        <TouchableOpacity style={styles.flipButton} onPress={toggleCamera}>
            <Text style={styles.iconText}>🔄</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black' },
  whiteText: { color: 'white', fontWeight: 'bold' },
  overlay: { position: 'absolute', top: 100, alignSelf: 'center', zIndex: 10, alignItems: 'center' },
  resultCard: { backgroundColor: 'rgba(0,255,0,0.3)', paddingHorizontal: 35, paddingVertical: 20, borderRadius: 25, alignItems: 'center', borderWidth: 2, borderColor: '#00ff00' },
  searchingBox: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 15, borderRadius: 15 },
  labelText: { color: '#00ff00', fontSize: 36, fontWeight: '900', textTransform: 'uppercase' },
  scoreText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  searchingText: { color: '#aaa', fontSize: 16, fontWeight: 'bold' },
  controls: { position: 'absolute', bottom: 50, width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  shutterOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' },
  flashButton: { position: 'absolute', top: 60, left: 30, backgroundColor: 'rgba(0,0,0,0.5)', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  flipButton: { backgroundColor: 'rgba(0,0,0,0.5)', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  galleryButton: { backgroundColor: 'rgba(0,0,0,0.5)', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 24 }, 
  btnRetour: { marginTop: 30, padding: 15, backgroundColor: 'white', borderRadius: 10 },
  textBtn: { color: 'black', fontWeight: 'bold' },
  resultContainer: { marginTop: 20, alignItems: 'center' },
  finalResultText: { color: '#00ff00', fontSize: 22, fontWeight: 'bold', textAlign: 'center' }
});