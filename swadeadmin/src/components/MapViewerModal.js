import React, { useRef, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  IconButton, 
  Box,
  Typography,
  Button,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const MapViewerModal = ({ open, handleClose, location, title, address }) => {
  const mapRef = useRef(null);
  const streetViewPanoramaRef = useRef(null);
  
  // Initialize Google Maps with API key - MODIFIED to include the visualization library
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "AIzaSyCW5rLfv7RldOaQGoEgSbHN8JetgCMVpqI",
    libraries: ["places", "visualization"]  // Added "visualization" to match the libraries used in MapSection
  });
  
  // Function to handle map load and save reference
  const onMapLoad = React.useCallback((map) => {
    mapRef.current = map;
    
    // Create a Street View panorama instance
    streetViewPanoramaRef.current = new window.google.maps.StreetViewService();
  }, []);
  
  // Function to open Street View
  const openStreetView = () => {
    if (!mapRef.current || !location) return;
    
    const position = new window.google.maps.LatLng(location.lat, location.lng);
    
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
        } else {
          // If no Street View available, show an alert
          console.log('No Street View available for this location');
          alert('Street View is not available for this location');
        }
      }
    );
  };
  
  if (!location) return null;
  
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title || 'Location View'}</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loadError ? (
          <Box p={2}>
            <Typography color="error">Error loading Google Maps: {loadError.message}</Typography>
          </Box>
        ) : !isLoaded ? (
          <Box p={2} display="flex" justifyContent="center" alignItems="center">
            <CircularProgress size={24} sx={{ mr: 1 }} />
            <Typography>Loading map...</Typography>
          </Box>
        ) : (
          <>
            <Box mb={2}>
              <Typography variant="subtitle1" gutterBottom>
                Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </Typography>
              {address && (
                <Typography variant="body2" color="text.secondary">
                  {address}
                </Typography>
              )}
            </Box>
            
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={location}
              zoom={17}
              options={{
                fullscreenControl: false,
                streetViewControl: true,
                mapTypeControl: true,
              }}
              onLoad={onMapLoad}
            >
              <Marker
                position={location}
                title={title || 'Location'}
              />
            </GoogleMap>
            
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button 
                variant="outlined" 
                sx={{ color: '#6014cc', borderColor: '#6014cc' }}
                onClick={openStreetView}
              >
                Open Street View
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MapViewerModal;
