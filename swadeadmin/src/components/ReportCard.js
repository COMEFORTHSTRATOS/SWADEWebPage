import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardActions, 
  CardContent, 
  CardMedia, 
  Button, 
  Typography, 
  Box, 
  CircularProgress,
  Divider,
  Tooltip,
  IconButton,
  Collapse
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ErrorIcon from '@mui/icons-material/Error';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { exportToPDF } from '../services/pdfExport';
import { formatAccessibilityCriteriaWithDescriptions, getCriterionDescription } from '../utils/accessibilityCriteriaUtils';
import AccessibilityDetailsDialog from './AccessibilityDetailsDialog';
import ImageViewerModal from './ImageViewerModal';

// Create a cache for geocoded addresses
const geocodeCache = {};

// Helper function to extract coordinates from any location format
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
    return { lat: location.lat(), lng: location.lng };
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

// Helper function to safely format values for display
const formatValue = (value) => {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }
  
  // Handle boolean values explicitly
  if (typeof value === 'boolean') {
    return value ? 'Accessible' : 'Not Accessible';
  }
  
  // Handle GeoPoint objects (with _lat and _long properties)
  if (value && typeof value === 'object' && '_lat' in value && '_long' in value) {
    return `${value._lat.toFixed(6)}, ${value._long.toFixed(6)}`;
  }
  
  // Handle Date objects
  if (value instanceof Date || (value && typeof value === 'object' && 'toDate' in value)) {
    return value.toDate ? value.toDate().toLocaleString() : value.toString();
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => formatValue(item)).join(', ');
  }
  
  // Handle other objects
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return '[Complex Object]';
    }
  }
  
  // Return primitive values as strings
  return String(value);
};

