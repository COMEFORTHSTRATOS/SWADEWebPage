// Simplified version that works reliably without complex API initialization
const GOOGLE_MAPS_API_KEY = "AIzaSyCW5rLfv7RldOaQGoEgSbHN8JetgCMVpqI";
const CACHE = {}; // Simple in-memory cache

/**
 * Get formatted proximity string - fallback implementation that works without API calls
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude 
 * @returns {Promise<string>} Formatted proximity string
 */
export const getFormattedProximity = async (lat, lng) => {
  console.log("getFormattedProximity called with:", lat, lng);
  
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    console.log("Invalid coordinates - returning Unknown Distance");
    return 'Unknown Distance';
  }
  
  // Create cache key
  const cacheKey = `proximity_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  
  // Check cache first
  if (CACHE[cacheKey]) {
    return CACHE[cacheKey];
  }

  try {
    // Simple distance-based approach instead of relying on Places API
    
    // Define key locations in the Philippines
    const keyLocations = [
      { type: 'Healthcare', name: 'Philippine General Hospital', lat: 14.5800, lng: 120.9822 },
      { type: 'Healthcare', name: 'St. Luke\'s Medical Center', lat: 14.6142, lng: 121.0329 },
      { type: 'Healthcare', name: 'Makati Medical Center', lat: 14.5654, lng: 121.0187 },
      { type: 'Educational', name: 'University of the Philippines', lat: 14.6542, lng: 121.0614 },
      { type: 'Educational', name: 'Ateneo de Manila', lat: 14.6400, lng: 121.0769 },
      { type: 'Educational', name: 'De La Salle University', lat: 14.5649, lng: 120.9937 },
      { type: 'Government', name: 'Malacañang Palace', lat: 14.5971, lng: 120.9954 },
      { type: 'Government', name: 'Quezon City Hall', lat: 14.6504, lng: 121.0500 },
      { type: 'Government', name: 'Manila City Hall', lat: 14.5946, lng: 120.9830 },
      { type: 'Transport', name: 'NAIA Terminal 1', lat: 14.5086, lng: 121.0200 },
      { type: 'Transport', name: 'MRT North Avenue', lat: 14.6525, lng: 121.0298 },
      { type: 'Transport', name: 'LRT Baclaran', lat: 14.5399, lng: 120.9999 }
    ];
    
    // Calculate distances to all key locations
    const distances = keyLocations.map(location => {
      const distance = calculateDistance(lat, lng, location.lat, location.lng);
      return {
        ...location,
        distance: distance
      };
    });
    
    // Sort by distance
    distances.sort((a, b) => a.distance - b.distance);
    
    // Get the closest location
    const closest = distances[0];
    
    // Determine if we're "at" or "near" based on distance
    let proximity;
    if (closest.distance < 0.5) { // Within 500 meters
      proximity = `At ${closest.type}`;
    } else if (closest.distance < 2) { // Within 2 km
      proximity = `Near ${closest.type}`;
    } else {
      // See if there are multiple services within 5 km
      const nearbyServices = distances.filter(loc => loc.distance < 5);
      
      if (nearbyServices.length >= 2) {
        proximity = 'Multiple Services';
      } else {
        proximity = 'Distant';
      }
    }
    
    // Cache the result
    CACHE[cacheKey] = proximity;
    return proximity;
  } catch (error) {
    console.error('Error in getFormattedProximity:', error);
    return 'Unknown Distance';
  }
};

/**
 * Calculate distance between two points in km
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

/**
 * Text-based proximity analysis (no API calls)
 */
export const getTextBasedProximity = (addressString) => {
  if (!addressString) return 'Unknown Distance';
  
  addressString = addressString.toLowerCase();
  
  // Keywords for different types of public services
  const healthcareKeywords = ['hospital', 'clinic', 'health center', 'medical', 'healthcare', 'doctor', 'pharmacy', 'emergency'];
  const educationKeywords = ['school', 'university', 'college', 'academy', 'campus', 'elementary', 'high school', 'kindergarten'];
  const governmentKeywords = ['city hall', 'municipal', 'government', 'office', 'barangay', 'police', 'fire', 'station', 'post'];
  const transportKeywords = ['station', 'terminal', 'mrt', 'lrt', 'train', 'bus', 'airport', 'seaport', 'terminal'];
  
  // Check for "at" indicators
  const atIndicators = ['in front of', 'at the', 'inside', 'within', 'at', 'in the', 'entrance of'];
  let isAt = atIndicators.some(indicator => addressString.includes(indicator));
  
  // Check for "near" indicators
  const nearIndicators = ['near', 'close to', 'beside', 'adjacent', 'across from', 'neighboring', 'nearby'];
  let isNear = !isAt && nearIndicators.some(indicator => addressString.includes(indicator));
  
  // Check for service types with enhanced keyword matching
  if (healthcareKeywords.some(kw => addressString.includes(kw))) {
    return `${isAt ? 'At' : isNear ? 'Near' : 'Unknown'} Healthcare`;
  } else if (educationKeywords.some(kw => addressString.includes(kw))) {
    return `${isAt ? 'At' : isNear ? 'Near' : 'Unknown'} Educational`;
  } else if (governmentKeywords.some(kw => addressString.includes(kw))) {
    return `${isAt ? 'At' : isNear ? 'Near' : 'Unknown'} Government`;
  } else if (transportKeywords.some(kw => addressString.includes(kw))) {
    return `${isAt ? 'At' : isNear ? 'Near' : 'Unknown'} Transport`;
  }
  
  return 'Unknown Distance';
};
