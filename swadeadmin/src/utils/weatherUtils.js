// Use existing Google Maps API key from the project
// This is the key I see used in your MapSection.js
const GOOGLE_MAPS_API_KEY = "AIzaSyCW5rLfv7RldOaQGoEgSbHN8JetgCMVpqI";
const CACHE = {}; // Simple in-memory cache

/**
 * Get weather for a location by reverse geocoding + time estimation
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {Promise<string>} Weather condition
 */
export const getWeatherForLocation = async (lat, lng, timestamp) => {
  if (!lat || !lng) {
    return estimateWeatherFromDate(new Date(timestamp * 1000));
  }
  
  // Create cache key
  const cacheKey = `${lat.toFixed(2)}_${lng.toFixed(2)}_${timestamp}`;
  
  // Check cache first
  if (CACHE[cacheKey]) {
    return CACHE[cacheKey];
  }
  
  try {
    // Use Google Maps Geocoding API to get location context
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&result_type=locality`
    );
    
    if (!response.ok) {
      throw new Error(`Google Maps API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract location name
    let locationName = null;
    if (data.results && data.results.length > 0) {
      // Get locality name
      const locality = data.results[0];
      locationName = locality.formatted_address;
    }
    
    // If we got a location name, we combine it with timestamp
    // to make a better weather estimate
    if (locationName) {
      // Determine if coastal or inland
      const isCoastal = locationName.toLowerCase().includes("bay") || 
                      locationName.toLowerCase().includes("beach") || 
                      locationName.toLowerCase().includes("coast") ||
                      locationName.toLowerCase().includes("sea");
      
      const date = new Date(timestamp * 1000);
      const weatherCondition = estimateWeatherByLocationAndDate(date, isCoastal);
      
      // Cache the result
      CACHE[cacheKey] = weatherCondition;
      return weatherCondition;
    }
    
    // Fallback to date-based estimation
    const weatherCondition = estimateWeatherFromDate(new Date(timestamp * 1000));
    CACHE[cacheKey] = weatherCondition;
    return weatherCondition;
  } catch (error) {
    console.error("Error getting location weather:", error);
    // Fallback to date-based estimation
    return estimateWeatherFromDate(new Date(timestamp * 1000));
  }
};

/**
 * Estimate weather based on location and date
 */
function estimateWeatherByLocationAndDate(date, isCoastal) {
  const month = date.getMonth(); // 0-11 (Jan-Dec)
  const hour = date.getHours(); // 0-23
  
  // Philippines has a tropical climate with monsoon seasons
  
  // Coastal areas have different weather patterns than inland
  if (isCoastal) {
    // Coastal weather patterns
    if (month >= 6 && month <= 9) { // July-October: Peak of typhoon season
      return 'Heavy Rain';
    } else if ((month >= 5 && month <= 5) || (month >= 10 && month <= 11)) { // May-June, November-December: Wet transition
      return hour >= 13 && hour <= 17 ? 'Afternoon Showers' : 'Light Rain';
    } else if (month >= 2 && month <= 4) { // March-May: Hot season
      return hour >= 10 && hour <= 16 ? 'Hot & Humid' : 'Warm';
    } else { // December-February: Cool dry season
      return 'Coastal Breeze';
    }
  } else {
    // Inland weather patterns
    if (month >= 6 && month <= 8) { // July-September: Peak of rainy season
      return 'Heavy Rain';
    } else if ((month === 5) || (month >= 9 && month <= 10)) { // June, October-November: Transitional
      return hour >= 14 && hour <= 18 ? 'Afternoon Storms' : 'Light Rain';
    } else if (month >= 2 && month <= 4) { // March-May: Hot dry season
      return hour >= 11 && hour <= 15 ? 'Very Hot' : 'Hot & Dry';
    } else { // December-February: Cool dry season
      return hour >= 5 && hour <= 8 ? 'Morning Fog' : 'Cool & Dry';
    }
  }
}

/**
 * Fallback method to estimate weather from date when API is unavailable
 */
export const estimateWeatherFromDate = (date) => {
  const month = date.getMonth();
  const hour = date.getHours();
  
  // More detailed Philippine weather patterns by month and time of day
  if (month >= 6 && month <= 8) { // July-September: Typhoon season
    if (hour >= 12 && hour <= 17) {
      return 'Heavy Rain';
    } else {
      return 'Cloudy';
    }
  } else if ((month === 5) || (month >= 9 && month <= 10)) { // Transitional
    if (hour >= 14 && hour <= 18) {
      return 'Afternoon Showers';
    } else if (hour >= 6 && hour <= 10) {
      return 'Morning Haze';
    } else {
      return 'Light Rain';
    }
  } else if (month >= 2 && month <= 4) { // Hot season
    if (hour >= 10 && hour <= 16) {
      return 'Very Hot';
    } else if (hour >= 17 && hour <= 19) {
      return 'Warm Evening';
    } else {
      return 'Hot & Dry';
    }
  } else { // Cool dry season
    if (hour >= 5 && hour <= 8) {
      return 'Morning Fog';
    } else if (hour >= 10 && hour <= 16) {
      return 'Pleasant';
    } else {
      return 'Cool & Dry';
    }
  }
};
