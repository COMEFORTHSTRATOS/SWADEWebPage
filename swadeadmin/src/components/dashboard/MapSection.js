import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert } from '@mui/material';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { fetchReportsOnly } from '../../services/firebase';

const mapContainerStyle = {
  width: '100%',
  height: '300px'
};

// Simple extraction of coordinates from various formats - same as in ReportCard.js
const extractCoordinates = (location) => {
  if (!location) return null;
  
  // Handle Firebase GeoPoint objects (with _lat and _long properties)
  if (typeof location === 'object' && '_lat' in location && '_long' in location) {
    return { lat: location._lat, lng: location._long };
  }
  
  // Handle Firestore GeoPoint objects that have been converted to JSON
  if (typeof location === 'object' && 'latitude' in location && 'longitude' in location) {
    return { lat: location.latitude, lng: location.longitude };
  }
  
  // Handle raw coordinates array [lat, lng]
  if (Array.isArray(location) && location.length === 2) {
    if (!isNaN(parseFloat(location[0])) && !isNaN(parseFloat(location[1]))) {
      return { lat: parseFloat(location[0]), lng: parseFloat(location[1]) };
    }
  }
  
  // Handle objects with lat/lng properties (non-function)
  if (typeof location === 'object' && 'lat' in location && 'lng' in location && 
      typeof location.lat !== 'function' && typeof location.lng !== 'function') {
    return { lat: parseFloat(location.lat), lng: parseFloat(location.lng) };
  }
  
  // Handle GeoPoint objects with direct lat() and lng() methods
  if (typeof location === 'object' && typeof location.lat === 'function' && typeof location.lng === 'function') {
    return { lat: location.lat(), lng: location.lng() };
  }
  
  // Handle string formatted coordinates "lat,lng"
  if (typeof location === 'string') {
    const parts = location.split(',').map(part => parseFloat(part.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
  }
  
  return null;
};

const MapSection = ({ mapCenter }) => {
  const defaultCenter = mapCenter || { lat: 12.8797, lng: 121.7740 }; // Philippines
  
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  
  // Initialize Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "",
    libraries: ["places"]
  });
  
  // Fetch reports using the same approach as firebase.js fetchReportsOnly
  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      try {
        console.log("[MapSection] Fetching reports using fetchReportsOnly...");
        const { uploads: fetchedUploads, storageError: fetchError } = await fetchReportsOnly();
        
        if (fetchError) {
          console.error("[MapSection] Error fetching reports:", fetchError);
          setError(fetchError);
          return;
        }
        
        console.log(`[MapSection] Fetched ${fetchedUploads.length} reports, processing for map markers...`);
        
        // Process each report to extract location data
        const processedMarkers = [];
        
        fetchedUploads.forEach((report, index) => {
          // Debug location fields - similar to firebase.js approach
          const debugLocationFields = {
            latitude: report.latitude,
            longitude: report.longitude,
            location: report.location,
            Location: report.Location,
            geoLocation: report.geoLocation,
            coordinates: report.coordinates,
            geopoint: report.geopoint
          };
          
          console.log(`[MapSection] Report ${report.id || index} location fields:`, 
            Object.fromEntries(Object.entries(debugLocationFields).filter(([_, v]) => v !== undefined)));
          
          // First try direct latitude/longitude fields (most reliable method)
          if (report.latitude !== undefined && report.longitude !== undefined) {
            const lat = parseFloat(report.latitude);
            const lng = parseFloat(report.longitude);
            
            if (!isNaN(lat) && !isNaN(lng)) {
              console.log(`[MapSection] Using direct lat/lng for report ${report.id || index}:`, lat, lng);
              
              processedMarkers.push({
                id: report.id || `report-${index}`,
                position: { lat, lng },
                title: report.fileName || report.name || "Unknown Location",
                accessible: report.finalVerdict === true || report.FinalVerdict === true,
                report
              });
              return; // Skip other checks after finding valid coordinates
            }
          }
          
          // Then check for compound location fields, using same approach as firebase.js
          const locationValue = report.location || report.Location || report.geoLocation || 
                               report.geopoint || report.coordinates;
          
          if (locationValue) {
            console.log(`[MapSection] Processing location value for report ${report.id || index}:`, locationValue);
            
            // Extract coordinates from complex location object
            const coordinates = extractCoordinates(locationValue);
            
            if (coordinates) {
              console.log(`[MapSection] Successfully extracted coordinates:`, coordinates);
              
              processedMarkers.push({
                id: report.id || `report-${index}`,
                position: coordinates,
                title: report.fileName || report.name || "Unknown Location",
                accessible: report.finalVerdict === true || report.FinalVerdict === true,
                report
              });
            } else {
              console.log(`[MapSection] Failed to extract coordinates from location value`);
            }
          } else {
            console.log(`[MapSection] No location field found for report ${report.id || index}`);
          }
        });
        
        console.log(`[MapSection] Created ${processedMarkers.length} map markers from ${fetchedUploads.length} reports`);
        setMarkers(processedMarkers);
      } catch (err) {
        console.error("[MapSection] Error processing reports for map:", err);
        setError(`Error loading map data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadReports();
  }, []);
  
  if (loadError) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Error loading Google Maps: {loadError.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  if (!isLoaded) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: '#6014cc' }} />
            <Typography variant="body2" sx={{ ml: 2 }}>Loading Google Maps...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }
  
  // Use first marker as center if available
  const center = markers.length > 0 ? markers[0].position : defaultCenter;
  
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">Accessibility Map</Typography>
          <Typography variant="caption" color="text.secondary">
            {markers.length} location{markers.length !== 1 ? 's' : ''} displayed
          </Typography>
        </Box>
        
        {loading ? (
          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={30} sx={{ color: '#6014cc' }} />
            <Typography variant="body2" sx={{ ml: 2 }}>Loading map markers...</Typography>
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={markers.length > 1 ? 5 : 8}
            options={{
              fullscreenControl: false,
              streetViewControl: true,
              mapTypeControl: false,
            }}
            onClick={() => setSelectedMarker(null)}
          >
            {markers.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.position}
                title={marker.title}
                icon={{
                  url: marker.accessible 
                    ? "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    : "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                }}
                onClick={() => setSelectedMarker(marker)}
              />
            ))}
            
            {selectedMarker && (
              <InfoWindow
                position={selectedMarker.position}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <Box sx={{ maxWidth: 200 }}>
                  <Typography variant="subtitle2">{selectedMarker.title}</Typography>
                  <Typography variant="caption" sx={{ 
                    display: 'block', 
                    fontWeight: 'bold',
                    color: selectedMarker.accessible ? '#4CAF50' : '#F44336',
                    mt: 1
                  }}>
                    {selectedMarker.accessible ? 'Accessible' : 'Not Accessible'}
                  </Typography>
                  {selectedMarker.report?.createdAt && selectedMarker.report.createdAt.seconds && (
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      Reported: {new Date(selectedMarker.report.createdAt.seconds * 1000).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
        
        {!loading && markers.length === 0 && !error && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No location data found in reports. Location data may be missing or in an unrecognized format.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default MapSection;