import { db, storage } from '../firebase';
import { doc, getDoc, collection, query, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL, listAll } from 'firebase/storage';
import { extractAccessibilityCriteriaValues } from './accessibilityCriteriaUtils';

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

/**
 * Fetches accessibility data from reports collection
 * @returns {Promise<Object>} Object containing accessibility data and any errors
 */
export const fetchAccessibilityData = async () => {
  try {
    console.log('[Storage] Fetching accessibility data from reports');
    const reportsRef = collection(db, 'reports');
    const reportsSnapshot = await getDocs(query(reportsRef));
    
    if (reportsSnapshot.empty) {
      console.log('[Storage] No reports found');
      return { accessibilityData: [], error: null };
    }
    
    const reports = [];
    reportsSnapshot.forEach(doc => {
      const reportData = doc.data();
      reportData.id = doc.id;
      reports.push(reportData);
    });
    
    console.log(`[Storage] Retrieved ${reports.length} reports for accessibility data`);
    
    // Process accessibility criteria from reports
    const processedData = processAccessibilityData(reports);
    
    return { accessibilityData: processedData, error: null };
  } catch (error) {
    console.error('[Storage] Error fetching accessibility data:', error);
    return { 
      accessibilityData: [], 
      error: `Error fetching accessibility data: ${error.message}` 
    };
  }
};

/**
 * Process accessibility data from reports
 * @param {Array} reports - List of report objects
 * @returns {Array} Processed accessibility criteria statistics
 */
export const processAccessibilityData = (reports) => {
  if (!reports || reports.length === 0) return [];
  
  // Initialize counters for each accessibility criterion
  const criteriaCounters = {
    damages: { accessible: 0, notAccessible: 0, notAvailable: 0 },
    obstructions: { accessible: 0, notAccessible: 0, notAvailable: 0 },
    ramps: { accessible: 0, notAccessible: 0, notAvailable: 0 },
    width: { accessible: 0, notAccessible: 0, notAvailable: 0 }
  };
  
  const criteriaTypes = Object.keys(criteriaCounters);
  
  // Process each report
  reports.forEach(report => {
    if (report.accessibilityCriteria) {
      const criteria = extractAccessibilityCriteriaValues(report.accessibilityCriteria);
      
      // Count each criterion status
      criteriaTypes.forEach(type => {
        if (criteria[type] === null || criteria[type] === undefined) {
          criteriaCounters[type].notAvailable++;
        } else if (criteria[type] === true || criteria[type] === 'true' || criteria[type] === 1 || criteria[type] === '1') {
          criteriaCounters[type].accessible++;
        } else {
          criteriaCounters[type].notAccessible++;
        }
      });
    } else {
      // If no accessibility criteria in the report, count as not available
      criteriaTypes.forEach(type => {
        criteriaCounters[type].notAvailable++;
      });
    }
  });
  
  // Transform counters into chart data format
  return criteriaTypes.map(type => {
    const total = criteriaCounters[type].accessible + 
                  criteriaCounters[type].notAccessible + 
                  criteriaCounters[type].notAvailable;
    
    const accessiblePercentage = total > 0 ? 
      ((criteriaCounters[type].accessible / total) * 100).toFixed(1) : 0;
    
    return {
      criterionType: type.charAt(0).toUpperCase() + type.slice(1),
      percentage: accessiblePercentage,
      accessible: criteriaCounters[type].accessible,
      notAccessible: criteriaCounters[type].notAccessible,
      notAvailable: criteriaCounters[type].notAvailable,
      total: total
    };
  });
};

/**
 * Get aggregated accessibility statistics from reports
 * @param {Array} reports - List of report objects 
 * @returns {Object} Accessibility statistics
 */
export const getAccessibilityStatistics = (reports) => {
  if (!reports || reports.length === 0) {
    return {
      totalReports: 0,
      accessiblePercentage: 0,
      criteriaBreakdown: {}
    };
  }
  
  const accessibilityData = processAccessibilityData(reports);
  
  // Calculate overall accessibility percentage
  let totalAccessible = 0;
  let totalCriteria = 0;
  
  accessibilityData.forEach(item => {
    totalAccessible += item.accessible;
    totalCriteria += item.total;
  });
  
  const overallPercentage = totalCriteria > 0 ? 
    ((totalAccessible / totalCriteria) * 100).toFixed(1) : 0;
  
  // Convert array to object for easier access
  const criteriaBreakdown = {};
  accessibilityData.forEach(item => {
    criteriaBreakdown[item.criterionType.toLowerCase()] = {
      percentage: item.percentage,
      accessible: item.accessible,
      notAccessible: item.notAccessible,
      notAvailable: item.notAvailable
    };
  });
  
  return {
    totalReports: reports.length,
    accessiblePercentage: overallPercentage,
    criteriaBreakdown
  };
};