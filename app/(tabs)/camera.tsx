import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  const device = useCameraDevice(cameraPosition);
  
  const cameraRef = useRef<Camera>(null);

  const [detectionLabel, setDetectionLabel] = useState<string>(""); 
  const [detectionScore, setDetectionScore] = useState<string>(""); 
  const [uri, setUri] = useState<string | null>(null);
  const [capturedResult, setCapturedResult] = useState<{label: string, score: string} | null>(null);

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

  const toggleCamera = () => {
    setCameraPosition((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  const takePicture = async () => {
    try {
      setCapturedResult({
        label: detectionLabel,
        score: detectionScore
      });

      if (cameraRef.current) {
        const photo = await cameraRef.current.takePhoto({
          flash: flash, 
          enableShutterSound: true
        });
        
        if (photo && photo.path) {
          setUri(`file://${photo.path}`);
        }
      }
    } catch (error) {
      console.error("Erreur prise photo:", error);
    }
  };

  const closePhoto = () => {
    setUri(null);
    setCapturedResult(null);
  };

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (model == null || isBusy.value) return;

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
        console.log("Error frameprocessor", e);
      } finally {
        isBusy.value = false;
      }
    });
  }, [model, labels]);

  if (uri) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white', marginBottom: 20, fontSize: 18 }}>Photo prise :</Text>
        <Image source={{ uri: uri }} style={{ width: '90%', height: '60%', borderRadius: 10 }} resizeMode="contain" />
        <View style={styles.resultContainer}>
            {capturedResult && capturedResult.label ? (
                <Text style={styles.finalResultText}>C'est un {capturedResult.label} ({capturedResult.score}) !</Text>
            ) : (
                <Text style={styles.finalResultText}>Aucun animal identifié.</Text>
            )}
        </View>
        <TouchableOpacity onPress={closePhoto} style={styles.btnRetour}>
            <Text style={styles.textBtn}>Prendre une autre photo</Text>
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
      
      {device.hasFlash && (
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
        <View style={{width: 60}} /> 

        <Pressable onPress={takePicture}>
           <View style={styles.shutterOuter}>
             <View style={styles.shutterInner} />
           </View>
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
  resultCard: { 
    backgroundColor: 'rgba(0,255,0,0.3)', 
    paddingHorizontal: 35, paddingVertical: 20, borderRadius: 25, 
    alignItems: 'center', borderWidth: 2, borderColor: '#00ff00'
  },
  searchingBox: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 15, borderRadius: 15 },
  labelText: { color: '#00ff00', fontSize: 36, fontWeight: '900', textTransform: 'uppercase' },
  scoreText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  searchingText: { color: '#aaa', fontSize: 16, fontWeight: 'bold' },
  
  controls: { 
      position: 'absolute', 
      bottom: 50, 
      width: '100%', 
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center' 
  },
  
  shutterOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' },
  
  flashButton: {
    position: 'absolute',
    top: 60,
    left: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 50, height: 50,
    borderRadius: 25,
    justifyContent: 'center', alignItems: 'center'
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 60, height: 60,
    borderRadius: 30,
    justifyContent: 'center', alignItems: 'center'
  },
  iconText: { fontSize: 24 },

  btnRetour: { marginTop: 30, padding: 15, backgroundColor: 'white', borderRadius: 10 },
  textBtn: { color: 'black', fontWeight: 'bold' },
  resultContainer: { marginTop: 20, alignItems: 'center' },
  finalResultText: { color: '#00ff00', fontSize: 22, fontWeight: 'bold', textAlign: 'center' }
});