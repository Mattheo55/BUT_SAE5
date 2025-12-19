import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor
} from 'react-native-vision-camera';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

export default function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  
  const [detectionLabel, setDetectionLabel] = useState<string>(""); 
  const [detectionScore, setDetectionScore] = useState<string>(""); 

  // Chargement du modèle Float16 (plus stable et précis)
  const objectDetection = useTensorflowModel(require("../../assets/models/best_float16.tflite"));
  const model = objectDetection.model;
  const { resize } = useResizePlugin();

  // Verrou pour empêcher l'IA de saturer le processeur
  const isBusy = useSharedValue(false);
  
  const labels = useMemo(() => [
      'Ours', 'Guépard', "Crocodile", 'Éléphant', 'Renard', 
      'Girafe', 'Hérisson', 'Humain', 'Léopard', 'Lion', 
      'Lynx', 'Autruche', 'Rhinocéros', 'Tigre', 'Zèbre'
  ], []);

  // Format 720p à 30fps maximum pour limiter la chauffe
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

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    // Si le modèle n'est pas prêt ou déjà occupé, on ne fait rien
    if (model == null || isBusy.value) return;

    // ANALYSE 1 FOIS PAR SECONDE : Laisse le CPU respirer (idéal si partage de connexion actif)
    runAtTargetFps(1, () => {
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
          
          let bestScore = 0.55; // Seuil de confiance à 55%
          let bestClassIdx = -1;

          // Parcours optimisé du tenseur de sortie YOLOv11
          for (let c = 0; c < numClass; c++) {
            const rowOffset = (4 + c) * numAnchors;
            for (let i = 0; i < numAnchors; i++) {
              const score = data[rowOffset + i] as unknown as number;
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
        // Erreur ignorée pour la fluidité
      } finally {
        isBusy.value = false; // Libère le verrou pour la seconde suivante
      }
    });
  }, [model, labels]);

  if (!hasPermission || !device) return <View style={styles.center}><Text style={styles.whiteText}>Chargement...</Text></View>;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        format={format}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        videoStabilizationMode="off" // Très important pour économiser le CPU
        enableZoomGesture={false}
        photo={false}
      />
      
      <View style={styles.overlay}>
         {detectionLabel ? (
            <View style={styles.resultCard}>
              <Text style={styles.labelText}>{detectionLabel}</Text>
              <Text style={styles.scoreText}>{detectionScore}</Text>
            </View>
         ) : (
            <View style={styles.searchingBox}>
                <Text style={styles.searchingText}>Analyse intelligente...</Text>
            </View>
         )}
      </View>

      <View style={styles.controls}>
        <View style={styles.shutterOuter}><View style={styles.shutterInner} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black' },
  whiteText: { color: 'white', fontWeight: 'bold' },
  overlay: { position: 'absolute', top: 100, alignSelf: 'center', zIndex: 10, alignItems: 'center' },
  resultCard: { 
    backgroundColor: 'rgba(0,255,0,0.3)', 
    paddingHorizontal: 35, 
    paddingVertical: 20, 
    borderRadius: 25, 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00ff00'
  },
  searchingBox: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 15, borderRadius: 15 },
  labelText: { color: '#00ff00', fontSize: 36, fontWeight: '900', textTransform: 'uppercase' },
  scoreText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  searchingText: { color: '#aaa', fontSize: 16, fontWeight: 'bold' },
  controls: { position: 'absolute', bottom: 50, width: '100%', alignItems: 'center' },
  shutterOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' }
});