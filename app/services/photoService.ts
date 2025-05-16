import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

export async function pickImage(): Promise<ImagePicker.ImagePickerResult> {
  // Request permission
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (status !== 'granted') {
    throw new Error('Permission to access media library was denied');
  }

  // Launch image picker
  return await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7, // Compress the image
  });
}

export async function uploadPhoto(uri: string, sightingId: string): Promise<string> {
  try {
    // Get the file extension
    const extension = uri.split('.').pop();
    const filename = `${sightingId}.${extension}`;
    
    // Create a reference to the file location in Firebase Storage
    const storage = getStorage();
    const storageRef = ref(storage, `sightings/${filename}`);

    // Convert URI to blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload the file
    await uploadBytes(storageRef, blob);

    // Get the download URL
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
} 