// Helper function to format location data
const formatLocation = (location) => {
  // Extract coordinates first, which works with any supported format
  const coordinates = extractCoordinates(location);
  
  // If no valid coordinates could be extracted
  if (!coordinates) {
    if (!location) return 'Not Available';
    
    // If it's a string but not coordinates, it might already be an address
    if (typeof location === 'string') return location;
    
    try {
      return JSON.stringify(location);
    } catch (error) {
      console.error('Error formatting location:', error);
      return 'Location format error';
    }
  }
  
  // Return formatted coordinates string 
  return `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
};

// Helper function for simplified accessibility criteria descriptions
const getSimplifiedDescription = (criterionName, value) => {
  // Default to "Not Available" if value is undefined or null
  if (value === undefined || value === null || value === 'Not Available') return "Not Available";
  
  // Convert value to number if it's a string
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  
  // Return appropriate description based on criteria type
  switch (criterionName.toLowerCase()) {
    case 'damages':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Good condition";
        case 2: return "Minor damages";
        case 3: return "Severe damages";
        default: return value;
      }
    case 'obstructions':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Clear path";
        case 2: return "Minor obstructions";
        case 3: return "Major obstructions";
        default: return value;
      }
    case 'ramps':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Good condition";
        case 2: return "Minor issues";
        case 3: return "Severe issues";
        default: return value;
      }
    case 'width':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Standard compliant";
        case 2: return "Non-compliant";
        default: return value;
      }
    default:
      return value;
  }
};

const ReportCard = ({ item, index, exportingId, setExportingId }) => {
  const [address, setAddress] = useState(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  
  const handleExportPDF = async () => {
    setExportingId(index);
    await exportToPDF(item);
    setExportingId(null);
  };

  const handleOpenDetailsDialog = () => {
    setDetailsDialogOpen(true);
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
  };
  
  // Try to detect ramp image using various field names
  const getRampImageUrl = () => {
    // Check all common field patterns for ramp image URLs
    const possibleFields = [
      'rampImageUrl', 'RampImageUrl', 'rampImage', 'RampImage',
      'rampUrl', 'RampUrl', 'secondaryUrl', 'secondaryImageUrl'
    ];
    
    for (const field of possibleFields) {
      if (item[field]) {
        console.log(`Found ramp image URL in field: ${field}`, item[field]);
        return item[field];
      }
    }
    
    // If we're still here, check for common URL patterns in any field
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'string' && 
          (key.toLowerCase().includes('ramp') || key.toLowerCase().includes('secondary')) && 
          (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:'))) {
        console.log(`Found potential ramp image URL in field: ${key}`, value);
        return value;
      }
    }
    
    return null;
  };

  // Get the ramp image URL
  const rampImageUrl = getRampImageUrl();

  // Modified function to open image modal with multiple images
  const handleOpenImageModal = (imageUrl, isRampImage = false) => {
    if (!imageUrl) return;
    
    // Create array of available images
    const imagesArray = [];
    
    // Add main image if available
    if (item.url || item.imageUrl) {
      imagesArray.push({
        url: item.url || item.imageUrl,
        alt: item.name || 'Main Image'
      });
    }
    
    // Add ramp image if available
    if (rampImageUrl) {
      imagesArray.push({
        url: rampImageUrl,
        alt: 'Ramp Image'
      });
    }
    
    // Set initial index based on which image was clicked
    const initialIndex = isRampImage && imagesArray.length > 1 ? 1 : 0;
    
    console.log('Opening image modal with images:', imagesArray);
    
    setSelectedImages(imagesArray);
    setInitialImageIndex(initialIndex);
    setImageModalOpen(true);
  };
  
  const handleCloseImageModal = () => {
    setImageModalOpen(false);
  };

  // Effect to reverse geocode the location when the component mounts
  useEffect(() => {
    const fetchAddress = async () => {
      // Check all possible location field names
      const locationValue = item.location || item.Location || item.geoLocation || 
                           item.geopoint || item.coordinates;
      
      if (!locationValue) return;
      
      // Extract coordinates from the location value
      const coordinates = extractCoordinates(locationValue);
      if (!coordinates) return;
      
      // Set loading state
      setIsLoadingAddress(true);
      
      try {
        // Try to reverse geocode
        const addressResult = await reverseGeocode(coordinates);
        if (addressResult) {
          setAddress(addressResult);
        }
      } catch (error) {
        console.error('Error getting address:', error);
      } finally {
        setIsLoadingAddress(false);
      }
    };
    
    fetchAddress();
  }, [item]);

  React.useEffect(() => {
    if (item) {
      // Log full item data to debug image fields
      console.log(`Item ${index} full data:`, item);
      console.log(`Item ${index} has main image URL:`, item.url || item.imageUrl || 'None');
      console.log(`Item ${index} has ramp image URL:`, rampImageUrl || 'None');
      
      // Log any fields that might contain image paths
      const potentialImageFields = Object.entries(item)
        .filter(([key, value]) => 
          typeof value === 'string' && 
          (key.toLowerCase().includes('path') || 
           key.toLowerCase().includes('image') || 
           key.toLowerCase().includes('url') ||
           key.toLowerCase().includes('ramp')))
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});
      
      if (Object.keys(potentialImageFields).length > 0) {
        console.log(`Item ${index} potential image fields:`, potentialImageFields);
      }
    }
  }, [item, index, rampImageUrl]);

  // List of fields to highlight - remove individual accessibility criteria since we'll handle them separately
  const highlightFields = [
    { key: 'comments', label: 'Comments' },
  ];

  // Get Final Verdict value (checking both possible key naming conventions)
  let finalVerdictValue;
  
  if (item.finalVerdict === false || item.FinalVerdict === false) {
    finalVerdictValue = false;
  } else if (item.finalVerdict === true || item.FinalVerdict === true) {
    finalVerdictValue = true;
  } else if (item.finalVerdict === null || item.FinalVerdict === null) {
    finalVerdictValue = false;
    console.log('Null final verdict treated as false');
  } else {
    finalVerdictValue = item.finalVerdict !== undefined ? item.finalVerdict : 
                       (item.FinalVerdict !== undefined ? item.FinalVerdict : undefined);
  }

  // Get formatted accessibility criteria values with descriptions
  const accessibilityCriteriaValues = formatAccessibilityCriteriaWithDescriptions(item);
  
  // Check if we have any descriptions available
  const hasDescriptions = 
    accessibilityCriteriaValues.damages.description ||
    accessibilityCriteriaValues.obstructions.description ||
    accessibilityCriteriaValues.ramps.description ||
    accessibilityCriteriaValues.width.description;

  return (
    <>
      <Card sx={{ maxWidth: 345, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Main image */}
        {item.url || item.imageUrl ? (
          <CardMedia
            component="img"
            height="200"
            image={item.url || item.imageUrl}
            alt={item.name}
            sx={{ 
              objectFit: 'cover',
              cursor: 'pointer'
            }}
            onClick={() => handleOpenImageModal(item.url || item.imageUrl, false)}
            onError={(e) => {
              console.error(`Error loading image: ${item.url || item.imageUrl}`);
              e.target.onerror = null;
              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjAwIDE1MCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNmMWYxZjEiLz48cGF0aCBkPSJNNzUgNjVIMTI1TTY1IDg1SDEzNU03NSAxMDVIMTI1IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTg1IDYwTDExNSA2MCIgc3Ryb2tlPSIjOTk5IiBzdHJva2Utd2lkd2g9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==';
            }}
          />
        ) : (
          <Box 
            height="200" 
            display="flex" 
            alignItems="center" 
            justifyContent="center" 
            bgcolor="#f5f5f5"
          >
            <ErrorIcon color="error" sx={{ mr: 1 }} />
            <Typography color="error">Image not available</Typography>
          </Box>
        )}
        
        {/* Ramp image (if available) */}
        {rampImageUrl && (
          <Box sx={{ mt: 1, position: 'relative' }}>
            <CardMedia
              component="img"
              height="120"
              image={rampImageUrl}
              alt="Ramp Image"
              sx={{ 
                objectFit: 'cover',
                cursor: 'pointer',
                borderRadius: 1
              }}
              onClick={() => handleOpenImageModal(rampImageUrl, true)}
              onError={(e) => {
                console.error(`Error loading ramp image: ${rampImageUrl}`);
                e.target.onerror = null;
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjAwIDE1MCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNmMWYxZjEiLz48cGF0aCBkPSJNNzUgNjVIMTI1TTY1IDg1SDEzNU03NSAxMDVIMTI1IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTg1IDYwTDExNSA2MCIgc3Ryb2tlPSIjOTk5IiBzdHJva2Utd2lkd2g9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==';
              }}
            />
          </Box>
        )}
        
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography gutterBottom variant="h6" component="div">
            {item.name}
          </Typography>
          
          {/* Enhanced location display with reverse geocoding */}
          {(() => {
            const locationValue = item.location || item.Location || item.geoLocation || 
                                 item.geopoint || item.coordinates;
            
            if (locationValue) {
              return (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <LocationOnIcon sx={{ color: 'primary.main', mr: 0.5, fontSize: '1.2rem', mt: 0.2 }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                      {formatLocation(locationValue)}
                    </Typography>
                    
                    {isLoadingAddress && (
                      <Typography variant="caption" color="text.secondary">
                        Getting address...
                      </Typography>
                    )}
                    
                    {!isLoadingAddress && address && (
                      <Tooltip title="Approximate address based on coordinates">
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {address}
                        </Typography>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              );
            }
            
            return null;
          })()}
          
          {item.imageId && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>Image ID:</strong> {item.imageId}
            </Typography>
          )}
          {item.createdAt && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>Uploaded:</strong> {formatValue(item.createdAt)}
            </Typography>
          )}
          {item.status && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>Status:</strong> {item.status}
            </Typography>
          )}
          {item.uploaderName && item.uploaderName !== 'Unknown User' && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 'medium', color: '#6014cc' }}>
              <strong>Uploaded by:</strong> {item.uploaderName}
            </Typography>
          )}

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
            Report Details
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <strong>Assessment: </strong> {finalVerdictValue === undefined ? 'Not Available' : formatValue(finalVerdictValue)}
          </Typography>
          
          {/* Display accessibility criteria ratings using simplified descriptions */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Damages:</strong> {
                getSimplifiedDescription('damages', accessibilityCriteriaValues.damages.value)
              }
              {accessibilityCriteriaValues.damages.description && (
                <Tooltip title="Click 'View Details' to see description" arrow>
                  <InfoIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle', fontSize: 16, color: '#6014cc' }} />
                </Tooltip>
              )}
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Obstructions:</strong> {
                getSimplifiedDescription('obstructions', accessibilityCriteriaValues.obstructions.value)
              }
              {accessibilityCriteriaValues.obstructions.description && (
                <Tooltip title="Click 'View Details' to see description" arrow>
                  <InfoIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle', fontSize: 16, color: '#6014cc' }} />
                </Tooltip>
              )}
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Ramps:</strong> {
                getSimplifiedDescription('ramps', accessibilityCriteriaValues.ramps.value)
              }
              {accessibilityCriteriaValues.ramps.description && (
                <Tooltip title="Click 'View Details' to see description" arrow>
                  <InfoIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle', fontSize: 16, color: '#6014cc' }} />
                </Tooltip>
              )}
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Width:</strong> {
                getSimplifiedDescription('width', accessibilityCriteriaValues.width.value)
              }
              {accessibilityCriteriaValues.width.description && (
                <Tooltip title="Click 'View Details' to see description" arrow>
                  <InfoIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle', fontSize: 16, color: '#6014cc' }} />
                </Tooltip>
              )}
            </Typography>
            
            {/* View Details Button */}
            {hasDescriptions && (
              <Button 
                size="small"
                sx={{ mt: 1, mb: 0.5, textTransform: 'none', color: '#6014cc' }}
                onClick={handleOpenDetailsDialog}
                startIcon={<VisibilityIcon />}
              >
                View Details
              </Button>
            )}
          </Box>
          
          {highlightFields.map(field => {
            const value = item[field.key] !== undefined ? 
              item[field.key] : 
              (field.altKey ? item[field.altKey] : undefined);
            
            if (value !== undefined && value !== null && (value !== '' || typeof value === 'boolean')) {
              return (
                <Typography key={field.key} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  <strong>{field.label}:</strong> {formatValue(value)}
                </Typography>
              );
            }
            return null;
          })}
          
          {Object.entries(item).map(([key, value]) => {
            const skipFields = [
              'id', 'name', 'path', 'url', 'imageId', 'createdAt', 'location', 'Location', 'geoLocation', 'geopoint', 'coordinates',
              'status', 'userId', 'imageUrl', 'rampImageUrl', 'filepath', 'uploaderName', 'collection', 'hasStorageError',
              'finalVerdict', 'FinalVerdict', 'accessibilityCriteria', 'AccessibilityCriteria',
              ...highlightFields.map(f => f.key),
              ...highlightFields.filter(f => f.altKey).map(f => f.altKey)
            ];
            
            if (skipFields.includes(key) || value === null || value === undefined) {
              return null;
            }
            
            if (value && typeof value === 'object' && ('_lat' in value || '_long' in value)) {
              return null;
            }
            
            return (
              <Typography key={key} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {formatValue(value)}
              </Typography>
            );
          })}
        </CardContent>  
        <CardActions>
          <Button 
            size="small"
            onClick={handleExportPDF}
            disabled={exportingId === index}
            startIcon={exportingId === index ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
            sx={{ color: '#6014cc', ml: 'auto' }}
          >
            {exportingId === index ? 'Exporting...' : 'Export PDF'}
          </Button>
        </CardActions>
      </Card>
      
      {/* Accessibility Details Dialog */}
      <AccessibilityDetailsDialog
        open={detailsDialogOpen}
        handleClose={handleCloseDetailsDialog}
        item={item}
        accessibilityCriteriaValues={accessibilityCriteriaValues}
      />
      
      {/* Updated Image Viewer Modal with image array */}
      <ImageViewerModal
        open={imageModalOpen}
        handleClose={handleCloseImageModal}
        images={selectedImages}
        initialIndex={initialImageIndex}
      />
    </>
  );
};

export default ReportCard;
