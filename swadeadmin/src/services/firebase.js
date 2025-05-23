import { db, storage } from "../firebase";
import { ref, getDownloadURL, listAll } from "firebase/storage";
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Test storage permissions explicitly
export const testStoragePermissions = async () => {
  try {
    console.log('[Storage] Testing storage permissions...');
    const testRef = ref(storage, 'uploads');
    await listAll(testRef);
    console.log('[Storage] Storage access successful');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Storage] Storage access failed:', error.code, error.message);
    if (error.code === 'storage/unauthorized') {
      return { 
        success: false, 
        error: 'Firebase Storage permissions denied. Please check your Firebase Storage rules.' 
      };
    } else {
      return { 
        success: false, 
        error: `Error accessing Firebase Storage: ${error.message}` 
      };
    }
  }
};

// Recursive function to fetch all items from storage
export const fetchAllItems = async (reference) => {
  const items = [];
  try {
    const result = await listAll(reference);
    
    const filePromises = result.items.map(async (item) => {
      const url = await getDownloadURL(item);
      return {
        url,
        path: item.fullPath,
        name: item.name
      };
    });

    const folderPromises = result.prefixes.map(folderRef => 
      fetchAllItems(folderRef)
    );

    const files = await Promise.all(filePromises);
    const folders = await Promise.all(folderPromises);
    
    items.push(...files);
    folders.forEach(folderItems => items.push(...folderItems));

    return items;
  } catch (error) {
    console.error("Error fetching items:", error);
    return [];
  }
};

// Function to fetch users from Firestore
export const fetchUsers = async () => {
  try {
    console.log('[Firestore] Fetching users collection...');
    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);
    const usersData = {};
    
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      // Store user data with ID as key for easy lookup
      usersData[doc.id] = {
        id: doc.id,
        fullName: userData.fullName || 'Unknown User',
        ...userData
      };
    });
    
    console.log('[Firestore] Found users:', Object.keys(usersData).length);
    return usersData;
  } catch (error) {
    console.error("Error fetching users:", error);
    return {};
  }
};

// Function to fetch uploads
export const fetchUploads = async () => {
  try {
    // Test storage permissions first
    const { success: hasStorageAccess, error: storageError } = await testStoragePermissions();
    
    // Get user data first
    const usersData = await fetchUsers();
    
    // Get Firestore data
    console.log('[Firestore] Fetching uploads collection...');
    const uploadsCollection = collection(db, 'uploads');
    const uploadsSnapshot = await getDocs(uploadsCollection);
    const uploadsData = uploadsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log('[Firestore] Found uploads:', uploadsData);
    
    // Debug: Log field names from first document
    console.log('[Firestore] First upload document fields:', 
      uploadsSnapshot.docs.length > 0 ? Object.keys(uploadsSnapshot.docs[0].data()) : 'No documents');

    // If we have storage access, try to get Storage data
    let storageItems = [];
    if (hasStorageAccess) {
      console.log('[Storage] Fetching uploads folder...');
      const storageRef = ref(storage, 'uploads');
      storageItems = await fetchAllItems(storageRef);
      console.log('[Storage] Found items:', storageItems);
    }

    // If we have no storage items but have Firestore data, create items from Firestore
    if (storageItems.length === 0 && uploadsData.length > 0) {
      console.log('[Fallback] Creating items from Firestore data only');
      return {
        uploads: uploadsData.map(doc => ({
          name: doc.filename || 'Unknown file',
          url: doc.imageUrl || null,
          path: doc.filepath || null,
          hasStorageError: true,
          ...doc,
          createdAt: doc.createdAt || null,
          userId: doc.userId || '',
          uploaderName: usersData[doc.userId]?.fullName || 'Unknown User'
        })),
        storageError
      };
    } else {
      // Regular flow - combine Firestore and Storage data
      const combinedUploads = await Promise.all(storageItems.map(async item => {
        // Enhanced matching logic to find corresponding Firestore document
        const firestoreData = uploadsData.find(doc => 
          doc.filename === item.name || 
          doc.imageUrl === item.url ||
          doc.filepath === item.path ||
          (doc.imageId && doc.imageId.toString() === item.name.split('.')[0])
        );
        
        const userId = firestoreData?.userId || '';
        
        // Get user data from cache or fetch it individually if needed
        let userData = usersData[userId] || null;
        
        // If user not found in bulk fetch but we have a userId, try to fetch individually
        if (userId && !userData) {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              userData = userDoc.data();
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
          }
        }
        
        return {
          ...item,
          ...firestoreData,
          createdAt: firestoreData?.createdAt || null,
          imageId: firestoreData?.imageId || null,
          imageUrl: firestoreData?.imageUrl || item.url,
          location: firestoreData?.location || '',
          status: firestoreData?.status || '',
          userId: userId,
          uploaderName: userData?.fullName || 'Unknown User',
          id: firestoreData?.id || null
        };
      }));

      return { uploads: combinedUploads, storageError };
    }
  } catch (error) {
    console.error("Error fetching uploads:", error);
    return { uploads: [], storageError: `Error fetching uploads: ${error.message}` };
  }
};

