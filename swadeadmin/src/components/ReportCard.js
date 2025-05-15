import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Box, 
  CircularProgress,
  Tooltip,
  IconButton,
  Avatar,
  Typography,
  Checkbox,
  Chip,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ErrorIcon from '@mui/icons-material/Error';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InfoIcon from '@mui/icons-material/Info';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ImageIcon from '@mui/icons-material/Image';
import MapIcon from '@mui/icons-material/Map';
import FlagIcon from '@mui/icons-material/Flag';
import { exportToPDF } from '../services/pdfExport';
import { formatAccessibilityCriteriaWithDescriptions, getCriterionDescription } from '../utils/accessibilityCriteriaUtils';
import AccessibilityDetailsDialog from './AccessibilityDetailsDialog';
import ImageViewerModal from './ImageViewerModal';
import MapViewerModal from './MapViewerModal';
import FalseReportButton from './FalseReportButton';

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

// Function to get ramp image URL
const getRampImageUrl = (item) => {
  // Check all common field patterns for ramp image URLs
  const possibleFields = [
    'rampImageUrl', 'RampImageUrl', 'rampImage', 'RampImage',
    'rampUrl', 'RampUrl', 'secondaryUrl', 'secondaryImageUrl'
  ];
  
  for (const field of possibleFields) {
    if (item[field]) {
      return item[field];
    }
  }
  
  // If we're still here, check for common URL patterns in any field
  for (const [key, value] of Object.entries(item)) {
    if (typeof value === 'string' && 
        (key.toLowerCase().includes('ramp') || key.toLowerCase().includes('secondary')) && 
        (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:'))) {
      return value;
    }
  }
  
  return null;
};

// Function to get a shortened report identifier from the ID
const getShortReportId = (id) => {
  if (!id) return 'Unknown';
  // Get first 4 characters of the report ID with #enmx hashtag
  return "#" + id.toString().substring(0, 4).toUpperCase();
};

// Completely new component: ReportsTable
const ReportsTable = ({ 
  reports, 
  exportingId, 
  setExportingId, 
  onReportStatusChange,
  selectionMode,
  selectedReports,
  onSelect
}) => {
  const [addressCache, setAddressCache] = useState({});
  const [loadingAddresses, setLoadingAddresses] = useState({});
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [menuReport, setMenuReport] = useState(null);

  // Similar to ReportCard's geocoding effect but for all reports
  useEffect(() => {
    const fetchAddresses = async () => {
      const newLoadingState = { ...loadingAddresses };
      
      for (const report of reports) {
        if (addressCache[report.id] || loadingAddresses[report.id]) continue;
        
        const locationValue = report.location || report.Location || report.geoLocation || 
                             report.geopoint || report.coordinates;
        
        if (!locationValue) continue;
        
        const coordinates = extractCoordinates(locationValue);
        if (!coordinates) continue;
        
        newLoadingState[report.id] = true;
      }
      
      setLoadingAddresses(newLoadingState);
      
      for (const report of reports) {
        if (addressCache[report.id] || !newLoadingState[report.id]) continue;
        
        const locationValue = report.location || report.Location || report.geoLocation || 
                             report.geopoint || report.coordinates;
        const coordinates = extractCoordinates(locationValue);
        
        try {
          const address = await reverseGeocode(coordinates);
          if (address) {
            setAddressCache(prev => ({
              ...prev,
              [report.id]: address
            }));
            
            // Report the address back as before
            if (window.updateGeocodedAddress && report.id) {
              window.updateGeocodedAddress(report.id, address);
            }
          }
        } catch (error) {
          console.error('Error getting address:', error);
        } finally {
          setLoadingAddresses(prev => ({
            ...prev,
            [report.id]: false
          }));
        }
      }
    };
    
    fetchAddresses();
  }, [reports]);

  const handleOpenDetailsDialog = (report) => {
    setCurrentReport(report);
    setDetailsDialogOpen(true);
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setCurrentReport(null);
  };

  const handleOpenImageModal = (report, isRampImage = false) => {
    if (!report) return;
    
    // Create array of available images
    const imagesArray = [];
    
    // Add main image if available
    if (report.url || report.imageUrl) {
      imagesArray.push({
        url: report.url || report.imageUrl,
        alt: report.name || 'Main Image'
      });
    }
    
    // Add ramp image if available
    const rampImageUrl = getRampImageUrl(report);
    if (rampImageUrl) {
      imagesArray.push({
        url: rampImageUrl,
        alt: 'Ramp Image'
      });
    }
    
    // Set initial index based on which image was clicked
    const initialIndex = isRampImage && imagesArray.length > 1 ? 1 : 0;
    
    setSelectedImages(imagesArray);
    setInitialImageIndex(initialIndex);
    setImageModalOpen(true);
  };
  
  const handleCloseImageModal = () => {
    setImageModalOpen(false);
  };

  const handleLocationClick = (report) => {
    const locationValue = report.location || report.Location || report.geoLocation || 
                         report.geopoint || report.coordinates;
    
    if (!locationValue) return;
    
    const coordinates = extractCoordinates(locationValue);
    if (!coordinates) return;
    
    setLocationCoordinates(coordinates);
    setMapModalOpen(true);
  };

  const handleExportPDF = async (report, index) => {
    setExportingId(index);
    await exportToPDF(report);
    setExportingId(null);
  };

  const handleReportMarkedFalse = (reportId, status, remarks) => {
    if (onReportStatusChange) {
      onReportStatusChange(reportId, status, remarks);
    }
  };

  const handleActionMenuOpen = (event, report) => {
    setMenuReport(report);
    setActionMenuAnchor(event.currentTarget);
  };
  
  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
  };

  // Get verdict for status chip
  const getVerdictColor = (report) => {
    const finalVerdictValue = 
      report.finalVerdict === true || report.FinalVerdict === true ? true :
      report.finalVerdict === false || report.FinalVerdict === false || 
      report.finalVerdict === null || report.FinalVerdict === null ? false :
      report.finalVerdict !== undefined ? report.finalVerdict : 
      (report.FinalVerdict !== undefined ? report.FinalVerdict : undefined);
    
    if (finalVerdictValue === true) return "success";
    if (finalVerdictValue === false) return "error";
    return "default";
  };

  // Generate criteria display for a specific report
  const renderCriteriaChips = (report) => {
    const accessibilityCriteriaValues = formatAccessibilityCriteriaWithDescriptions(report);
    
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        <Tooltip title={getSimplifiedDescription('damages', accessibilityCriteriaValues.damages.value)}>
          <Chip 
            label={`D: ${getSimplifiedDescription('damages', accessibilityCriteriaValues.damages.value)}`} 
            size="small" 
            variant="outlined" 
            sx={{ height: 20, fontSize: '0.675rem', maxWidth: 110 }} 
          />
        </Tooltip>
        <Tooltip title={getSimplifiedDescription('obstructions', accessibilityCriteriaValues.obstructions.value)}>
          <Chip 
            label={`O: ${getSimplifiedDescription('obstructions', accessibilityCriteriaValues.obstructions.value)}`} 
            size="small" 
            variant="outlined" 
            sx={{ height: 20, fontSize: '0.675rem', maxWidth: 110 }} 
          />
        </Tooltip>
        <Tooltip title={getSimplifiedDescription('ramps', accessibilityCriteriaValues.ramps.value)}>
          <Chip 
            label={`R: ${getSimplifiedDescription('ramps', accessibilityCriteriaValues.ramps.value)}`} 
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.675rem', maxWidth: 110 }}
          />
        </Tooltip>
        <Tooltip title={getSimplifiedDescription('width', accessibilityCriteriaValues.width.value)}>
          <Chip 
            label={`W: ${getSimplifiedDescription('width', accessibilityCriteriaValues.width.value)}`} 
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.675rem', maxWidth: 110 }}
          />
        </Tooltip>
      </Box>
    );
  };

  return (
    <>
      <TableContainer component={Paper} sx={{ 
        boxShadow: 'none',
        border: '1px solid rgba(224, 224, 224, 1)', 
        borderRadius: 1,
        overflow: 'hidden'
      }}>
        <Table size="small" aria-label="reports table" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgba(242, 242, 242, 0.8)' }}>
              {selectionMode && <TableCell padding="checkbox" sx={{ width: 50 }}></TableCell>}
              <TableCell sx={{ width: 80 }}>Image</TableCell>
              <TableCell sx={{ width: 120 }}>Report ID</TableCell>
              <TableCell sx={{ width: 200 }}>Location</TableCell>
              <TableCell sx={{ width: 140 }}>Status</TableCell>
              <TableCell sx={{ width: 250 }}>Criteria</TableCell>
              <TableCell sx={{ width: 130 }}>Date</TableCell>
              <TableCell align="right" sx={{ width: 120 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report, index) => {
              const accessibilityCriteriaValues = formatAccessibilityCriteriaWithDescriptions(report);
              const hasDescriptions = 
                accessibilityCriteriaValues.damages.description ||
                accessibilityCriteriaValues.obstructions.description ||
                accessibilityCriteriaValues.ramps.description ||
                accessibilityCriteriaValues.width.description;
              
              // Get final verdict for status display
              const finalVerdictValue = 
                report.finalVerdict === true || report.FinalVerdict === true ? true :
                report.finalVerdict === false || report.FinalVerdict === false || 
                report.finalVerdict === null || report.FinalVerdict === null ? false :
                report.finalVerdict !== undefined ? report.finalVerdict : 
                (report.FinalVerdict !== undefined ? report.FinalVerdict : undefined);
              
              const rampImageUrl = getRampImageUrl(report);
              
              return (
                <TableRow 
                  key={report.id || index}
                  hover
                  selected={selectedReports && selectedReports.includes(report.id)}
                  sx={{ 
                    '&:last-child td, &:last-child th': { border: 0 },
                    cursor: 'pointer',
                    backgroundColor: report.isFalseReport ? 'rgba(244, 67, 54, 0.04)' : 'inherit',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                    height: 72
                  }}
                >
                  {/* Selection checkbox */}
                  {selectionMode && (
                    <TableCell padding="checkbox" sx={{ 
                      width: 50, 
                      p: 0.5, 
                      verticalAlign: 'middle' 
                    }}>
                      <Checkbox
                        checked={selectedReports && selectedReports.includes(report.id)}
                        onChange={e => onSelect && onSelect(report.id, e.target.checked)}
                        color="primary"
                        sx={{ p: 0.5 }}
                      />
                    </TableCell>
                  )}
                  
                  {/* Image cell */}
                  <TableCell sx={{ p: 1, width: 80, verticalAlign: 'middle' }}>
                    <Box sx={{ display: 'flex', position: 'relative', justifyContent: 'center' }}>
                      <Avatar 
                        variant="rounded" 
                        src={report.url || report.imageUrl} 
                        alt={report.name}
                        sx={{ 
                          width: 56, 
                          height: 56, 
                          cursor: 'pointer',
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                        }}
                        onClick={() => handleOpenImageModal(report)}
                      >
                        <ImageIcon />
                      </Avatar>
                      
                      {/* Small ramp image indicator */}
                      {rampImageUrl && (
                        <Box 
                          component="div" 
                          sx={{
                            position: 'absolute',
                            right: -4,
                            bottom: -4,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            border: '2px solid white',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            bgcolor: 'background.paper',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }}
                          onClick={() => handleOpenImageModal(report, true)}
                        >
                          <Tooltip title="View ramp image">
                            <Box 
                              component="img" 
                              src={rampImageUrl} 
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = '';
                                e.target.parentNode.innerHTML = '+';
                              }}
                            />
                          </Tooltip>
                        </Box>
                      )}
                      
                      {/* Invalid indicator */}
                      {report.isFalseReport && (
                        <Tooltip title="Invalid Report">
                          <ReportProblemIcon 
                            color="error" 
                            sx={{ 
                              position: 'absolute',
                              top: -6,
                              right: -6,
                              fontSize: 16,
                              bgcolor: 'white',
                              borderRadius: '50%',
                              padding: '2px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }} 
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  
                  {/* Report ID cell */}
                  <TableCell sx={{ p: 1, width: 120, verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 600, 
                      fontSize: '0.85rem', 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {getShortReportId(report.id)}
                    </Typography>
                    {report.uploaderName && report.uploaderName !== 'Unknown User' && (
                      <Typography variant="caption" color="text.secondary" 
                        sx={{ 
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {report.uploaderName}
                      </Typography>
                    )}
                  </TableCell>
                  
                  {/* Location cell */}
                  <TableCell sx={{ p: 1, width: 200, verticalAlign: 'middle' }}>
                    <Box 
                      sx={{ 
                        maxWidth: 200, 
                        cursor: 'pointer',
                        '&:hover': { color: 'primary.main' }
                      }} 
                      onClick={() => handleLocationClick(report)}
                    >
                      <Typography 
                        variant="body2" 
                        noWrap
                        sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <LocationOnIcon sx={{ fontSize: 14, mr: 0.5, flexShrink: 0 }} />
                        <span>{formatLocation(report.location || report.Location || report.geoLocation || 
                                 report.geopoint || report.coordinates)}</span>
                      </Typography>
                      {addressCache[report.id] && (
                        <Tooltip title={addressCache[report.id]}>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              display: 'block',
                              pl: 2.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {addressCache[report.id]}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  
                  {/* Status cell */}
                  <TableCell sx={{ p: 1, width: 140, verticalAlign: 'middle' }}>
                    <Chip
                      label={finalVerdictValue === true ? "Accessible" : 
                             finalVerdictValue === false ? "Not Accessible" : 
                             "Not Assessed"}
                      color={getVerdictColor(report)}
                      size="small"
                      sx={{ 
                        fontWeight: 500, 
                        fontSize: '0.75rem',
                        opacity: report.isFalseReport ? 0.7 : 1
                      }}
                    />
                    {report.isFalseReport && (
                      <Typography 
                        variant="caption" 
                        color="error" 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          mt: 0.5
                        }}
                      >
                        <FlagIcon sx={{ fontSize: 12, mr: 0.5, flexShrink: 0 }} />
                        <span>Invalid Report</span>
                      </Typography>
                    )}
                  </TableCell>
                  
                  {/* Criteria cell */}
                  <TableCell sx={{ p: 1, width: 250, verticalAlign: 'middle' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: '100%' }}>
                      {/* Render criteria chips with fixed sizes to prevent layout shifts */}
                      {renderCriteriaChips(report)}
                    </Box>
                  </TableCell>
                  
                  {/* Date cell */}
                  <TableCell sx={{ p: 1, width: 130, verticalAlign: 'middle' }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {formatValue(report.createdAt)}
                    </Typography>
                  </TableCell>
                  
                  {/* Actions cell */}
                  <TableCell align="right" sx={{ p: 1, width: 120, verticalAlign: 'middle' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      {hasDescriptions && (
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDetailsDialog(report)}
                            sx={{ p: 0.5 }}
                          >
                            <InfoIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      <Tooltip title="Export PDF">
                        <IconButton
                          size="small"
                          onClick={() => handleExportPDF(report, index)}
                          disabled={exportingId === index}
                          sx={{ p: 0.5 }}
                        >
                          {exportingId === index ? (
                            <CircularProgress size={18} />
                          ) : (
                            <PictureAsPdfIcon sx={{ fontSize: 18 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="More Actions">
                        <IconButton
                          size="small"
                          onClick={(e) => handleActionMenuOpen(e, report)}
                          sx={{ p: 0.5 }}
                        >
                          <MoreVertIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Action menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
      >
        {menuReport && (
          <>
            <MenuItem onClick={() => {
              handleOpenImageModal(menuReport);
              handleActionMenuClose();
            }}>
              <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
              <ListItemText>View Image</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              handleLocationClick(menuReport);
              handleActionMenuClose();
            }}>
              <ListItemIcon><MapIcon fontSize="small" /></ListItemIcon>
              <ListItemText>View on Map</ListItemText>
            </MenuItem>
            
            <MenuItem>
              <FalseReportButton 
                item={menuReport} 
                collection={menuReport.collection || 'reports'} 
                onSuccess={handleReportMarkedFalse}
                asMenuItem
              />
            </MenuItem>
          </>
        )}
      </Menu>
      
      {/* Reuse the same modals from ReportCard */}
      <AccessibilityDetailsDialog
        open={detailsDialogOpen}
        handleClose={handleCloseDetailsDialog}
        item={currentReport}
        accessibilityCriteriaValues={currentReport ? formatAccessibilityCriteriaWithDescriptions(currentReport) : null}
      />
      
      <ImageViewerModal
        open={imageModalOpen}
        handleClose={handleCloseImageModal}
        images={selectedImages}
        initialIndex={initialImageIndex}
      />
      
      <MapViewerModal
        open={mapModalOpen}
        handleClose={() => setMapModalOpen(false)}
        location={locationCoordinates}
        title={currentReport?.name || 'Location'}
        address={currentReport ? addressCache[currentReport.id] : null}
      />
    </>
  );
};

// We'll keep the name as ReportCard for backward compatibility
// but it now renders a table instead
const ReportCard = (props) => {
  // Just pass through to the table component with the appropriate structure
  return <ReportsTable reports={[props.item]} {...props} />;
};

// Export the table component for Reports.js to use
export { ReportsTable };

export default ReportCard;
