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

// Create a cache for geocoded addresses
const geocodeCache = {};

// Helper function to reverse geocode coordinates
const reverseGeocode = async (coordinates) => {
  if (!coordinates) return null;
  
  // Create cache key
  const cacheKey = `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`;
  
  // Check if we already have this address cached
  if (geocodeCache[cacheKey]) {
    console.log('Using cached geocode result for:', cacheKey);
    return geocodeCache[cacheKey];
  }
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
    );
    
    if (!response.ok) throw new Error('Geocoding API request failed');
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Get the formatted address from the first result
      const address = data.results[0].formatted_address;
      
      // Cache the result
      geocodeCache[cacheKey] = address;
      
      return address;
    }
    
    return null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
};

/**
 * Fetches location data from reports collection specifically for maps
 * With simplified direct approach and detailed debugging
 * @returns {Promise<Object>} Object containing location markers and any errors
 */
export const fetchLocationMarkers = async () => {
  try {
    console.log('[Storage] Starting to fetch location data from reports for map markers');
    const uploadsCollection = collection(db, 'uploads');
    const uploadsSnapshot = await getDocs(uploadsCollection);
    
    if (uploadsSnapshot.empty) {
      console.log('[Storage] No reports found for location data');
      return { markers: [], error: null };
    }
    
    console.log(`[Storage] Found ${uploadsSnapshot.docs.length} total reports to check for location data`);
    const markers = [];
    let reportWithLocation = 0;
    
    // Process each document with detailed debugging
    for (const doc of uploadsSnapshot.docs) {
      const reportData = doc.data();
      const reportId = doc.id;
      
      console.log(`[Storage] Processing report: ${reportId}`);
      
      // STEP 1: Check basic data
      if (!reportData) {
        console.log(`[Storage] Report ${reportId} has no data`);
        continue;
      }
      
      // STEP 2: Check for direct latitude/longitude fields (most reliable method)
      if (reportData.latitude !== undefined && reportData.longitude !== undefined) {
        console.log(`[Storage] Report ${reportId} has direct lat/lng fields:`, reportData.latitude, reportData.longitude);
        
        try {
          const lat = parseFloat(reportData.latitude);
          const lng = parseFloat(reportData.longitude);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            console.log(`[Storage] Successfully parsed coordinates for ${reportId}:`, lat, lng);
            reportWithLocation++;
            
            markers.push({
              position: { lat, lng },
              title: reportData.fileName || reportData.name || "Location " + reportId,
              id: reportId,
              accessible: reportData.finalVerdict === true || reportData.FinalVerdict === true,
              reportData
            });
            continue; // Move to next report
          } else {
            console.log(`[Storage] Could not parse lat/lng as numbers for ${reportId}`);
          }
        } catch (error) {
          console.error(`[Storage] Error parsing lat/lng for ${reportId}:`, error);
        }
      } else {
        console.log(`[Storage] Report ${reportId} doesn't have direct lat/lng fields`);
      }
      
      // STEP 3: Try to extract from other location fields
      console.log(`[Storage] Checking alternative location fields for ${reportId}`);
      const locationFieldNames = ['location', 'Location', 'geoLocation', 'geopoint', 'coordinates'];
      
      for (const fieldName of locationFieldNames) {
        if (reportData[fieldName]) {
          console.log(`[Storage] Found ${fieldName} field in report ${reportId}:`, reportData[fieldName]);
          
          try {
            // Handle different formats
            let lat, lng;
            
            // Case 1: Object with _lat/_long (Firestore GeoPoint)
            if (typeof reportData[fieldName] === 'object' && 
                '_lat' in reportData[fieldName] && '_long' in reportData[fieldName]) {
              lat = parseFloat(reportData[fieldName]._lat);
              lng = parseFloat(reportData[fieldName]._long);
              console.log(`[Storage] Extracted from _lat/_long:`, lat, lng);
            } 
            // Case 2: Object with latitude/longitude
            else if (typeof reportData[fieldName] === 'object' && 
                     'latitude' in reportData[fieldName] && 'longitude' in reportData[fieldName]) {
              lat = parseFloat(reportData[fieldName].latitude);
              lng = parseFloat(reportData[fieldName].longitude);
              console.log(`[Storage] Extracted from latitude/longitude:`, lat, lng);
            }
            // Case 3: String with "lat,lng" format
            else if (typeof reportData[fieldName] === 'string') {
              const parts = reportData[fieldName].split(',').map(part => parseFloat(part.trim()));
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                lat = parts[0];
                lng = parts[1];
                console.log(`[Storage] Extracted from string format:`, lat, lng);
              }
            }
            
            if (!isNaN(lat) && !isNaN(lng)) {
              reportWithLocation++;
              markers.push({
                position: { lat, lng },
                title: reportData.fileName || reportData.name || "Location " + reportId,
                id: reportId,
                accessible: reportData.finalVerdict === true || reportData.FinalVerdict === true,
                reportData
              });
              break; // Found valid coordinates, move to next report
            }
          } catch (error) {
            console.error(`[Storage] Error processing ${fieldName} for ${reportId}:`, error);
          }
        }
      }
    }
    
    console.log(`[Storage] Generated ${markers.length} location markers from ${reportWithLocation} reports with location data`);
    return { markers, error: null };
  } catch (error) {
    console.error('[Storage] Error fetching location markers:', error);
    return { 
      markers: [], 
      error: `Error fetching location markers: ${error.message}` 
    };
  }
};