// Function to fetch reports only
export const fetchReportsOnly = async () => {
  try {
    // Test storage permissions first
    const { success: hasStorageAccess, error: storageError } = await testStoragePermissions();
    
    // Get user data first
    const usersData = await fetchUsers();
    
    // Get Firestore data from reports collection only
    console.log('[Firestore] Fetching reports collection...');
    const reportsCollection = collection(db, 'reports');
    const reportsSnapshot = await getDocs(reportsCollection);
    const reportsData = reportsSnapshot.docs.map(doc => ({
      id: doc.id,
      collection: 'reports',
      ...doc.data()
    }));
    console.log('[Firestore] Found reports:', reportsData.length);
    
    // Debug: Log field names and location data from first document
    if (reportsSnapshot.docs.length > 0) {
      const firstDoc = reportsSnapshot.docs[0].data();
      console.log('[Firestore] First report document fields:', Object.keys(firstDoc));
      console.log('[Firestore] Location data in first report:', firstDoc.location || firstDoc.Location || 'No location field found');
      console.log('[Firestore] Looking for ramp image fields:', 
        firstDoc.rampImageUrl || 
        firstDoc.RampImageUrl || 
        firstDoc.secondaryUrl || 
        firstDoc.secondaryImageUrl || 
        'No ramp image fields found');
    }

    // If we have storage access, try to get Storage data
    let storageItems = [];
    if (hasStorageAccess) {
      console.log('[Storage] Fetching uploads folder...');
      const storageRef = ref(storage, 'uploads');
      storageItems = await fetchAllItems(storageRef);
      console.log('[Storage] Found items:', storageItems.length);
    }

    // Create items from reports data
    const processedReports = await Promise.all(reportsData.map(async (doc) => {
      // Match with storage item for main image if possible
      const matchingStorageItem = storageItems.find(item => 
        doc.filename === item.name || 
        doc.imageUrl === item.url ||
        doc.filepath === item.path ||
        (doc.imageId && doc.imageId.toString() === item.name?.split('.')[0])
      );

      // Try to find a ramp image in storage
      // Look for a file with 'ramp' in the name related to this document
      const matchingRampItem = storageItems.find(item => {
        // Check if filename contains 'ramp' and has same prefix
        const isRampFile = item.name.toLowerCase().includes('ramp');
        const hasSamePrefix = doc.imageId && item.name.startsWith(doc.imageId.toString());
        
        // Check if it's in a subfolder with this document's ID
        const isInDocSubfolder = item.path.includes(`/${doc.id}/`) || 
                                (doc.userId && item.path.includes(`/${doc.userId}/`));
                              
        // For debugging
        if (isRampFile && (hasSamePrefix || isInDocSubfolder)) {
          console.log(`[Storage] Found potential ramp image for doc ${doc.id}:`, item.path);
        }
        
        return isRampFile && (hasSamePrefix || isInDocSubfolder);
      });

      // Get user info
      const userId = doc.userId || '';
      const userData = usersData[userId] || null;

      // Handle location field (check different possible field names)
      const locationData = doc.location || doc.Location || doc.geoLocation || doc.coordinates || null;
      
      // Look for ramp image URL in document fields
      const docRampImageUrl = doc.rampImageUrl || doc.RampImageUrl || doc.rampImage || 
                              doc.RampImage || doc.rampUrl || doc.RampUrl || 
                              doc.secondaryUrl || doc.secondaryImageUrl;
      
      // Process the report document
      const reportItem = {
        // Base fields
        id: doc.id,
        name: doc.filename || doc.name || 'Report Document',
        
        // Use storage URL if available, otherwise use imageUrl from document
        url: matchingStorageItem?.url || doc.imageUrl || null,
        path: matchingStorageItem?.path || doc.filepath || null,
        
        // Ramp image URL - prioritize document field, then storage match
        rampImageUrl: docRampImageUrl || matchingRampItem?.url || null,
        
        // Other fields
        collection: 'reports',
        createdAt: doc.createdAt || null,
        imageId: doc.imageId || null,
        location: locationData, // Explicitly include location data
        status: doc.status || '',
        userId: userId,
        uploaderName: userData?.fullName || doc.uploaderName || 'Unknown User',
        
        // Handle specific report fields
        accessibilityCriteria: doc.accessibilityCriteria || null,
        damages: doc.Damages || doc.damages || null,
        obstructions: doc.Obstructions || doc.obstructions || null,
        ramps: doc.Ramps || doc.ramps || null,
        width: doc.Width || doc.width || null,
        comments: doc.comments || null,
        invalidRemarks: doc.invalidRemarks || "", // <-- Ensure this field is always present
        finalVerdict: doc.FinalVerdict || doc.finalVerdict || doc.Verdict || doc.verdict || null,
        
        // Explicitly include the report validity status
        isFalseReport: doc.isFalseReport === true,
        markedFalseAt: doc.markedFalseAt || doc.statusChangedAt || null,
        
        // Flag for storage error
        hasStorageError: !hasStorageAccess && doc.imageUrl
      };

      // If we have access but no ramp image URL yet, try to fetch one from storage directly
      if (hasStorageAccess && !reportItem.rampImageUrl && doc.id) {
        try {
          // Try to find a ramp image in common locations
          const potentialRampPaths = [
            `uploads/${doc.id}_ramp.jpg`,
            `uploads/${doc.id}_ramp.png`,
            `uploads/${doc.id}/ramp.jpg`,
            `uploads/${doc.id}/ramp.png`,
            `uploads/ramps/${doc.id}.jpg`,
            `uploads/ramps/${doc.id}.png`
          ];
          
          for (const path of potentialRampPaths) {
            try {
              console.log(`[Storage] Trying potential ramp path: ${path}`);
              const rampRef = ref(storage, path);
              const rampUrl = await getDownloadURL(rampRef);
              if (rampUrl) {
                console.log(`[Storage] Found ramp image at ${path}`);
                reportItem.rampImageUrl = rampUrl;
                break;
              }
            } catch (err) {
              // Silently fail for paths that don't exist
            }
          }
        } catch (error) {
          console.log(`[Storage] Error looking for ramp image for doc ${doc.id}:`, error);
        }
      }

      // If the main image is null but we have a ramp image, swap them
      if (!reportItem.url && reportItem.rampImageUrl) {
        console.log(`[Processing] Document ${doc.id} has no main image but has ramp image. Swapping.`);
        reportItem.url = reportItem.rampImageUrl;
        reportItem.rampImageUrl = null;
      }

      // Debug location data for each document
      console.log(`[Firestore] Report ${doc.id} processed:`, {
        hasMainImage: !!reportItem.url,
        hasRampImage: !!reportItem.rampImageUrl,
        location: locationData
      });

      return reportItem;
    }));

    return { uploads: processedReports, storageError };
  } catch (error) {
    console.error("Error fetching reports:", error);
    return { uploads: [], storageError: `Error fetching reports: ${error.message}` };
  }
};
