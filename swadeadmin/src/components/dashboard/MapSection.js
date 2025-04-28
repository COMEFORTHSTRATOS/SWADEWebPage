import React, { useState, useEffect, useRef } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert, Button, Switch, FormControlLabel } from '@mui/material';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, HeatmapLayer } from '@react-google-maps/api';

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
      return { lat: parseFloat(location[0]), lng: parseFloat(location[1]) }; // Fixed missing closing parenthesis
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

const MapSection = ({ mapCenter, markers: reportMarkers }) => {
  // Update coordinates to center on Luzon instead of the whole Philippines
  const defaultCenter = mapCenter || { lat: 16.0, lng: 121.0 }; // Luzon, Philippines
  
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [streetViewTarget, setStreetViewTarget] = useState(null);
  const [showMarkers, setShowMarkers] = useState(false); // Changed to control marker visibility instead
  
  const mapRef = useRef(null);
  const streetViewPanoramaRef = useRef(null);
  const mapCardRef = useRef(null); // New ref for the map container element
  
  // Initialize Google Maps with direct API key
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    // API key for school project
    googleMapsApiKey: "AIzaSyCW5rLfv7RldOaQGoEgSbHN8JetgCMVpqI",
    libraries: ["places", "visualization"] // Added visualization library for heatmap
  });
  
  // Convert markers to heatmap data
  const getHeatmapData = () => {
    return markers.map(marker => ({
      location: new window.google.maps.LatLng(marker.position.lat, marker.position.lng),
      weight: marker.accessible ? 5 : 10 // Give non-accessible locations higher weight
    }));
  };
  
  // Function to handle map load and save reference
  const onMapLoad = React.useCallback((map) => {
    mapRef.current = map;
    
    // Create a Street View panorama instance
    streetViewPanoramaRef.current = new window.google.maps.StreetViewService();
    
    // Get the Street View panorama object
    const panorama = map.getStreetView();
    
    // Add listener for when Street View visibility changes
    panorama.addListener('visible_changed', () => {
      // When Street View is closed (visibility becomes false)
      if (!panorama.getVisible()) {
        console.log('Street View closed, returning to Philippines view');
        // Return to the default Philippines view
        map.setCenter(defaultCenter);
        map.setZoom(markers.length > 1 ? 7 : 10);
        // Clear the street view target marker if it exists
        setStreetViewTarget(null);
      }
    });
    
    // Create global function for opening Street View
    window.openStreetView = (lat, lng, title) => {
      if (!mapRef.current) return;
      
      const position = new window.google.maps.LatLng(lat, lng);
      
      // First, pan the map to the location
      mapRef.current.panTo(position);
      mapRef.current.setZoom(18); // Zoom in for street view
      
      // Set a target for street view to find nearby panorama
      setStreetViewTarget({
        position: { lat, lng },
        title: title || 'Location'
      });
      
      // Scroll the map container into view
      if (mapCardRef.current) {
        // Use setTimeout to ensure this happens after state updates and rendering
        setTimeout(() => {
          mapCardRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 100);
      }
      
      // Find the nearest Street View panorama
      streetViewPanoramaRef.current.getPanorama(
        { location: position, radius: 50 },
        (data, status) => {
          if (status === window.google.maps.StreetViewStatus.OK) {
            // If panorama exists, open it
            const panorama = mapRef.current.getStreetView();
            panorama.setPosition(position);
            panorama.setPov({
              heading: 0,
              pitch: 0,
            });
            panorama.setVisible(true);
            
            // Ensure the map is in view after opening Street View
            if (mapCardRef.current) {
              setTimeout(() => {
                mapCardRef.current.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center' 
                });
              }, 300); // Slightly longer delay to ensure Street View is open
            }
          } else {
            // If no Street View available, just show a marker
            console.log('No Street View available for this location');
            // Set the marker as selected to show info window
            const matchingMarker = markers.find(
              marker => 
                Math.abs(marker.position.lat - lat) < 0.0001 && 
                Math.abs(marker.position.lng - lng) < 0.0001
            );
            
            if (matchingMarker) {
              setSelectedMarker(matchingMarker);
            } else {
              // If no matching marker, create a temporary one
              setSelectedMarker({
                id: 'temp-marker',
                position: { lat, lng },
                title: title || 'Location',
                temporary: true
              });
            }
            
            // Ensure the map is still in view
            if (mapCardRef.current) {
              setTimeout(() => {
                mapCardRef.current.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center' 
                });
              }, 100);
            }
          }
        }
      );
    };
  }, [markers, defaultCenter]); // Add defaultCenter to dependencies
  
  // Cleanup function to remove global function when component unmounts
  useEffect(() => {
    return () => {
      delete window.openStreetView;
    };
  }, []);
  
  // Process markers from props instead of fetching reports
  useEffect(() => {
    const processMarkers = async () => {
      setLoading(true);
      try {
        console.log(`[MapSection] Processing ${reportMarkers?.length || 0} reports for map markers...`);
        
        if (!reportMarkers || reportMarkers.length === 0) {
          setMarkers([]);
          return;
        }
        
        // Process each report to extract location data
        const processedMarkers = [];
        
        reportMarkers.forEach((report, index) => {
          // Debug location fields
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
          
          // Then check for compound location fields
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
        
        console.log(`[MapSection] Created ${processedMarkers.length} map markers from ${reportMarkers.length} reports`);
        setMarkers(processedMarkers);
      } catch (err) {
        console.error("[MapSection] Error processing reports for map:", err);
        setError(`Error loading map data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    processMarkers();
  }, [reportMarkers]); // Re-process when reportMarkers change
  
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
  
  // Always use Luzon as center for initial load
  const center = defaultCenter;
  
  // Set a more appropriate initial zoom level for Luzon
  const getInitialZoom = () => {
    if (markers.length === 0) return 7; // Good zoom level for Luzon view
    return markers.length > 1 ? 7 : 10;
  };
  
  return (
    <Card ref={mapCardRef}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            
            {markers.length > 0 && (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={showMarkers}
                    onChange={(e) => setShowMarkers(e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography variant="caption">Show Markers</Typography>}
                sx={{ ml: 2 }}
              />
            )}
          </Box>
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
            zoom={getInitialZoom()}
            options={{
              fullscreenControl: false,
              streetViewControl: true,
              mapTypeControl: false,
            }}
            onClick={() => setSelectedMarker(null)}
            onLoad={onMapLoad}
          >
            {/* Heatmap Layer - always shown when markers exist */}
            {markers.length > 0 && isLoaded && (
              <HeatmapLayer
                data={getHeatmapData()}
                options={{
                  radius: 20,
                  opacity: 0.7,
                  gradient: [
                    'rgba(0, 255, 0, 0)', // transparent
                    'rgba(0, 255, 0, 0.5)', // light green
                    'rgba(0, 255, 0, 0.8)', // medium green
                    'rgba(0, 255, 0, 1)', // bright green
                    'rgba(127, 255, 0, 1)', // yellow-green
                    'rgba(255, 255, 0, 1)', // yellow
                    'rgba(255, 191, 0, 1)', // yellow-orange
                    'rgba(255, 127, 0, 1)', // orange
                    'rgba(255, 63, 0, 1)', // orange-red
                    'rgba(255, 0, 0, 1)' // bright red
                  ]
                }}
              />
            )}
            
            {/* Show markers only when toggle is on */}
            {showMarkers && markers.map((marker) => (
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
            
            {/* Temporary marker for street view target if needed */}
            {streetViewTarget && !markers.some(
              marker => 
                Math.abs(marker.position.lat - streetViewTarget.position.lat) < 0.0001 && 
                Math.abs(marker.position.lng - streetViewTarget.position.lng) < 0.0001
            ) && (
              <Marker
                key="street-view-target"
                position={streetViewTarget.position}
                title={streetViewTarget.title}
                icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                }}
                onClick={() => setSelectedMarker({
                  ...streetViewTarget,
                  id: 'street-view-target'
                })}
              />
            )}
            
            {selectedMarker && (
              <InfoWindow
                position={selectedMarker.position}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <Box sx={{ maxWidth: 200 }}>
                  <Typography variant="subtitle2">{selectedMarker.title}</Typography>
                  {!selectedMarker.temporary && (
                    <>
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
                    </>
                  )}
                  <Button 
                    size="small" 
                    onClick={() => {
                      if (mapRef.current) {
                        const panorama = mapRef.current.getStreetView();
                        panorama.setPosition(selectedMarker.position);
                        panorama.setPov({
                          heading: 0,
                          pitch: 0,
                        });
                        panorama.setVisible(true);
                      }
                    }}
                    sx={{ mt: 1, fontSize: '0.75rem' }}
                  >
                    Street View
                  </Button>
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