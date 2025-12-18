import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from "expo-image";
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

export default function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(cameraPosition);
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  // États UI
  const [detectionLabel, setDetectionLabel] = useState<string>(""); 
  const [detectionScore, setDetectionScore] = useState<string>(""); 
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // --- CHARGEMENT DU NOUVEAU MODÈLE FLOAT32 ---
  // Assure-toi que le fichier est bien dans assets/models/
  const objectDetection = useTensorflowModel(require("../../assets/models/best_float32.tflite"));
  const model = objectDetection.model;
  
  const { resize } = useResizePlugin();
  
  // Tes 15 classes
  const labels = useMemo(() => [
      'Bear', 'Cheetah', "Crocodile", 'Elephant', 'Fox', 
      'Giraffe', 'Hedgehog', 'Human', 'Leopard', 'Lion', 
      'Lynx', 'Ostrich', 'Rhinoceros', 'Tiger', 'Zebra'
  ], []);

  useEffect(() => { requestPermission(); }, []);

  const updateResultOnJS = Worklets.createRunOnJS((label: string, score: string) => {
    setDetectionLabel(label);
    setDetectionScore(score);
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (model == null) return;

    // Analyse fluide à 10 FPS (Float32 est rapide)
    runAtTargetFps(10, () => {
      'worklet';
      
      // 1. Prétraitement STANDARD (Float32)
      // C'est la config idéale : pas de conversion bizarre.
      const resized = resize(frame, {
        scale: { width: 640, height: 640 },
        pixelFormat: 'rgb',
        dataType: 'float32', 
      });

      // 2. Exécution
      const outputs = model.runSync([resized]);
      const data = outputs[0]; // C'est maintenant un Float32Array (valeurs 0.0 à 1.0)

      if (data) {
        const numAnchors = 8400; 
        const numClass = 15;
        
        // Initialisation à 0 (0% de confiance)
        let bestScore = 0; 
        let bestClassIdx = -1;

        // 3. BOUCLE DE LECTURE [19, 8400]
        // On parcourt les 8400 boîtes
        for (let i = 0; i < numAnchors; i++) {
            
            // Pour chaque boîte, on scanne les 15 classes
            for (let c = 0; c < numClass; c++) {
                
                // Formule pour lire "Channel First"
                // Ligne 0-3 : Coordonnées
                // Ligne 4 : Score Classe 0
                // Ligne 5 : Score Classe 1 ...
                const row = 4 + c; 
                const offset = (row * numAnchors) + i;
                
                // Lecture directe (C'est déjà un float entre 0 et 1 !)
                // @ts-ignore
                const score = Number(data[offset]); 

                if (score > bestScore) {
                    bestScore = score;
                    bestClassIdx = c;
                }
            }
        }

        // 4. RÉSULTAT
        // Seuil de confiance : 50% (0.5)
        if (bestScore > 0.50) {
            const labelStr = labels[bestClassIdx] ?? "Inconnu";
            // Conversion simple pour l'affichage
            const scoreStr = (bestScore * 100).toFixed(0) + "%";
            updateResultOnJS(labelStr, scoreStr);
        } else {
            // Si le meilleur score est faible, on vide l'affichage
            updateResultOnJS("", "");
        }
      }
    });
  }, [model, labels]);

  // --- RESTE DU CODE (Capture, UI...) ---
  const cameraRef = useRef<Camera>(null);

  const takePicture = async () => {
    try {
      if (cameraRef.current && device) {
        const photo = await cameraRef.current.takePhoto({ flash: flash });
        setCapturedImage("file://" + photo.path);
      }
    } catch (e) { console.log(e); }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.Images 
    });
    if (!res.canceled && res.assets[0].uri) setCapturedImage(res.assets[0].uri);
  };

  const ResultOverlay = () => (
    <View style={styles.overlay}>
       {detectionLabel ? (
          <>
            <Text style={styles.labelText}>{detectionLabel}</Text>
            <Text style={styles.scoreText}>{detectionScore}</Text>
          </>
       ) : (
          <Text style={[styles.scoreText, {fontSize: 16, color: '#aaa'}]}>Recherche...</Text>
       )}
    </View>
  );

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedImage }} contentFit="contain" style={{ flex: 1 }} />
        <ResultOverlay />
        <Pressable onPress={() => setCapturedImage(null)} style={styles.closeBtn}>
          <Text style={styles.btnText}>Retour Caméra</Text>
        </Pressable>
      </View>
    );
  }

  if (!hasPermission || !device) return <View style={styles.center}><Text style={{color:'white'}}>Chargement...</Text></View>;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        photo={true}
      />
      
      <ResultOverlay />
      
      <View style={styles.controls}>
        <Pressable onPress={pickImage} style={styles.roundBtn}>
          <MaterialCommunityIcons name="image" size={28} color="white" />
        </Pressable>
        <Pressable onPress={takePicture}>
          {({ pressed }) => (
             <View style={[styles.shutterOuter, { opacity: pressed ? 0.5 : 1 }]}>
               <View style={styles.shutterInner} />
             </View>
          )}
        </Pressable>
        <Pressable onPress={() => setCameraPosition(p => p === 'back' ? 'front' : 'back')} style={styles.roundBtn}>
          <MaterialCommunityIcons name="camera-flip" size={28} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black' },
  overlay: {
    position: 'absolute', top: 120, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, alignItems: 'center', zIndex: 10
  },
  labelText: { color: '#00ff00', fontSize: 32, fontWeight: 'bold', textTransform: 'uppercase' },
  scoreText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  controls: {
    position: 'absolute', bottom: 40, flexDirection: 'row', width: '100%',
    justifyContent: 'space-around', alignItems: 'center', zIndex: 10
  },
  roundBtn: { padding: 12, backgroundColor: 'rgba(50,50,50,0.7)', borderRadius: 50 },
  shutterOuter: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'white' },
  closeBtn: { position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'white', padding: 15, borderRadius: 10, zIndex: 20 },
  btnText: { fontWeight: 'bold', color: 'black' }
});