import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Chip, LinearProgress, Divider, Card, CircularProgress } from '@mui/material';
import { ArrowUpward, Remove, ArrowDownward, AccessibilityNew, Public, Schedule } from '@mui/icons-material';

const extractCoordinates = (location) => {
  if (!location) return null;
  
  try {
    if (typeof location === 'object' && '_lat' in location && '_long' in location) {
      return validateCoordinates(location._lat, location._long);
    }
    
    if (typeof location === 'object' && 'latitude' in location && 'longitude' in location) {
      return validateCoordinates(location.latitude, location.longitude);
    }
    
    if (Array.isArray(location) && location.length === 2) {
      if (!isNaN(parseFloat(location[0])) && !isNaN(parseFloat(location[1]))) {
        return validateCoordinates(parseFloat(location[0]), parseFloat(location[1]));
      }
    }
    
    if (Array.isArray(location) && location.length === 2) {
      if (!isNaN(parseFloat(location[0])) && !isNaN(parseFloat(location[1]))) {
        if (Math.abs(parseFloat(location[0])) <= 180 && Math.abs(parseFloat(location[1])) <= 90) {
          return validateCoordinates(parseFloat(location[1]), parseFloat(location[0]));
        }
      }
    }
    
    if (typeof location === 'object' && 'lat' in location && 'lng' in location && 
        typeof location.lat !== 'function' && typeof location.lng !== 'function') {
      return validateCoordinates(parseFloat(location.lat), parseFloat(location.lng));
    }
    
    if (typeof location === 'object' && typeof location.lat === 'function' && typeof location.lng === 'function') {
      return validateCoordinates(location.lat(), location.lng());
    }
    
    if (typeof location === 'string') {
      const parts = location.split(',').map(part => parseFloat(part.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return validateCoordinates(parts[0], parts[1]);
      }
      
      const urlParams = new URLSearchParams(location);
      if (urlParams.has('lat') && urlParams.has('lng')) {
        const lat = parseFloat(urlParams.get('lat'));
        const lng = parseFloat(urlParams.get('lng'));
        if (!isNaN(lat) && !isNaN(lng)) {
          return validateCoordinates(lat, lng);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting coordinates:', error);
    return null;
  }
};

const validateCoordinates = (lat, lng) => {
  if (isNaN(lat) || isNaN(lng)) return null;
  
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  
  if (latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
    return { lat: latNum, lng: lngNum };
  }
  
  console.warn('Invalid coordinate values detected:', { lat, lng });
  return null;
};

const geocodeCoordinates = async (coordinates) => {
  if (!coordinates) return null;
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en-US,en' } }
    );
    
    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    return {
      formattedAddress: data.display_name,
      addressComponents: data.address
    };
  } catch (error) {
    console.error('Error geocoding coordinates:', error);
    return null;
  }
};

// Format date to a nicer, more readable format
const formatDate = (date) => {
  if (!date) return '';
  
  try {
    console.log('Formatting date input:', date);
    console.log('Date type:', typeof date);
    if (typeof date === 'object') console.log('Object properties:', Object.keys(date));
    
    let dateObj;
    
    // Handle Firestore Timestamp objects
    if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      console.log('Converting Firestore Timestamp to Date');
      dateObj = date.toDate();
    }
    // Handle raw Firestore timestamp objects (seconds/nanoseconds)
    else if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
      console.log('Converting raw Firestore timestamp to Date');
      dateObj = new Date(date.seconds * 1000 + (date.nanoseconds / 1000000));
    }
    // Handle JavaScript Date objects
    else if (date instanceof Date) {
      dateObj = date;
    }
    // Handle Unix timestamps (numbers)
    else if (typeof date === 'number') {
      dateObj = new Date(date);
    }
    // Handle string dates
    else if (typeof date === 'string') {
      dateObj = new Date(date);
    }
    // Handle other object formats
    else if (typeof date === 'object' && date !== null) {
      if (date._seconds !== undefined && date._nanoseconds !== undefined) {
        // Handle serialized Firestore timestamp
        dateObj = new Date(date._seconds * 1000 + (date._nanoseconds / 1000000));
      } else {
        dateObj = new Date(date);
      }
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date object after conversion:', date);
      return '';
    }
    
    console.log('Converted to Date object:', dateObj);
    
    // Format: "January 15, 2023"
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', date);
    return '';
  }
};

