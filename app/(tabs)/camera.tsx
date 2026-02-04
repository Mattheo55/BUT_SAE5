import { API_URL, cloudName } from "@/helper/constant";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Camera,
  CameraPosition,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { useAuth } from "./compte";

export default function CameraScreen() {
  const { user } = useAuth();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>("back");
  const [flash, setFlash] = useState<"off" | "on">("off");

  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef<Camera>(null);

  // États pour l'affichage
  const [detectionLabel, setDetectionLabel] = useState<string>("");
  const [detectionScore, setDetectionScore] = useState<string>("");

  // États pour la capture manuelle (mode "Pause/Résultat")
  const [uri, setUri] = useState<string | null>(null);
  const [capturedResult, setCapturedResult] = useState<{
    label: string;
    score: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Remplacement de "isBusy" par un Ref pour ne pas bloquer le thread JS
  const isAnalyzing = useRef(false);
  const intervalRef = useRef<any>(null);

  // --- CONFIGURATION ---
  // On vise 3 FPS (1000ms / 3 ≈ 333ms)
  const TARGET_FPS_INTERVAL = 333;

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // --- BOUCLE D'ANALYSE SERVEUR (3 FPS) ---
  useEffect(() => {
    // Si on a déjà figé une image (uri existe) ou pas de caméra, on arrête l'analyse
    if (uri || !device || !cameraRef.current) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Démarrage de la boucle
    intervalRef.current = setInterval(async () => {
      // 1. Verrou : Si une analyse est déjà en cours, on passe notre tour (pour éviter de surcharger le réseau)
      if (isAnalyzing.current) return;

      try {
        isAnalyzing.current = true;

        // 2. Capture rapide (basse qualité pour la vitesse d'envoi)
        if (cameraRef.current) {
          const photo = await cameraRef.current.takePhoto({
            flash: "off",
            enableShutterSound: false, // Tente de couper le son (Android)
          });

          // 3. Envoi au serveur
          // NOTE: Idéalement, votre API Python devrait accepter le fichier directement sans passer par Cloudinary
          // pour le mode "live" afin de réduire la latence.
          // Ici, j'utilise la logique existante (Cloudinary -> Python) mais c'est lourd pour du temps réel.
          await analyzeFrame(photo.path);
        }
      } catch (err) {
        console.log("Erreur boucle analyse:", err);
      } finally {
        isAnalyzing.current = false;
      }
    }, TARGET_FPS_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [uri, device, cameraRef, cameraPosition]); // Dépendances importantes

  // --- FONCTION D'ANALYSE (Logique métier) ---
  const analyzeFrame = async (imagePath: string) => {
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: `file://${imagePath}`,
        type: "image/jpeg",
        name: "live_frame.jpg",
      } as any);
      formData.append("upload_preset", "animal_sae");

      // A. Upload Cloudinary
      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const imageUrl = uploadRes.data.secure_url;

      // B. Analyse Python
      const apiRes = await axios.post(`${API_URL}/analyze_animal`, {
        image_url: imageUrl,
      });

      const { label, score } = apiRes.data;

      // Mise à jour de l'UI en temps réel (sans figer l'écran)
      if (label && label !== "Inconnu") {
        setDetectionLabel(label);
        setDetectionScore(score); // Assurez-vous que l'API renvoie un format texte (ex: "95%")
      } else {
        // Optionnel : remettre à vide si rien n'est détecté
        // setDetectionLabel("");
      }
    } catch (error) {
      // On ignore les erreurs silencieusement dans la boucle live pour ne pas spammer d'alertes
      console.log("Erreur analyse live:", error);
    }
  };

  // --- FONCTION GALERIE & SAUVEGARDE (Code existant conservé pour le mode manuel) ---
  const processImageFromGallery = async (imageUri: string) => {
    setLoading(true);
    setUri(imageUri); // On fige l'écran immédiatement

    try {
      const formData = new FormData();
      formData.append("file", {
        uri: imageUri,
        type: "image/jpeg",
        name: "upload.jpg",
      } as any);
      formData.append("upload_preset", "animal_sae");

      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      const imageUrl = uploadRes.data.secure_url;
      const apiRes = await axios.post(`${API_URL}/analyze_animal`, {
        image_url: imageUrl,
      });

      const { label, score, annoted_image } = apiRes.data;
      setCapturedResult({ label, score: score });

      if (annoted_image) {
        setUri(`data:image/jpeg;base64,${annoted_image}`);
      }

      await putInHistory(label, score, imageUrl);
    } catch (error) {
      console.error("Erreur API:", error);
      Alert.alert("Erreur", "Impossible d'analyser l'image.");
      setUri(null); // Retour caméra si erreur
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      await processImageFromGallery(result.assets[0].uri);
    }
  };

  // --- ACTIONS UTILISATEUR ---
  const toggleCamera = () =>
    setCameraPosition((cur) => (cur === "back" ? "front" : "back"));
  const toggleFlash = () => setFlash((cur) => (cur === "off" ? "on" : "off"));

  // Bouton "Photo" manuel : Fige l'état actuel
  const takePicture = async () => {
    // Si on a déjà un label détecté par le live, on peut juste figer ça
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePhoto({ flash: flash });
      // On traite cette photo comme une photo de galerie (haute qualité, historique, etc.)
      await processImageFromGallery(`file://${photo.path}`);
    }
  };

  const closePhoto = () => {
    setUri(null);
    setCapturedResult(null);
    setDetectionLabel("");
    setDetectionScore("");
    // L'effet useEffect redémarrera automatiquement la boucle live
  };

  async function putInHistory(
    label: string,
    scoreStr: string,
    imageUri: string,
  ) {
    if (!user || !label || label === "Inconnu") return;
    const numericScore = parseInt(scoreStr.replace("%", ""), 10);
    try {
      // Logique historique conservée...
      await axios.post(`${API_URL}/add_history`, {
        user_id: user.id,
        animale_name: label,
        animale_rate_reconize: numericScore,
        uri: imageUri,
      });
    } catch (e) {}
  }

  // --- RENDER ---
  // 1. Écran de résultat (Image figée)
  if (uri) {
    return (
      <View style={styles.center}>
        <Image
          source={{ uri: uri }}
          style={{ width: "90%", height: "60%", borderRadius: 10 }}
          resizeMode="contain"
        />
        <View style={styles.resultContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#00ff00" />
          ) : capturedResult ? (
            <Text style={styles.finalResultText}>
              {capturedResult.label} ({capturedResult.score})
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={closePhoto} style={styles.btnRetour}>
          <Text style={styles.textBtn}>Retour Caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2. Écran Caméra (Live Server Scan)
  if (!hasPermission || !device)
    return (
      <View style={styles.center}>
        <Text style={styles.whiteText}>Chargement...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true} // Important pour permettre takePhoto
        videoStabilizationMode="off"
      />

      {/* Overlay Interface */}
      <View style={styles.overlay}>
        {detectionLabel ? (
          <View style={styles.resultCard}>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.liveIndicator}>🔴 LIVE SERVER</Text>
              <Text style={styles.labelText}>{detectionLabel}</Text>
              <Text style={styles.scoreText}>{detectionScore}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.searchingBox}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.searchingText}> Analyse serveur...</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
          <Text style={styles.iconText}>🖼️</Text>
        </TouchableOpacity>

        <Pressable onPress={takePicture}>
          <View style={styles.shutterOuter}>
            <View style={styles.shutterInner} />
          </View>
        </Pressable>

        <TouchableOpacity style={styles.flipButton} onPress={toggleCamera}>
          <Text style={styles.iconText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Bouton Flash */}
      <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
        <Text style={styles.iconText}>{flash === "on" ? "⚡️" : "🚫"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  whiteText: { color: "white", fontWeight: "bold" },
  overlay: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
    zIndex: 10,
    width: "100%",
    alignItems: "center",
  },
  resultCard: {
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#00ff00",
    minWidth: 200,
  },
  liveIndicator: {
    color: "red",
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 5,
  },
  searchingBox: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 15,
    borderRadius: 30,
    alignItems: "center",
  },
  labelText: {
    color: "#00ff00",
    fontSize: 32,
    fontWeight: "900",
    textTransform: "uppercase",
    textAlign: "center",
  },
  scoreText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  searchingText: { color: "#ccc", fontSize: 14, marginLeft: 10 },
  controls: {
    position: "absolute",
    bottom: 50,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
  },
  flashButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  flipButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  galleryButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: { fontSize: 24 },
  btnRetour: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "white",
    borderRadius: 10,
  },
  textBtn: { color: "black", fontWeight: "bold" },
  resultContainer: { marginTop: 20, alignItems: "center" },
  finalResultText: {
    color: "#00ff00",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
});
