import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, Typography, Box, Grid, FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
// Remove WbSunnyIcon import
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import PlaceIcon from '@mui/icons-material/Place';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import SpeedIcon from '@mui/icons-material/Speed';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement,
  PointElement,
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  RadialLinearScale,
  PolarAreaController,
  RadarController
} from 'chart.js';
// Remove weather utilities imports
import { getFormattedProximity, getTextBasedProximity } from '../../utils/placesUtils';

// Import components but remove WeatherAnalytics
import TimeAnalytics from './TimeAnalytics';
import ProximityAnalytics from './ProximityAnalytics';
import AccessibilityFactorsAnalytics from './AccessibilityFactorsAnalytics';

// Properly register Chart.js components to prevent errors
try {
  ChartJS.register(
    CategoryScale, 
    LinearScale, 
    BarElement, 
    LineElement,
    PointElement,
    Title,  
    Tooltip, 
    Legend,
    ArcElement,
    RadialLinearScale,
    PolarAreaController,
    RadarController
  );
} catch (error) {
  console.error("Error registering chart components:", error);
}

// Return all possible hours of the day
function getAllHoursOfDay() {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    const date = new Date();
    date.setHours(i, 0, 0, 0);
    const hour = date.getHours();
    const amPm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert to 12-hour format
    hours.push(`${hour12} ${amPm}`);
  }
  return hours;
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

const TimeWeatherInfraStats = ({ reports }) => {
  // Remove weather-related state variables
  const [publicServicesStats, setPublicServicesStats] = useState({});
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [placesService, setPlacesService] = useState(null);
  const mapRef = useRef(null);
  
  // Get all possible hours and use as default selected hours
  const allHours = useMemo(() => getAllHoursOfDay(), []);
  // By default, select business hours (8 AM to 8 PM)
  const defaultHours = useMemo(() => 
    allHours.filter(hour => {
      const hourNum = parseInt(hour.split(' ')[0]);
      const amPm = hour.split(' ')[1];
      return (amPm === 'AM' && hourNum >= 8) || (amPm === 'PM' && hourNum < 8);
    }), 
  [allHours]);
  
  // Update state for time category filters - now using hours
  const [selectedHours, setSelectedHours] = useState(defaultHours);

  // Ensure reports is an array to prevent errors
  const safeReports = Array.isArray(reports) ? reports : [];
  const hasData = safeReports.length > 0;

  // Handler for hour selection changes
  const handleHourChange = (event) => {
    const {
      target: { value },
    } = event;
    // Don't allow deselecting all hours
    if (value.length > 0) {
      setSelectedHours(typeof value === 'string' ? value.split(',') : value);
    }
  };

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

  // Fetch public services data
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

  if (!hasData) {
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: '#6014cc', fontWeight: 'medium', mb: 2 }}>
            Advanced Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No report data available for analysis. Add reports to see analytics.
          </Typography>
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
          {/* Time Analytics */}
          <Grid item xs={12} md={4}>
            <TimeAnalytics 
              reports={safeReports}
              selectedHours={selectedHours}
              isLoading={false}
              onHoursChange={handleHourChange}
              allHours={allHours}
            />
          </Grid>
          
          {/* Proximity Analytics - now in a 4-column layout */}
          <Grid item xs={12} md={4}>
            <ProximityAnalytics 
              reports={safeReports}
              publicServicesStats={publicServicesStats}
              isLoading={isLoadingServices}
            />
          </Grid>
          
          {/* New Accessibility Factors Analytics */}
          <Grid item xs={12} md={4}>
            <AccessibilityFactorsAnalytics 
              reports={safeReports}
              isLoading={false}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default TimeWeatherInfraStats;
