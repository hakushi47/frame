import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { KataTemplate } from '@/src/models/template';
import { addTemplate, IMAGES_DIR, ensureStorageReady } from '@/src/storage/repository';

export default function CreateTemplateScreen() {
  const router = useRouter();
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const autoName = useMemo(() => `型 ${new Date().toLocaleString()}`, []);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('権限エラー', '写真ライブラリへのアクセスを許可してください。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setSelectedUri(result.assets[0].uri);
      if (!name) {
        setName(autoName);
      }
    }
  };

  const saveTemplate = async () => {
    if (!selectedUri) {
      Alert.alert('未選択', '見本画像を選択してください。');
      return;
    }

    await ensureStorageReady();
    const id = `${Date.now()}`;
    const destination = `${IMAGES_DIR}${id}.jpg`;
    await FileSystem.copyAsync({ from: selectedUri, to: destination });

    const template: KataTemplate = {
      id,
      name: name.trim() || autoName,
      referenceImagePath: destination,
      createdAt: new Date().toISOString(),
    };

    await addTemplate(template);
    router.replace(`/template/${template.id}`);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={pickImage} style={styles.pickButton}>
        <Text style={styles.pickButtonText}>写真を選択</Text>
      </Pressable>

      {selectedUri ? <Image source={{ uri: selectedUri }} style={styles.preview} /> : null}

      <Text style={styles.label}>型名</Text>
      <TextInput
        placeholder={autoName}
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <Pressable onPress={saveTemplate} style={styles.saveButton}>
        <Text style={styles.saveButtonText}>保存</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  pickButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  label: {
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
