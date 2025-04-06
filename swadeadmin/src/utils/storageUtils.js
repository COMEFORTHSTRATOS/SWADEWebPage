import { db, storage } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL, listAll } from 'firebase/storage';

// Fetch all items from a storage reference recursively
export const fetchAllItems = async (reference) => {
  const items = [];
  
  // Safety check for invalid references
  if (!reference) {
    console.error("[Storage] Invalid reference provided to fetchAllItems");
    return [];
  }
  
  try {
    // Validate if the reference exists first
    try {
      const result = await listAll(reference);
      
      const filePromises = result.items.map(async (item) => {
        try {
          const url = await getDownloadURL(item);
          return {
            url,
            path: item.fullPath,
            name: item.name
          };
        } catch (downloadErr) {
          console.log(`[Storage] Error getting download URL for ${item.fullPath}: ${downloadErr.message}`);
          return null;
        }
      }).filter(Boolean); // Remove failed promises
      
      const folderPromises = result.prefixes.map(folderRef => 
        fetchAllItems(folderRef)
      );
      
      const files = await Promise.all(filePromises);
      const validFiles = files.filter(file => file !== null);
      
      items.push(...validFiles);
      const folders = await Promise.all(folderPromises);
      folders.forEach(folderItems => items.push(...folderItems));
      
    } catch (listErr) {
      console.error(`[Storage] Error listing contents: ${listErr.message}`);
      return [];
    }
    
    return items;
  } catch (error) {
    console.error("Error fetching items:", error);
    return [];
  }
};

// Get profile picture URL for a user
export const getProfilePictureUrl = async (userId) => {
  try {
    console.log(`[Storage] Attempting to access profile picture for user ${userId}`);
    
    // First check if user data has a photoURL (from authentication)
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists() && userDoc.data().photoURL) {
      console.log(`[Storage] Using photoURL from user data: ${userDoc.data().photoURL}`);
      return userDoc.data().photoURL;
    }
    
    // Fix: Ensure we're not using a root reference
    if (!userId) {
      console.error('[Storage] Invalid userId provided');
      return null;
    }
    
    // Try using a direct download URL approach with explicit file path
    try {
      // Add file extension to handle common image types
      const directRef = ref(storage, `profilePictures/${userId}/profile.jpg`);
      const url = await getDownloadURL(directRef);
      console.log(`[Storage] Direct download successful for ${userId}`);
      return url;
    } catch (jpgErr) {
      // Try PNG if JPG fails
      try {
        const pngRef = ref(storage, `profilePictures/${userId}/profile.png`);
        const url = await getDownloadURL(pngRef);
        console.log(`[Storage] PNG download successful for ${userId}`);
        return url;
      } catch (pngErr) {
        console.log(`[Storage] Direct download failed for both JPG and PNG: ${pngErr.message}`);
      }
    }
    
    // Fall back to the listing approach but with better error handling
    try {
      const userFolderRef = ref(storage, `profilePictures/${userId}`);
      // Check if the folder exists first
      const items = await fetchAllItems(userFolderRef);
      
      if (items && items.length > 0) {
        const userImage = items[0]; // Use first image found
        console.log(`[Storage] Found user image via listing: ${userImage.path}`);
        return userImage.url;
      } else {
        console.log(`[Storage] No images found for user ${userId} via listing`);
        return null;
      }
    } catch (listErr) {
      console.error(`[Storage] Listing approach failed: ${listErr.message}`);
    }
    
    return null;
  } catch (error) {
    console.error(`[Storage] Error in getProfilePictureUrl for ${userId}:`, error);
    return null;
  }
};