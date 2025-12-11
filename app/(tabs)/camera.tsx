import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { 
  Camera, 
  useCameraDevice, 
  useCameraPermission, 
  useFrameProcessor, 
  runAtTargetFps 
} from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from "expo-image"; // Assure-toi d'avoir installé expo-image
import * as ImagePicker from 'expo-image-picker';

export default function CameraScreen() {
  // --- PERMISSIONS & CONFIG CAMÉRA ---
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(cameraPosition);
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  // --- CHARGEMENT DU MODÈLE ---
  const objectDetection = useTensorflowModel(require("../../assets/models/best_int8.tflite"));
  const model = objectDetection.model;

  // --- ÉTATS UI ---
  const [detectionLabel, setDetectionLabel] = useState<string>(""); 
  const [detectionScore, setDetectionScore] = useState<string>(""); 
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const { resize } = useResizePlugin();
  
  // --- LISTE DES CLASSES (DYNAMIQUE) ---
  // Tu peux ajouter des animaux ici sans toucher au reste du code
  const labels = useMemo(() => ["Chat", "Cheval", "Chèvre"], []);

  useEffect(() => { requestPermission(); }, []);

  // --- MISE À JOUR UI (WORKLET -> JS) ---
  const updateResultOnJS = Worklets.createRunOnJS((label: string, score: string) => {
    setDetectionLabel(label);
    setDetectionScore(score);
  });

  // --- FRAME PROCESSOR ---
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (model == null) return;

    // Limite à 5 FPS pour ne pas surchauffer le téléphone
    runAtTargetFps(5, () => {
      
      // 1. Prétraitement de l'image
      const resized = resize(frame, {
        scale: { width: 640, height: 640 },
        pixelFormat: 'rgb',
        dataType: 'float32', // IMPORTANT : float32 aide souvent à normaliser les entrées uint8
      });

      // 2. Exécution du modèle
      const outputs = model.runSync([resized]);
      const data = outputs[0];

      if (data) {
        // Configuration YOLOv8 standard
        const numAnchors = 8400; 
        const numClass = labels.length; // S'adapte à ta liste (ici 3)

        let maxScore = 0;
        let maxClassIndex = -1;

        // BOUCLE DYNAMIQUE
        // On parcourt les 8400 boîtes potentielles
        for (let i = 0; i < numAnchors; i++) {
            
            let currentMaxForBox = 0;
            let currentClassForBox = -1;

            // On vérifie chaque animal pour cette boîte
            for (let c = 0; c < numClass; c++) {
                // Les classes commencent à la ligne 4 (après x, y, w, h)
                // Index = (Ligne * Largeur) + Colonne
                const classRow = 4 + c; 
                const index = classRow * numAnchors + i;

                // Lecture du score
                // @ts-ignore
                const score = Number(data[index]);

                if (score > currentMaxForBox) {
                    currentMaxForBox = score;
                    currentClassForBox = c;
                }
            }

            // Si cette boîte est la meilleure de toute l'image jusqu'à présent
            if (currentMaxForBox > maxScore) {
                maxScore = currentMaxForBox;
                maxClassIndex = currentClassForBox;
            }
        }

        // --- NORMALISATION ---
        // Si le modèle sort du 0-255 (int8), on remet en %
        if (maxScore > 1) maxScore = maxScore / 255.0;

        // --- SEUIL DE CONFIANCE ---
        // On n'affiche que si on est sûr à plus de 45%
        if (maxScore > 0) {
            const labelStr = labels[maxClassIndex] ?? "Inconnu";
            const scoreStr = (maxScore * 100).toFixed(0) + "%";
            updateResultOnJS(labelStr, scoreStr);
        } else {
             // Si rien n'est détecté ou score trop bas
             updateResultOnJS("", "");
        }
      }
    });
  }, [model, labels]);

  // --- FONCTIONS PHOTO ---
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
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!res.canceled && res.assets[0].uri) setCapturedImage(res.assets[0].uri);
  };

  // --- UI COMPONENTS ---
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

  // --- AFFICHAGE IMAGE CAPTURÉE ---
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

  // --- CHARGEMENT / PERMISSIONS ---
  if (!hasPermission || !device) return <View style={styles.center}><Text style={{color:'white'}}>Chargement...</Text></View>;

  // --- VUE CAMÉRA PRINCIPALE ---
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