const formatLocation = async (location) => {
  const coordinates = extractCoordinates(location);
  
  if (!coordinates) {
    if (!location) return '';
    
    if (typeof location === 'string') return location;
    
    try {
      return JSON.stringify(location);
    } catch (error) {
      console.error('Error formatting location:', error);
      return '';
    }
  }
  
  const geocodeResult = await geocodeCoordinates(coordinates);
  if (geocodeResult && geocodeResult.formattedAddress) {
    return geocodeResult.formattedAddress;
  }
  
  return `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
};

const PriorityAnalysisSection = ({ reports }) => {
  const [priorityData, setPriorityData] = useState({ counts: [], topItems: [], total: 0, loading: true });
  
  useEffect(() => {
    const analyzeReports = async () => {
      if (!reports || reports.length === 0) {
        setPriorityData({ counts: [], topItems: [], total: 0, loading: false });
        return;
      }
      
      console.log(`Processing ${reports.length} reports for priority analysis`);
      
      const priorityCategories = {
        critical: [],
        high: [],
        medium: [],
        low: []
      };
      
      const criticalLocationKeywords = ['school', 'hospital', 'clinic', 'medical', 'emergency', 'government', 'shelter'];
      const highPriorityKeywords = ['public', 'transport', 'station', 'mall', 'market', 'park', 'library', 'university'];
      const highPriorityDistricts = ['Novaliches', 'Cubao', 'Diliman', 'Commonwealth', 'Makati', 'Taguig', 'Ortigas'];
      
      const criticalIssueTypes = ['wheelchair', 'ramp', 'elevator', 'entrance', 'emergency', 'exit', 'stair'];
      const highIssueTypes = ['signage', 'bathroom', 'parking', 'pathway', 'door'];
      
      const currentDate = new Date();
      
      for (const report of reports) {
        try {
          let priorityScore = 5;
          
          const addressText = report.address || '';
          const locationText = await formatLocation(report.location) || '';
          
          const combinedLocationText = (addressText + " " + locationText).toLowerCase();
          
          if (criticalLocationKeywords.some(keyword => combinedLocationText.includes(keyword.toLowerCase()))) {
            priorityScore += 5;
          }
          
          if (highPriorityKeywords.some(keyword => combinedLocationText.includes(keyword.toLowerCase()))) {
            priorityScore += 3;
          }
          
          if (highPriorityDistricts.some(district => combinedLocationText.includes(district.toLowerCase()))) {
            priorityScore += 2;
          }
          
          if (report.finalVerdict === false) {
            priorityScore += 3;
          }
          
          const reportText = ((report.title || '') + ' ' + (report.description || '')).toLowerCase();
          
          if (criticalIssueTypes.some(type => reportText.includes(type))) {
            priorityScore += 4;
          }
          
          if (highIssueTypes.some(type => reportText.includes(type))) {
            priorityScore += 2;
          }
          
          if (report.accessibilityCriteria && typeof report.accessibilityCriteria === 'object') {
            const criteria = report.accessibilityCriteria;
            
            let criticalFailures = 0;
            let standardFailures = 0;
            
            for (const [key, value] of Object.entries(criteria)) {
              if (value === false) {
                if (['wheelchair', 'mainEntrance', 'emergencyExit', 'elevator'].includes(key)) {
                  criticalFailures++;
                } else {
                  standardFailures++;
                }
              }
            }
            
            priorityScore += (criticalFailures * 2) + standardFailures;
          }
          
          if (report.createdAt) {
            const reportDate = report.createdAt instanceof Date ? 
              report.createdAt : 
              new Date(report.createdAt);
            
            if (!isNaN(reportDate.getTime())) {
              const daysSinceReport = Math.floor((currentDate - reportDate) / (1000 * 60 * 60 * 24));
              
              if (daysSinceReport > 180) priorityScore += 5;
              else if (daysSinceReport > 90) priorityScore += 3;
              else if (daysSinceReport > 30) priorityScore += 1;
            }
          }
          
          if (report.upvotes) priorityScore += Math.min(5, Math.floor(report.upvotes / 5));
          if (report.peopleAffected) priorityScore += Math.min(5, Math.floor(report.peopleAffected / 10));
          
          if (priorityScore >= 15) {
            priorityCategories.critical.push(report);
          } else if (priorityScore >= 10) {
            priorityCategories.high.push(report);
          } else if (priorityScore >= 5) {
            priorityCategories.medium.push(report);
          } else {
            priorityCategories.low.push(report);
          }
        } catch (error) {
          console.error(`Error processing report ${report.id || 'unknown'} for priority:`, error);
        }
      }
      
      const counts = [
        { name: 'Critical Priority', value: priorityCategories.critical.length, color: '#d32f2f' },
        { name: 'High Priority', value: priorityCategories.high.length, color: '#f44336' },
        { name: 'Medium Priority', value: priorityCategories.medium.length, color: '#ff9800' },
        { name: 'Low Priority', value: priorityCategories.low.length, color: '#4caf50' },
      ];
      
      const total = counts.reduce((sum, item) => sum + item.value, 0);
      counts.forEach(item => {
        item.percentage = total > 0 ? (item.value / total) * 100 : 0;
      });
      
      const topPriorityReports = [...priorityCategories.critical, ...priorityCategories.high].slice(0, 3);
      
      const topItems = await Promise.all(topPriorityReports.map(async report => {
        let locationDisplay = '';
        
        if (report.location) {
          const coordinates = extractCoordinates(report.location);
          if (coordinates) {
            const geocodeResult = await geocodeCoordinates(coordinates);
            if (geocodeResult && geocodeResult.formattedAddress) {
              locationDisplay = geocodeResult.formattedAddress;
            } else {
              locationDisplay = `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
            }
          }
        }
        
        if (!locationDisplay && report.address) {
          locationDisplay = report.address;
        }
        
        // Log the raw createdAt value for debugging
        console.log(`Report ${report.id} createdAt:`, report.createdAt);
        
        return {
          id: report.id || 'unknown',
          title: report.title || 'Untitled Report',
          location: locationDisplay || 'Unknown Location',
          priority: priorityCategories.critical.includes(report) ? 'critical' : 'high',
          // Don't convert to Date here, pass the raw value to formatDate
          createdAt: report.createdAt
        };
      }));
      
      setPriorityData({ 
        counts, 
        topItems, 
        total, 
        loading: false,
        factors: {
          location: true,
          criteria: true,
          time: true,
          impact: true
        }
      });
    };
    
    analyzeReports();
  }, [reports]);

  if (priorityData.loading) {
    return (
      <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" gutterBottom>Priority Analysis</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress size={40} />
        </Box>
      </Paper>
    );
  }

  if (!priorityData.counts.length) {
    return (
      <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" gutterBottom>Priority Analysis</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Typography variant="body1" color="text.secondary">No report data available for analysis</Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography variant="h6" gutterBottom>Enhanced Priority Analysis</Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Based on location importance, issue severity, time factors and user impact
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>Issue Priority Distribution</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Total reports analyzed: {priorityData.total}
            </Typography>
            
            {priorityData.counts.map((item) => (
              <Box key={item.name} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        width: 16, 
                        height: 16, 
                        borderRadius: '50%', 
                        bgcolor: item.color,
                        mr: 1
                      }} 
                    />
                    <Typography variant="body2">{item.name}</Typography>
                  </Box>
                  <Typography variant="body2">
                    {item.value} ({item.percentage.toFixed(1)}%)
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={item.percentage} 
                  sx={{ 
                    height: 10,
                    borderRadius: 2,
                    bgcolor: 'rgba(0,0,0,0.1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: item.color
                    }
                  }} 
                />
              </Box>
            ))}
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Priority Factor Analysis:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                <Chip 
                  icon={<Public fontSize="small" />} 
                  label="Location Importance" 
                  size="small" 
                  variant="outlined" 
                />
                <Chip 
                  icon={<AccessibilityNew fontSize="small" />} 
                  label="Issue Severity" 
                  size="small" 
                  variant="outlined" 
                />
                <Chip 
                  icon={<Schedule fontSize="small" />} 
                  label="Time Factor" 
                  size="small" 
                  variant="outlined" 
                />
              </Box>
            </Box>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>Top Priority Issues</Typography>
            
            {priorityData.topItems.length > 0 ? (
              <Box sx={{ mt: 2 }}>
                {priorityData.topItems.map((item, index) => (
                  <Box key={item.id || index} sx={{ 
                    mb: 2, 
                    p: 1.5, 
                    borderRadius: 1, 
                    bgcolor: item.priority === 'critical' ? 'rgba(211, 47, 47, 0.1)' : 'rgba(244, 67, 54, 0.1)'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <ArrowUpward sx={{ 
                        color: item.priority === 'critical' ? '#d32f2f' : '#f44336', 
                        fontSize: 16, 
                        mr: 1 
                      }} />
                      <Typography variant="subtitle2">{item.title}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      <strong>Location:</strong> {item.location}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      <strong>Reported:</strong> {formatDate(item.createdAt)}
                    </Typography>
                    <Chip 
                      size="small" 
                      label={item.priority === 'critical' ? "Critical Priority" : "High Priority"} 
                      sx={{ 
                        mt: 1, 
                        bgcolor: item.priority === 'critical' ? '#d32f2f' : '#f44336', 
                        color: 'white' 
                      }} 
                    />
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No high-priority issues found</Typography>
            )}
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Enhanced Priority Legend:</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ArrowUpward sx={{ color: '#d32f2f', fontSize: 16, mr: 0.5 }} />
                <Typography variant="body2">Critical: Urgent issues at sensitive locations</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ArrowUpward sx={{ color: '#f44336', fontSize: 16, mr: 0.5 }} />
                <Typography variant="body2">High: Significant accessibility barriers</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Remove sx={{ color: '#ff9800', fontSize: 16, mr: 0.5 }} />
                <Typography variant="body2">Medium: Partial accessibility issues</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ArrowDownward sx={{ color: '#4caf50', fontSize: 16, mr: 0.5 }} />
                <Typography variant="body2">Low: Minor or no accessibility issues</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default PriorityAnalysisSection;
