import { API_URL, cloudName } from '@/helper/constant';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
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
  const { user } = useAuth();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef<Camera>(null);

  const [detectionLabel, setDetectionLabel] = useState<string>("");
  const [detectionScore, setDetectionScore] = useState<string>("");
  const [uri, setUri] = useState<string | null>(null);
  const [capturedResult, setCapturedResult] = useState<{ label: string, score: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // --- CHARGEMENT MODELE (Pour la caméra en temps réel) ---
  // On laisse la config par défaut, le FrameProcessor gère bien la mémoire interne
  const objectDetection = useTensorflowModel(require("../../assets/models/best_float16.tflite"));
  const model = objectDetection.model;
  
  const { resize } = useResizePlugin();
  const isBusy = useSharedValue(false);

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

  // --- FONCTION GALERIE (VIA API) : MIGRATION ---
  const processImageFromGallery = async (imageUri: string) => {
    setLoading(true);
    console.log("--- Début traitement via API ---");

    try {
      // 1. Upload vers Cloudinary
      const formData = new FormData();
      formData.append('file', {
          uri: imageUri,
          type: "image/jpeg",
          name: "upload.jpg"
      } as any);
      formData.append('upload_preset', 'animal_sae');    
      
      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const imageUrl = uploadRes.data.secure_url;
      console.log('✅ Image Uploadée :', imageUrl);

      // 2. Envoi dans API Python locale
      const apiRes = await axios.post(`${API_URL}/analyze_animal`, { image_url: imageUrl });

      const { label, score } = apiRes.data;
      console.log('✅ Résultat API :', label, score);

      setCapturedResult({ label, score: score });
      setUri(imageUri);

      // 3. Sauvegarde historique
      await putInHistory(label, score, imageUrl);

    } catch (error) {
      console.error("❌ Erreur API:", error);
      Alert.alert("Oups", "Impossible d'analyser l'image via le serveur. Vérifie que ton PC est allumé et l'API lancée.");
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission", "Accès galerie requis");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      await processImageFromGallery(result.assets[0].uri);
    }
  };

  // Callback pour le Frame Processor
  const updateResultOnJS = Worklets.createRunOnJS((label: string, score: string) => {
    setDetectionLabel(label);
    setDetectionScore(score);
  });

  const toggleCamera = () => setCameraPosition((cur) => (cur === 'back' ? 'front' : 'back'));
  const toggleFlash = () => setFlash((cur) => (cur === 'off' ? 'on' : 'off'));
  const closePhoto = () => { setUri(null); setCapturedResult(null); };

  const takePicture = async () => {
    try {
      const result = { label: detectionLabel, score: detectionScore };
      setCapturedResult(result);
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePhoto({ flash: flash, enableShutterSound: true });
        if (photo?.path) {
          const fullUri = `file://${photo.path}`;
          setUri(fullUri);
          putInHistory(result.label, result.score, fullUri);
        }
      }
    } catch (error) { console.error("Erreur photo:", error); }
  };

  // --- FRAME PROCESSOR (CAMERA TEMPS RÉEL) ---
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (model == null || isBusy.value) return;
    runAtTargetFps(5, () => {
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
             let bestScore = 0.50;
             let bestClassIdx = -1;
             for (let c = 0; c < numClass; c++) {
               const rowOffset = (4 + c) * numAnchors;
               for (let i = 0; i < numAnchors; i++) {
                 const score = (data as any)[rowOffset + i];
                 if (score > bestScore) { bestScore = score; bestClassIdx = c; }
               }
             }
             if (bestClassIdx !== -1) updateResultOnJS(labels[bestClassIdx], `${Math.round(bestScore * 100)}%`);
             else updateResultOnJS("", "");
        }
      } catch (e) { console.log(e); } finally { isBusy.value = false; }
    });
  }, [model, labels]);

  async function putInHistory(label: string, scoreStr: string, imageUri: string) {
     if (!user || !label || label === "Inconnu") return;
    const numericScore = parseInt(scoreStr.replace("%", ""), 10);
    try {
      // Note: Si on vient de la galerie, l'image est déjà sur Cloudinary.
      // Si on vient de la caméra, c'est une URI locale.
      let finalUri = imageUri;
      
      if (!imageUri.startsWith('http')) {
          const formData = new FormData();
          formData.append('file', { uri: imageUri, type: 'image/jpeg', name: "upload.jpg" } as any);
          formData.append('upload_preset', 'animal_sae');
          const cloudRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          finalUri = cloudRes.data.secure_url;
      }

      await axios.post(`${API_URL}/add_history`, { 
          user_id: user.id, 
          animale_name: label, 
          animale_rate_reconize: numericScore, 
          uri: finalUri 
      });
    } catch (error: any) { console.error("History Error"); }
  }

  // --- RENDER ---
  if (uri) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white', marginBottom: 20, fontSize: 18 }}>Résultat :</Text>
        <Image source={{ uri: uri }} style={{ width: '90%', height: '60%', borderRadius: 10 }} resizeMode="contain" />
        <View style={styles.resultContainer}>
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#00ff00" />
              <Text style={[styles.finalResultText, { marginLeft: 10 }]}>Analyse en cours...</Text>
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
          <View style={styles.searchingBox}><Text style={styles.searchingText}>Recherche...</Text></View>
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