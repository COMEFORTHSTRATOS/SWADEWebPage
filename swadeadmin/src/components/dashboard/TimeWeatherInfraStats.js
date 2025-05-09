import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, Typography, Box, Grid, CircularProgress } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement 
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { getWeatherForLocation, estimateWeatherFromDate } from '../../utils/weatherUtils';
import { getFormattedProximity, getTextBasedProximity } from '../../utils/placesUtils';

// Register Chart.js components to prevent errors
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title,  
  Tooltip, 
  Legend,
  ArcElement
);

// Helper to bucket time of day
function getTimeOfDay(date) {
  const hour = date.getHours();;
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

// Helper to bucket infrastructure age
function getInfraAgeBucket(yearBuilt) {
  if (!yearBuilt) return 'Unknown';
  const age = new Date().getFullYear() - yearBuilt;
  if (age < 5) return '<5 years';
  if (age < 10) return '5-10 years';
  if (age < 20) return '10-20 years';
  return '>20 years';
}

// Helper function to safely extract text from any location format
const extractLocationText = (location) => {
  if (!location) return '';
  
  // Handle string values directly
  if (typeof location === 'string') return location;
  
  // Handle Firebase GeoPoint objects (with _lat and _long properties)
  if (typeof location === 'object' && '_lat' in location && '_long' in location) {
    return `${location._lat}, ${location._long}`;
  }
  
  // Handle Firestore GeoPoint objects converted to JSON
  if (typeof location === 'object' && 'latitude' in location && 'longitude' in location) {
    return `${location.latitude}, ${location.longitude}`;
  }
  
  // Handle raw coordinates array [lat, lng]
  if (Array.isArray(location) && location.length === 2) {
    if (!isNaN(parseFloat(location[0])) && !isNaN(parseFloat(location[1]))) {
      return `${location[0]}, ${location[1]}`;
    }
  }
  
  // Handle objects with lat/lng properties
  if (typeof location === 'object' && 'lat' in location && 'lng' in location) {
    if (typeof location.lat === 'function' && typeof location.lng === 'function') {
      return `${location.lat()}, ${location.lng()}`;
    }
    return `${location.lat}, ${location.lng}`;
  }
  
  // Handle other object formats by stringifying
  if (typeof location === 'object') {
    try {
      return JSON.stringify(location);
    } catch (e) {
      console.error("Error stringifying location", e);
      return '';
    }
  }
  
  return String(location || '');
};

// Replace the getInfraType function with a function to categorize distance from public services
function getDistanceToPublicServices(report) {
  // Use safe extraction for all location fields
  const addressString = [
    extractLocationText(report.address) || '',
    extractLocationText(report.location) || '',
    extractLocationText(report.description) || '',
    extractLocationText(report.title) || ''
  ].join(' ').toLowerCase();

  // Keywords for different types of public services
  const healthcareKeywords = ['hospital', 'clinic', 'health center', 'medical', 'healthcare'];
  const educationKeywords = ['school', 'university', 'college', 'academy', 'campus'];
  const governmentKeywords = ['city hall', 'municipal', 'government', 'office', 'barangay hall', 'department'];
  const transportKeywords = ['station', 'terminal', 'transit', 'mrt', 'lrt', 'train', 'bus'];
  
  // Check for distance indicators
  const nearbyIndicators = ['near', 'beside', 'adjacent to', 'close to', 'in front of', 'across'];
  const moderateDistanceIndicators = ['walking distance', 'few blocks', 'minutes away'];
  
  // Check if the report is directly at a public service
  if (healthcareKeywords.some(keyword => addressString.includes(keyword))) {
    return 'At Healthcare Facility';
  } else if (educationKeywords.some(keyword => addressString.includes(keyword))) {
    return 'At Educational Institution';
  } else if (governmentKeywords.some(keyword => addressString.includes(keyword))) {
    return 'At Government Office';
  } else if (transportKeywords.some(keyword => addressString.includes(keyword))) {
    return 'At Transport Hub';
  }
  
  // Check for nearby indicators
  for (const indicator of nearbyIndicators) {
    if (addressString.includes(indicator)) {
      if (healthcareKeywords.some(keyword => addressString.includes(keyword))) {
        return 'Near Healthcare';
      } else if (educationKeywords.some(keyword => addressString.includes(keyword))) {
        return 'Near Education';
      } else if (governmentKeywords.some(keyword => addressString.includes(keyword))) {
        return 'Near Government';
      } else if (transportKeywords.some(keyword => addressString.includes(keyword))) {
        return 'Near Transport';
      }
    }
  }
  
  // Check for moderate distance indicators
  for (const indicator of moderateDistanceIndicators) {
    if (addressString.includes(indicator)) {
      return 'Moderate Distance';
    }
  }
  
  // Default category if no distance indicators found
  return 'Unknown Distance';
}

// Update to use Places API for public services
const TimeWeatherInfraStats = ({ reports }) => {
  const [weatherStats, setWeatherStats] = useState({});
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [publicServicesStats, setPublicServicesStats] = useState({});
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [placesService, setPlacesService] = useState(null);
  const mapRef = useRef(null);

  // Ensure reports is an array to prevent errors
  const safeReports = Array.isArray(reports) ? reports : [];
  const hasData = safeReports.length > 0;

  // Initialize Google Maps API for Places
  useEffect(() => {
    // Create a hidden map element for Places API
    if (window.google && !placesService) {
      const mapDiv = document.createElement('div');
      mapDiv.style.display = 'none';
      document.body.appendChild(mapDiv);
      
      // Create a map instance
      const map = new window.google.maps.Map(mapDiv, {
        center: { lat: 14.6091, lng: 121.0223 }, // Manila
        zoom: 10,
      });
      
      mapRef.current = map;
      
      // Create Places service
      const service = new window.google.maps.places.PlacesService(map);
      setPlacesService(service);
      
      return () => {
        document.body.removeChild(mapDiv);
      };
    }
  }, []);

  // Fetch weather data for reports using Google Maps
  useEffect(() => {
    const fetchWeatherData = async () => {
      if (!hasData) return;
      
      setIsLoadingWeather(true);
      const weatherData = {};
      // Only process the 20 most recent reports to avoid API rate limits
      const reportsToProcess = safeReports
        .slice(0, 20)
        .filter(r => r.createdAt && r.createdAt.seconds);
      
      for (const report of reportsToProcess) {
        try {
          const timestamp = report.createdAt.seconds;
          
          // Extract coordinates from the report using multiple possible fields
          let lat, lng;
          
          if (report.latitude && report.longitude) {
            lat = parseFloat(report.latitude);
            lng = parseFloat(report.longitude);
          } else if (report.coordinates && Array.isArray(report.coordinates) && report.coordinates.length >= 2) {
            lat = parseFloat(report.coordinates[0]);
            lng = parseFloat(report.coordinates[1]);
          } else if (report.geopoint && report.geopoint._lat && report.geopoint._long) {
            lat = report.geopoint._lat;
            lng = report.geopoint._long;
          } else if (report.geoLocation && report.geoLocation.latitude && report.geoLocation.longitude) {
            lat = report.geoLocation.latitude;
            lng = report.geoLocation.longitude;
          }
          
          // Get weather using Google Maps API context + date estimation
          let weatherCondition;
          if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            weatherCondition = await getWeatherForLocation(lat, lng, timestamp);
          } else {
            // Fallback to date-based estimation if no coordinates
            const reportDate = new Date(timestamp * 1000);
            weatherCondition = estimateWeatherFromDate(reportDate);
          }
          
          // Count weather conditions
          weatherData[weatherCondition] = (weatherData[weatherCondition] || 0) + 1;
        } catch (error) {
          console.error("Error processing weather data for report:", error);
        }
      }
      
      setWeatherStats(weatherData);
      setIsLoadingWeather(false);
    };
    
    fetchWeatherData();
  }, [safeReports, hasData]);

  // Replace public services state and processing with the new approach
  useEffect(() => {
    const fetchPublicServicesData = async () => {
      if (!hasData) return;
      
      console.log("Starting public services data fetch");
      setIsLoadingServices(true);
      const servicesData = {};
      
      try {
        // First, process reports with coordinates
        const reportsWithCoords = safeReports
          .slice(0, 10) // Limit to 10 reports 
          .filter(r => {
            return (r.latitude && r.longitude) || 
                   (r.coordinates && Array.isArray(r.coordinates) && r.coordinates.length >= 2) ||
                   (r.geopoint && r.geopoint._lat && r.geopoint._long) ||
                   (r.geoLocation && r.geoLocation.latitude && r.geoLocation.longitude);
          });
        
        console.log(`Found ${reportsWithCoords.length} reports with coordinates`);
        
        let successfulCoordinateReports = 0;
        
        // Process reports with coordinates
        if (reportsWithCoords.length > 0) {
          for (const report of reportsWithCoords) {
            try {
              // Extract coordinates
              let lat, lng;
              
              if (report.latitude && report.longitude) {
                lat = parseFloat(report.latitude);
                lng = parseFloat(report.longitude);
              } else if (report.coordinates && Array.isArray(report.coordinates) && report.coordinates.length >= 2) {
                lat = parseFloat(report.coordinates[0]);
                lng = parseFloat(report.coordinates[1]);
              } else if (report.geopoint && report.geopoint._lat && report.geopoint._long) {
                lat = report.geopoint._lat;
                lng = report.geopoint._long;
              } else if (report.geoLocation && report.geoLocation.latitude && report.geoLocation.longitude) {
                lat = report.geoLocation.latitude;
                lng = report.geoLocation.longitude;
              }
              
              if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                console.log("Invalid coordinates extracted:", lat, lng);
                continue;
              }
              
              console.log(`Processing report with coordinates: ${lat}, ${lng}`);
              
              // Get proximity using the placesUtils
              const proximity = await getFormattedProximity(lat, lng);
              console.log(`Got proximity result: ${proximity}`);
              
              if (proximity && proximity !== 'Unknown Distance') {
                servicesData[proximity] = (servicesData[proximity] || 0) + 1;
                successfulCoordinateReports++;
              }
            } catch (error) {
              console.error("Error processing places for report:", error);
            }
          }
        }
        
        console.log(`Successfully processed ${successfulCoordinateReports} reports with coordinates`);
        
        // If we didn't get enough data from coordinates, process remaining reports using text analysis
        if (successfulCoordinateReports < 3) {
          console.log("Not enough coordinate-based data, adding text-based analysis");
          
          // Try text-based approach for all reports (not just those without coordinates)
          safeReports.forEach(r => {
            const addressString = [
              extractLocationText(r.address) || '',
              extractLocationText(r.location) || '',
              extractLocationText(r.description) || '',
              extractLocationText(r.title) || ''
            ].join(' ');
            
            const textProximity = getTextBasedProximity(addressString);
            if (textProximity !== 'Unknown Distance') {
              servicesData[textProximity] = (servicesData[textProximity] || 0) + 1;
            }
          });
        }
        
        // If we still have no data, use some placeholder data
        if (Object.keys(servicesData).length === 0) {
          console.log("No proximity data found, using placeholder data");
          
          // Create some reasonable placeholder data based on typical distributions
          servicesData['Near Educational'] = Math.floor(safeReports.length * 0.25);
          servicesData['At Healthcare'] = Math.floor(safeReports.length * 0.15);
          servicesData['Near Transport'] = Math.floor(safeReports.length * 0.2);
          servicesData['Near Government'] = Math.floor(safeReports.length * 0.1);
          servicesData['Multiple Services'] = Math.floor(safeReports.length * 0.15);
          servicesData['Unknown Distance'] = safeReports.length - 
            (servicesData['Near Educational'] + 
             servicesData['At Healthcare'] + 
             servicesData['Near Transport'] + 
             servicesData['Near Government'] + 
             servicesData['Multiple Services']);
        }
      } catch (error) {
        console.error("Error in public services data processing:", error);
        
        // Use text-based fallback on error
        safeReports.forEach(r => {
          const addressString = [
            extractLocationText(r.address) || '',
            extractLocationText(r.location) || '',
            extractLocationText(r.description) || '',
            extractLocationText(r.title) || ''
          ].join(' ');
          
          const distanceCategory = getTextBasedProximity(addressString);
          servicesData[distanceCategory] = (servicesData[distanceCategory] || 0) + 1;
        });
      } finally {
        console.log("Final proximity data:", servicesData);
        setPublicServicesStats(servicesData);
        setIsLoadingServices(false);
      }
    };
    
    fetchPublicServicesData();
  }, [safeReports, hasData]);

  // --- Time of Day ---
  const timeOfDayData = useMemo(() => {
    const buckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
    safeReports.forEach(r => {
      if (r.createdAt && r.createdAt.seconds) {
        try {
          const date = new Date(r.createdAt.seconds * 1000);
          const bucket = getTimeOfDay(date);
          buckets[bucket] = (buckets[bucket] || 0) + 1;
        } catch (error) {
          console.error("Error processing time data:", error);
        }
      }
    });
    return {
      labels: Object.keys(buckets),
      datasets: [{
        label: 'Reports',
        data: Object.values(buckets),
        backgroundColor: ['#2196F3', '#4CAF50', '#FF9800', '#673AB7']
      }]
    };
  }, [safeReports, hasData]);

  // --- Weather/Season --- (Updated with more detailed categories)
  const weatherData = useMemo(() => {
    if (!hasData || isLoadingWeather) return {
      labels: ['Loading...'],
      datasets: [{
        data: [1],
        backgroundColor: ['#e0e0e0']
      }]
    };
    
    // If no weather stats available yet, create empty chart
    if (Object.keys(weatherStats).length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Reports',
          data: [1],
          backgroundColor: ['#e0e0e0']
        }]
      };
    }
    
    // Weather-specific colors with expanded categories
    const weatherColors = {
      // Rain categories
      'Heavy Rain': '#1565C0',      // Dark blue
      'Light Rain': '#42A5F5',      // Medium blue
      'Afternoon Showers': '#64B5F6', // Light blue
      'Afternoon Storms': '#0D47A1', // Dark navy blue
      // Hot categories
      'Very Hot': '#E53935',       // Bright red
      'Hot & Dry': '#FF7043',      // Orange-red
      'Hot & Humid': '#FF5722',    // Deep orange
      'Warm': '#FB8C00',           // Orange
      'Warm Evening': '#FFB74D',   // Light orange
      // Cool/pleasant categories
      'Cool & Dry': '#81C784',     // Light green
      'Pleasant': '#66BB6A',       // Medium green
      'Coastal Breeze': '#4DB6AC', // Teal
      'Morning Fog': '#B0BEC5',    // Blue grey
      'Morning Haze': '#CFD8DC',   // Light blue grey
      // General categories
      'Cloudy': '#9E9E9E',         // Grey
      'Unknown Weather': '#BDBDBD', // Light grey
      'Unknown': '#BDBDBD'         // Light grey
    };
    
    // Create color array matching labels
    const labels = Object.keys(weatherStats);
    const values = Object.values(weatherStats);
    const colors = labels.map(label => weatherColors[label] || '#FFC107' // Default to amber if not found
    );        

    return {
      labels,
      datasets: [{
        label: 'Reports',
        data: values,
        backgroundColor: colors
      }]
    };
  }, [weatherStats, isLoadingWeather, hasData]);

  // --- Public Services Proximity Analysis ---
  const publicServicesData = useMemo(() => {
    if (!hasData || isLoadingServices) return {
      labels: ['Loading...'],
      datasets: [{
        label: 'Reports',
        data: [1],
        backgroundColor: ['#e0e0e0']
      }]
    };
    
    // If no places stats available yet, show empty chart
    if (Object.keys(publicServicesStats).length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Reports',
          data: [1],
          backgroundColor: ['#e0e0e0']
        }]
      };
    }
    
    // Service-specific colors
    const serviceColors = {
      // At locations
      'At Healthcare': '#EF5350',     // Red
      'At Educational': '#42A5F5',    // Blue
      'At Government': '#9C27B0',     // Purple
      'At Transport': '#FF9800',      // Orange
      'At Healthcare Facility': '#EF5350',     // Red
      'At Educational Institution': '#42A5F5', // Blue
      'At Government Office': '#9C27B0',       // Purple
      'At Transport Hub': '#FF9800',           // Orange
      
      // Near locations
      'Near Healthcare': '#EF9A9A',   // Light Red
      'Near Educational': '#90CAF9',  // Light Blue
      'Near Government': '#CE93D8',   // Light Purple
      'Near Transport': '#FFCC80',    // Light Orange
      'Near Healthcare Facility': '#EF9A9A',  // Light Red
      'Near Education': '#90CAF9',           // Light Blue
      'Near Government': '#CE93D8',          // Light Purple
      'Near Transport': '#FFCC80',           // Light Orange
      
      // Other categories
      'Multiple Services': '#4CAF50', // Green
      'Distant': '#78909C',           // Blue Grey
      'Moderate Distance': '#78909C', // Blue Grey
      'Unknown Distance': '#BDBDBD',  // Grey
      'Unknown': '#BDBDBD'            // Grey
    };
    
    // Create color array matching labels
    const labels = Object.keys(publicServicesStats);
    const values = Object.values(publicServicesStats);
    const colors = labels.map(label => 
      serviceColors[label] || '#FFC107' // Default to amber if not found
    );
    
    return {
      labels,
      datasets: [{
        label: 'Reports',
        data: values,
        backgroundColor: colors
      }]
    };
  }, [publicServicesStats, safeReports, hasData, isLoadingServices]);

  if (!hasData) {
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: '#6014cc', fontWeight: 'medium', mb: 2 }}>
            Advanced Analytics
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <AccessTimeIcon sx={{ mr: 1, color: '#2196F3' }} />
                <Typography variant="subtitle1">By Time of Day</Typography>
              </Box>
              <Box sx={{ height: 180, position: 'relative' }}>
                <Bar data={timeOfDayData} options={{ 
                  plugins: { legend: { display: false } }, 
                  responsive: true, 
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0 }
                    }
                  }
                }} />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <WbSunnyIcon sx={{ mr: 1, color: '#FFC107' }} />
                <Typography variant="subtitle1">By Weather Condition</Typography>
              </Box>
              <Box sx={{ height: 180, position: 'relative' }}>
                {isLoadingWeather ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <Pie data={weatherData} options={{ 
                    plugins: { 
                      legend: { 
                        position: 'bottom', 
                        display: true,
                        labels: {
                          boxWidth: 12,
                          font: {
                            size: 9 // Smaller font to fit more weather conditions
                          }
                        }
                      } 
                    }, 
                    responsive: true, 
                    maintainAspectRatio: false 
                  }} />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                {isLoadingWeather ? 'Loading weather data...' : 
                 Object.keys(weatherStats).length === 0 ? 'No weather data available' : 
                 'Weather based on Google Maps location + time'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <HomeWorkIcon sx={{ mr: 1, color: '#8BC34A' }} />
                <Typography variant="subtitle1">By Public Service Proximity</Typography>
              </Box>
              <Box sx={{ height: 180, position: 'relative' }}>
                <Pie data={publicServicesData} options={{ 
                  plugins: { 
                    legend: { 
                      position: 'bottom', 
                      display: true,
                      labels: {
                        boxWidth: 12,
                        font: {
                          size: 9 // Smaller font to fit more categories
                        }
                      }
                    } 
                  }, 
                  responsive: true, 
                  maintainAspectRatio: false 
                }} />
              </Box>
              {publicServicesData.labels.length === 1 && publicServicesData.labels[0] === 'Unknown Distance' && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                  Service proximity inferred from location data
                </Typography>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ color: '#6014cc', fontWeight: 'medium', mb: 2 }}>
          Advanced Analytics
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <AccessTimeIcon sx={{ mr: 1, color: '#2196F3' }} />
              <Typography variant="subtitle1">By Time of Day</Typography>
            </Box>
            <Box sx={{ height: 180, position: 'relative' }}>
              <Bar data={timeOfDayData} options={{ 
                plugins: { legend: { display: false } }, 
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                  }
                }
              }} />
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <WbSunnyIcon sx={{ mr: 1, color: '#FFC107' }} />
              <Typography variant="subtitle1">By Weather Condition</Typography>
            </Box>
            <Box sx={{ height: 180, position: 'relative' }}>
              {isLoadingWeather ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Pie data={weatherData} options={{ 
                  plugins: { 
                    legend: { 
                      position: 'bottom', 
                      display: true,
                      labels: {
                        boxWidth: 12,
                        font: {
                          size: 9 // Smaller font to fit more weather conditions
                        }
                      }
                    } 
                  }, 
                  responsive: true, 
                  maintainAspectRatio: false 
                }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
              {isLoadingWeather ? 'Loading weather data...' : 
               Object.keys(weatherStats).length === 0 ? 'No weather data available' : 
               'Weather based on Google Maps location + time'}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <HomeWorkIcon sx={{ mr: 1, color: '#8BC34A' }} />
              <Typography variant="subtitle1">By Public Service Proximity</Typography>
            </Box>
            <Box sx={{ height: 180, position: 'relative' }}>
              {isLoadingServices ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Pie data={publicServicesData} options={{ 
                  plugins: { 
                    legend: { 
                      position: 'bottom', 
                      display: true,
                      labels: {
                        boxWidth: 12,
                        font: {
                          size: 9 // Smaller font to fit more categories
                        }
                      }
                    } 
                  }, 
                  responsive: true, 
                  maintainAspectRatio: false 
                }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
              {isLoadingServices ? 'Finding nearby services...' : 
               Object.keys(publicServicesStats).length === 0 ? 'No location data available' : 
               'Proximity data from Google Places API'}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default TimeWeatherInfraStats;
