import { API_URL } from '@/helper/constant';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, Check, Image as ImageIcon, Upload, X } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from './compte';

import ThemedText from '@/Components/ThemedText';
import ThemedView from '@/Components/ThemedView';

// Type pour notre boîte
type BoundingBox = { x: number, y: number, width: number, height: number } | null;

export default function ContribuerPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // --- ÉTATS POUR LE DESSIN ---
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [finalBox, setFinalBox] = useState<BoundingBox>(null);
  const [currentBox, setCurrentBox] = useState<BoundingBox>(null);
  const currentBoxRef = useRef<BoundingBox>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const [displayedImageSize, setDisplayedImageSize] = useState({ width: 0, height: 0 });

  // --- GESTION DES GESTES ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        startPoint.current = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
        const initBox = { x: startPoint.current.x, y: startPoint.current.y, width: 0, height: 0 };
        currentBoxRef.current = initBox;
        setCurrentBox(initBox);
      },

      onPanResponderMove: (evt) => {
        const currentX = evt.nativeEvent.locationX;
        const currentY = evt.nativeEvent.locationY;
        const width = Math.abs(currentX - startPoint.current.x);
        const height = Math.abs(currentY - startPoint.current.y);
        const x = Math.min(currentX, startPoint.current.x);
        const y = Math.min(currentY, startPoint.current.y);
        const newBox = { x, y, width, height };
        currentBoxRef.current = newBox;
        setCurrentBox(newBox);
      },

      onPanResponderRelease: () => {
        const box = currentBoxRef.current;
        if (box && (box.width > 20 || box.height > 20)) {
          setFinalBox(box);
        }
        setCurrentBox(null);
        currentBoxRef.current = null;
      },
    })
  ).current;

  // --- 1. FONCTION : CHOISIR UNE IMAGE ---
  const pickImage = async (useCamera: boolean) => {
    let result;
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    };

    try {
      if (useCamera) {
        await ImagePicker.requestCameraPermissionsAsync();
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
    } catch (e) {
      console.log("Erreur lors de la sélection :", e);
      return;
    }

    if (result && !result.canceled) {
      setImageUri(result.assets[0].uri);
      setFinalBox(null);
      setCurrentBox(null);
      setIsDrawingMode(true);
    }
  };

  // --- 2. FONCTION : ENVOYER AU SERVEUR (Version Debug) ---
  const handleSubmit = async () => {
    if (!imageUri) return Alert.alert("Manquant", "Sélectionnez une image.");
    if (!label.trim()) return Alert.alert("Manquant", "Donnez un nom à l'objet.");
    if (!finalBox) return Alert.alert("Manquant", "Veuillez dessiner un cadre autour de l'objet sur l'image.");
    if (!user) return Alert.alert("Erreur", "Connectez-vous.");

    setIsUploading(true);

    try {
      // Calcul des coordonnées normalisées
      const normalizedBox = {
        x_min: finalBox.x / displayedImageSize.width,
        y_min: finalBox.y / displayedImageSize.height,
        x_max: (finalBox.x + finalBox.width) / displayedImageSize.width,
        y_max: (finalBox.y + finalBox.height) / displayedImageSize.height,
      };

      const formData = new FormData();

      // --- CORRECTION URI ANDROID ---
      let uriToUpload = imageUri;
      if (Platform.OS === 'android' && !uriToUpload.startsWith('file://')) {
        uriToUpload = `file://${uriToUpload}`;
      }

      const filename = uriToUpload.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // @ts-ignore
      formData.append('file', {
        uri: uriToUpload,
        name: filename,
        type: type
      });

      formData.append('label', label.toLowerCase().trim());
      formData.append('user_id', String(user.id));
      formData.append('bbox', JSON.stringify(normalizedBox));

      console.log("🚀 Envoi avec FETCH vers :", `${API_URL}/contribute`);

      // --- ENVOI FETCH ---
      const response = await fetch(`${API_URL}/contribute`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // PAS DE CONTENT-TYPE ICI
        },
      });

      // --- DÉBOGAGE CRUCIAL ---
      console.log("📊 Code Statut HTTP:", response.status);
      
      // On lit le texte brut AVANT de parser le JSON
      const responseText = await response.text();
      console.log("📩 Réponse brute du serveur :", responseText);

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}: ${responseText.slice(0, 100)}...`);
      }

      // On tente de parser le JSON seulement si tout va bien
      let json;
      try {
        json = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Le serveur n'a pas renvoyé du JSON valide. C'est sûrement une page HTML d'erreur.");
      }

      Alert.alert("Succès ! 🚀", "Contribution envoyée.");
      router.back();

    } catch (error: any) {
      console.error("❌ Erreur Fetch:", error);
      Alert.alert("Erreur", error.message || "Problème de connexion");
    } finally {
      setIsUploading(false);
    }
  };

  const renderDrawingArea = () => {
    if (!imageUri) return null;

    return (
      <View style={styles.drawingContainer}>
        <ThemedText style={{ textAlign: 'center', marginBottom: 10, fontSize: 12 }}>
          Dessinez un rectangle autour de l'objet
        </ThemedText>

        <View
          style={styles.imageWrapper}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setDisplayedImageSize({ width, height });
          }}
        >
          <Image source={{ uri: imageUri }} style={styles.imageToDrawOn} resizeMode="contain" />

          {!finalBox && (
            <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
              {currentBox && (
                <View
                  style={[
                    styles.boundingBoxTemp,
                    {
                      left: currentBox.x,
                      top: currentBox.y,
                      width: currentBox.width,
                      height: currentBox.height,
                    },
                  ]}
                />
              )}
            </View>
          )}

          {finalBox && (
            <View
              style={[
                styles.boundingBoxFinal,
                {
                  left: finalBox.x,
                  top: finalBox.y,
                  width: finalBox.width,
                  height: finalBox.height,
                  zIndex: 10
                },
              ]}
            >
              <TouchableOpacity
                style={styles.closeBoxBtn}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                onPress={() => {
                  setFinalBox(null);
                  currentBoxRef.current = null;
                }}
              >
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.validateBtn, !finalBox && { opacity: 0.5 }]}
          onPress={() => {
            if (finalBox) setIsDrawingMode(false)
          }}
          disabled={!finalBox}
        >
          <Check color="white" size={20} />
          <ThemedText style={{ color: 'white', marginLeft: 5 }}>Valider le dessin</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 20 }}>Entraîner l'IA 🧠</ThemedText>

          {isDrawingMode ? (
            renderDrawingArea()
          ) : (
            <>
              <View style={styles.imageContainerPreview}>
                {imageUri ? (
                  <>
                    <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                    {finalBox && <View style={styles.boxIndicator}><Check size={12} color="white" /><ThemedText style={{ color: 'white', fontSize: 10, marginLeft: 4 }}>Zone définie</ThemedText></View>}
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => { setImageUri(null); setFinalBox(null); }}>
                      <X color="white" size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtn} onPress={() => setIsDrawingMode(true)}>
                      <ThemedText style={{ color: 'white', fontSize: 12 }}>Modifier la zone</ThemedText>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.placeholder}>
                    <ThemedText>Aucune image</ThemedText>
                  </View>
                )}
              </View>

              {!imageUri && (
                <View style={styles.rowButtons}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => pickImage(true)}>
                    <Camera color="#007AFF" size={24} /><ThemedText style={styles.btnText}>Caméra</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => pickImage(false)}>
                    <ImageIcon color="#007AFF" size={24} /><ThemedText style={styles.btnText}>Galerie</ThemedText>
                  </TouchableOpacity>
                </View>
              )}

              {imageUri && (
                <>
                  <View style={styles.inputContainer}>
                    <ThemedText type="subtitle" style={{ marginBottom: 5 }}>C'est quoi ?</ThemedText>
                    <TextInput style={styles.input} placeholder="Ex: Renard..." placeholderTextColor="#999" value={label} onChangeText={setLabel} />
                  </View>

                  <TouchableOpacity style={[styles.submitBtn, (isUploading || !finalBox) && styles.disabledBtn]} onPress={handleSubmit} disabled={isUploading || !finalBox}>
                    {isUploading ? <ActivityIndicator color="white" /> : <><Upload color="white" size={20} style={{ marginRight: 10 }} /><ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Envoyer avec la zone</ThemedText></>}
                  </TouchableOpacity>
                  {!finalBox && <ThemedText style={{ color: 'red', fontSize: 12, marginTop: 10 }}>⚠️ Vous devez définir la zone sur l'image</ThemedText>}
                </>
              )}
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center' },
  imageContainerPreview: { width: '100%', height: 250, backgroundColor: '#f0f0f0', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  placeholder: { opacity: 0.5 },
  deleteBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 5 },
  editBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#007AFF', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  boxIndicator: { position: 'absolute', top: 10, left: 10, backgroundColor: '#4CAF50', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },

  drawingContainer: { width: '100%', alignItems: 'center' },
  imageWrapper: { width: '100%', height: 400, position: 'relative', backgroundColor: '#000' },
  imageToDrawOn: { width: '100%', height: '100%' },
  boundingBoxTemp: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255, 255, 0, 0.7)', borderStyle: 'dashed', backgroundColor: 'rgba(255, 255, 0, 0.2)' },
  boundingBoxFinal: { position: 'absolute', borderWidth: 3, borderColor: 'red', backgroundColor: 'transparent' },
  closeBoxBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: 'red', borderRadius: 10, padding: 4 },
  validateBtn: { marginTop: 20, flexDirection: 'row', backgroundColor: '#4CAF50', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, alignItems: 'center' },


  // Boutons et Inputs communs
  rowButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 30 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6F4FE', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  btnText: { marginLeft: 8, color: '#007AFF', fontWeight: '600' },
  inputContainer: { width: '100%', marginBottom: 30 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 15, fontSize: 16, color: '#000' },
  submitBtn: { flexDirection: 'row', backgroundColor: '#4CAF50', paddingVertical: 16, paddingHorizontal: 30, borderRadius: 30, width: '100%', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  disabledBtn: { backgroundColor: '#A5D6A7' },
});