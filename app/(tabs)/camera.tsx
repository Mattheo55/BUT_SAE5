import { API_URL, cloudName } from "@/helper/constant";
import axios from "axios";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  // Indicateur visuel pour le réseau
  const [isNetworkBusy, setIsNetworkBusy] = useState(false);

  const device = useCameraDevice(cameraPosition);

  // On privilégie un format HD (1280x720) ou VGA (640x480) pour avoir une bonne source
  const format = useMemo(() => {
    if (!device) return undefined;
    return (
      device.formats.find(
        (f) => f.videoWidth === 1280 || f.videoWidth === 640,
      ) || device.formats[0]
    );
  }, [device]);

  const cameraRef = useRef<Camera>(null);
  const clearTimerRef = useRef<any>(null);

  // IMPORTANT : Ce ref stocke l'heure de la DERNIÈRE requête terminée avec succès
  // Cela permet d'ignorer les réponses qui arrivent dans le désordre ou trop tard.
  const lastProcessedTimestamp = useRef<number>(0);

  const [detectionLabel, setDetectionLabel] = useState<string>("");
  const [detectionScore, setDetectionScore] = useState<string>("");

  const [uri, setUri] = useState<string | null>(null);
  const [capturedResult, setCapturedResult] = useState<{
    label: string;
    score: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Verrou pour éviter de lancer 50 uploads en même temps
  const isAnalyzing = useRef(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const updateUI = (label: string, score: string) => {
    // FILTRE DE QUALITÉ : On ignore les résultats sous 50% de confiance
    // Cela réduit énormément les faux positifs (voir des animaux dans les murs)
    const numericScore = parseInt(score.replace("%", ""), 10);
    if (isNaN(numericScore) || numericScore < 70) return;

    if (label && label !== "Inconnu") {
      setDetectionLabel(label);
      setDetectionScore(score);

      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

      // Persistance de 3 secondes pour fluidifier l'affichage
      clearTimerRef.current = setTimeout(() => {
        setDetectionLabel("");
        setDetectionScore("");
      }, 3000);
    }
  };

  useEffect(() => {
    if (uri || !device || !cameraRef.current) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(async () => {
      if (isAnalyzing.current) return;

      try {
        isAnalyzing.current = true;
        setIsNetworkBusy(true);

        if (cameraRef.current) {
          const photo = await cameraRef.current.takePhoto({
            flash: "off",
            enableShutterSound: false,
          });

          const currentRequestTime = Date.now();
          await analyzeFrame(photo.path, currentRequestTime);
        }
      } catch (err) {
        console.log("Erreur boucle:", err);
      } finally {
        isAnalyzing.current = false;
        // On ne coupe pas le busy indicator tout de suite pour éviter le clignotement
        // On le laisse géré par le cycle suivant ou un timeout si besoin
        setTimeout(() => setIsNetworkBusy(false), 500);
      }
    }, 1200); // 1.2 secondes : Un bon compromis pour du 640px via Cloudinary

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [uri, device, cameraRef, cameraPosition]);

  const analyzeFrame = async (imagePath: string, requestTime: number) => {
    try {
      let uriToUpload = `file://${imagePath}`;

      // RESTAURATION : 640px de large
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          uriToUpload,
          [{ resize: { width: 640 } }], // Retour à 640px pour la précision
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }, // Qualité correcte
        );
        uriToUpload = manipResult.uri;
      } catch (e) {
        console.log("Erreur manip, utilisation originale");
      }

      // Si une requête plus récente a DÉJÀ été traitée pendant notre compression, on s'arrête.
      if (requestTime < lastProcessedTimestamp.current) return;

      const formData = new FormData();
      formData.append("file", {
        uri: uriToUpload,
        type: "image/jpeg",
        name: "live_hq.jpg",
      } as any);
      formData.append("upload_preset", "animal_sae");

      // Timeout un peu plus large (5s) car l'image est plus lourde (640px)
      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 5000 },
      );

      // Vérification temporelle après upload
      if (requestTime < lastProcessedTimestamp.current) return;

      const imageUrl = uploadRes.data.secure_url;

      const apiRes = await axios.post(
        `${API_URL}/analyze_animal`,
        { image_url: imageUrl },
        { timeout: 5000 },
      );

      // VERIFICATION FINALE CRITIQUE
      // On met à jour l'interface SEULEMENT si cette requête est plus récente que la dernière affichée
      if (requestTime > lastProcessedTimestamp.current) {
        lastProcessedTimestamp.current = requestTime; // On marque ce temps comme le nouveau référentiel
        const { label, score } = apiRes.data;
        updateUI(label, score);
      } else {
        console.log("Rejet d'une réponse obsolète (Lag réseau)");
      }
    } catch (error) {
      // Erreur silencieuse
    }
  };

  // --- LE RESTE DU CODE (Galerie, takePicture, Styles) reste identique ---
  const processImageFromGallery = async (imageUri: string) => {
    setLoading(true);
    setUri(imageUri);
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
      Alert.alert("Erreur", "Impossible d'analyser l'image.");
      setUri(null);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      await processImageFromGallery(result.assets[0].uri);
    }
  };
  const toggleCamera = () =>
    setCameraPosition((cur) => (cur === "back" ? "front" : "back"));
  const toggleFlash = () => setFlash((cur) => (cur === "off" ? "on" : "off"));
  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePhoto({ flash: flash });
      await processImageFromGallery(`file://${photo.path}`);
    }
  };
  const closePhoto = () => {
    setUri(null);
    setCapturedResult(null);
    setDetectionLabel("");
    setDetectionScore("");
  };
  async function putInHistory(
    label: string,
    scoreStr: string,
    imageUri: string,
  ) {
    if (!user || !label || label === "Inconnu") return;
    const numericScore = parseInt(scoreStr.replace("%", ""), 10);
    try {
      await axios.post(`${API_URL}/add_history`, {
        user_id: user.id,
        animale_name: label,
        animale_rate_reconize: numericScore,
        uri: imageUri,
      });
    } catch (e) {}
  }

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
        format={format}
        photo={true}
        videoStabilizationMode="off"
      />

      <View style={styles.overlay}>
        {detectionLabel ? (
          <View style={styles.resultCard}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 5,
                }}
              >
                <Text style={styles.liveIndicator}>🔴 LIVE</Text>
                {isNetworkBusy && (
                  <ActivityIndicator
                    size="small"
                    color="red"
                    style={{ marginLeft: 5, transform: [{ scale: 0.6 }] }}
                  />
                )}
              </View>
              <Text style={styles.labelText}>{detectionLabel}</Text>
              <Text style={styles.scoreText}>{detectionScore}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.searchingBox}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.searchingText}> Recherche...</Text>
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
  liveIndicator: { color: "red", fontSize: 10, fontWeight: "bold" },
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
