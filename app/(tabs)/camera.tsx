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

export default function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('back');
  
  // État du Flash (ON/OFF)
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
     const numAnchors = 8400;
     const numClass = 15;
     let bestScore = 0.55; 
     let bestClassIdx = -1;

     for (let c = 0; c < numClass; c++) {
       const rowOffset = (4 + c) * numAnchors;
       for (let i = 0; i < numAnchors; i++) {
         const score = data[rowOffset + i];
         if (score > bestScore) {
           bestScore = score;
           bestClassIdx = c;
         }
       }
     }
     return bestClassIdx !== -1 
        ? { label: labels[bestClassIdx], score: `${Math.round(bestScore * 100)}%` }
        : { label: "Inconnu", score: "" };
  };

  const toggleCamera = () => setCameraPosition((cur) => (cur === 'back' ? 'front' : 'back'));
  const toggleFlash = () => setFlash((cur) => (cur === 'off' ? 'on' : 'off'));

  const processImageFromGallery = async (imageUri: string) => {
    if (!model) return;
    setLoading(true);
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 640, height: 640 } }],
        { format: ImageManipulator.SaveFormat.JPEG, base64: true } 
      );
      const imgBuffer = Buffer.from(manipResult.base64!, 'base64');
      const rawData = jpeg.decode(imgBuffer, { useTArray: true });
      const float32Data = new Float32Array(640 * 640 * 3);
      let p = 0;
      for (let i = 0; i < rawData.data.length; i += 4) {
         float32Data[p++] = rawData.data[i] / 255.0;     
         float32Data[p++] = rawData.data[i + 1] / 255.0; 
         float32Data[p++] = rawData.data[i + 2] / 255.0; 
      }
      const outputs = model.runSync([float32Data]);
      setCapturedResult(processOutput(outputs[0]));
      setUri(imageUri); 
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'analyser cette image.");
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, 
      aspect: [1, 1],      
      quality: 1,
    });
    if (!result.canceled) {
      await processImageFromGallery(result.assets[0].uri);
    }
  };

  const takePicture = async () => {
    try {
      // On sauvegarde le résultat actuel de l'IA (avant le flash)
      setCapturedResult({ label: detectionLabel, score: detectionScore });
      
      if (cameraRef.current) {
        // MODIFICATION ICI : On remet le flash 'physique'
        const photo = await cameraRef.current.takePhoto({
          flash: flash, // 'on' ou 'off' selon l'état du bouton
          enableShutterSound: true
        });
        
        if (photo?.path) setUri(`file://${photo.path}`);
      }
    } catch (error) { console.error(error); }
  };

  const closePhoto = () => { setUri(null); setCapturedResult(null); };

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
              if (score > bestScore) { bestScore = score; bestClassIdx = c; }
            }
          }
          if (bestClassIdx !== -1) { 
            const labelStr = labels[bestClassIdx] ?? "Animal";
            updateResultOnJS(labelStr, `${Math.round(bestScore * 100)}%`);
          } else { updateResultOnJS("", ""); }
        }
      } catch (e) { console.log(e); } finally { isBusy.value = false; }
    });
  }, [model, labels]);

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
        // J'ai retiré la prop "torch" ici pour revenir au flash normal
      />
      
      {/* Bouton Flash classique */}
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