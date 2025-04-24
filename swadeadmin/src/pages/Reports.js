import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, CircularProgress, IconButton, Tooltip,
  FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput, TextField,
  Button, FormGroup, FormControlLabel, Checkbox, Divider
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import { fetchReportsOnly } from '../services/firebase';
import ErrorAlert from '../components/ErrorAlert';
import ReportCard from '../components/ReportCard';
import MapSection from '../components/dashboard/MapSection';
import notificationService from '../services/notificationService';

// Define constants for filter options
const VERDICT_OPTIONS = [
  { value: 'accessible', label: 'Accessible' },
  { value: 'notAccessible', label: 'Not Accessible' }
];

const CONDITIONS_OPTIONS = [
  // Damages options
  { value: 'damages_1', label: 'Damages: Good Condition' },
  { value: 'damages_2', label: 'Damages: Minor Issues' },
  { value: 'damages_3', label: 'Damages: Severe Issues' },
  
  // Obstructions options
  { value: 'obstructions_1', label: 'Obstructions: Clear Path' },
  { value: 'obstructions_2', label: 'Obstructions: Minor' },
  { value: 'obstructions_3', label: 'Obstructions: Major' },
  
  // Ramps options
  { value: 'ramps_1', label: 'Ramps: Good Condition' },
  { value: 'ramps_2', label: 'Ramps: Minor Issues' },
  { value: 'ramps_3', label: 'Ramps: Severe Issues' },
  
  // Width options
  { value: 'width_1', label: 'Width: Standard Compliant' },
  { value: 'width_2', label: 'Width: Non-Compliant' }
];

const Reports = () => {
  const [uploads, setUploads] = useState([]);
  const [filteredUploads, setFilteredUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [verdictFilter, setVerdictFilter] = useState([]);
  const [conditionFilters, setConditionFilters] = useState([]);
  const [dateFilter, setDateFilter] = useState(''); // Simplified to a single date

  const loadReports = async () => {
    setLoading(true);
    try {
      const { uploads: fetchedUploads, storageError: error } = await fetchReportsOnly();
      setUploads(fetchedUploads);
      setFilteredUploads(fetchedUploads);
      setStorageError(error);
    } catch (error) {
      console.error("Error in Reports component:", error);
      setStorageError(`Unexpected error: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
    notificationService.markAsSeen();
  }, []);

  // Apply filters whenever filter criteria change
  useEffect(() => {
    applyFilters();
  }, [uploads, locationFilter, verdictFilter, conditionFilters, dateFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const handleClearFilters = () => {
    setLocationFilter('');
    setVerdictFilter([]);
    setConditionFilters([]);
    setDateFilter(''); // Clear the single date filter
  };

  const applyFilters = () => {
    if (!uploads.length) return;
    
    let filtered = [...uploads];
    
    // IMPROVED location search to handle Firebase GeoPoint
    if (locationFilter && locationFilter.trim() !== '') {
      const searchTerm = locationFilter.toLowerCase().trim();
      console.log("Searching for location term:", searchTerm);
      
      filtered = filtered.filter(item => {
        // Convert the entire item to a searchable string to catch location data anywhere
        let searchableText = '';
        
        try {
          // Convert the entire item to a string for searching, with special handling for GeoPoint
          const stringifyValue = (val) => {
            if (val === null || val === undefined) return '';
            
            // Special handling for Firebase GeoPoint
            if (val && typeof val === 'object') {
              // Check if it's a GeoPoint (has latitude and longitude properties)
              if (val.latitude !== undefined && val.longitude !== undefined) {
                return `${val.latitude} ${val.longitude}`.toLowerCase();
              }
              
              // Regular object handling
              try {
                return JSON.stringify(val).toLowerCase();
              } catch (err) {
                return Object.values(val).join(' ').toLowerCase();
              }
            }
            return String(val).toLowerCase();
          };
          
          // Handle location - check all possible ways it might be stored
          let locationText = '';
          const location = item.location || item.Location || item.geoLocation;
          
          // If we have a location object, extract coordinates
          if (location) {
            if (typeof location === 'object') {
              // Handle GeoPoint
              if (location.latitude !== undefined && location.longitude !== undefined) {
                locationText = `${location.latitude} ${location.longitude}`;
              }
              // Handle location object with coordinates array
              else if (Array.isArray(location.coordinates)) {
                locationText = location.coordinates.join(' ');
              }
              // Handle any other location object
              else {
                locationText = stringifyValue(location);
              }
            } else {
              locationText = String(location).toLowerCase();
            }
          }
          
          // Add all relevant fields to the searchable text
          searchableText = [
            stringifyValue(item.address),
            locationText,
            stringifyValue(item.street),
            stringifyValue(item.city),
            stringifyValue(item.country),
            stringifyValue(item.province),
            stringifyValue(item.district),
            stringifyValue(item.region)
          ].join(' ');
          
          // Add entire item data as fallback
          searchableText += ' ' + stringifyValue(item);
        } catch (error) {
          console.error("Error preparing item for location search:", error);
        }
        
        // For debugging
        const matches = searchableText.includes(searchTerm);
        if (matches && Math.random() < 0.05) {
          console.log(`MATCH: Item ${item.id} contains '${searchTerm}'`, 
            { excerpt: searchableText.substring(0, 100) + '...' });
        }
        
        return searchableText.includes(searchTerm);
      });
    }
    
    // Filter by verdict
    if (verdictFilter.length > 0) {
      console.log("Filtering by verdict:", verdictFilter);
      
      filtered = filtered.filter(item => {
        // Log raw verdict values for debugging
        console.log(`Raw verdict values for item ${item.id}:`, {
          finalVerdict: item.finalVerdict,
          FinalVerdict: item.FinalVerdict,
          verdict: item.verdict,
          Verdict: item.Verdict
        });
        
        // More flexible check for accessibility that handles different data formats
        const isAccessible = 
          item.finalVerdict === true || 
          item.FinalVerdict === true ||
          item.verdict === true || 
          item.Verdict === true ||
          item.finalVerdict === 'true' ||
          item.FinalVerdict === 'true' ||
          item.verdict === 'true' ||
          item.Verdict === 'true' ||
          item.finalVerdict === 1 ||
          item.FinalVerdict === 1 ||
          item.verdict === 1 ||
          item.Verdict === 1;
        
        // Everything that's not explicitly accessible is considered not accessible
        const isNotAccessible = !isAccessible;
        
        console.log(`Item ${item.id || 'unknown'}: isAccessible=${isAccessible}, isNotAccessible=${isNotAccessible}`);
        
        // Only show accessible items when only 'accessible' is selected
        if (verdictFilter.includes('accessible') && !verdictFilter.includes('notAccessible')) {
          return isAccessible;
        }
        
        // Only show non-accessible items when only 'notAccessible' is selected
        if (verdictFilter.includes('notAccessible') && !verdictFilter.includes('accessible')) {
          return isNotAccessible;
        }
        
        // If both are selected, show all items
        if (verdictFilter.includes('accessible') && verdictFilter.includes('notAccessible')) {
          return true;
        }
        
        return false;
      });
    }
    
    // Filter by conditions - Updated to handle multiple selections of the same criterion type
    if (conditionFilters.length > 0) {
      // Group filters by criterion type (e.g., 'damages', 'width')
      const criteriaGroups = {};
      conditionFilters.forEach(filter => {
        const [criterionType, valueStr] = filter.split('_');
        if (!criteriaGroups[criterionType]) {
          criteriaGroups[criterionType] = [];
        }
        criteriaGroups[criterionType].push(parseInt(valueStr, 10));
      });
      
      console.log("Grouped filters:", criteriaGroups);
      
      // Check if there are any contradictory selections (e.g., width_1 and width_2)
      // If a criterion has multiple values selected, we'll enforce strict filtering
      const hasContradictorySelections = Object.values(criteriaGroups).some(values => values.length > 1);
      console.log("Has contradictory selections:", hasContradictorySelections);
      
      filtered = filtered.filter(item => {
        // Check each criterion group (damages, width, etc.)
        return Object.entries(criteriaGroups).every(([criterionType, filterValues]) => {
          // Skip empty filter values
          if (filterValues.length === 0) return true;
          
          // Capitalize first letter to match the structure in the data
          const capitalizedType = criterionType.charAt(0).toUpperCase() + criterionType.slice(1);
          
          // Get the criterion value from the item
          let criterionValue = null;
          if (item.accessibilityCriteria && item.accessibilityCriteria[capitalizedType] !== undefined) {
            criterionValue = parseInt(item.accessibilityCriteria[capitalizedType], 10);
          }
          
          // If still null, try other properties
          if (criterionValue === null) {
            if (item[capitalizedType] !== undefined) {
              criterionValue = parseInt(item[capitalizedType], 10);
            } else if (item[criterionType] !== undefined) {
              criterionValue = parseInt(item[criterionType], 10);
            }
          }
          // For debugging
          console.log(`Item ${item.id}: ${capitalizedType}=${criterionValue}, Checking against values:`, filterValues);
          // If criterion value is not found, this item doesn't match this filter
          if (criterionValue === null || isNaN(criterionValue)) return false;
          
          // If multiple values selected for this criterion (contradictory selections),
          // we should not show any items (no item can be both width_1 and width_2 simultaneously)
          if (filterValues.length > 1) {
            console.log(`Multiple contradictory values for ${criterionType}, filtering out all items`);
            return false;
          }
          // Otherwise, check if the criterion value matches the selected value
          return filterValues.includes(criterionValue);
        });
      });
    }
    
    // IMPROVED date filter to handle Firebase Timestamp
    if (dateFilter && dateFilter.trim() !== '') {
      console.log("Filtering by date:", dateFilter);
      
      filtered = filtered.filter(item => {
        // Handle missing date
        if (!item.createdAt) return false;
        
        try {
          // Parse the filter date string to get year, month, day
          const filterDate = new Date(dateFilter);
          const filterYear = filterDate.getFullYear();
          const filterMonth = filterDate.getMonth();
          const filterDay = filterDate.getDate();
          
          // Handle the item date which might be a Firebase Timestamp
          let itemDate;
          
          // Check if it's a Firebase Timestamp (has toDate method)
          if (item.createdAt && typeof item.createdAt === 'object' && item.createdAt.toDate) {
            itemDate = item.createdAt.toDate();
          } 
          // Handle timestamp as seconds or milliseconds
          else if (typeof item.createdAt === 'number') {
            // If it's seconds (Firestore timestamp), convert to milliseconds
            const timestamp = item.createdAt < 10000000000 
              ? item.createdAt * 1000 // Convert seconds to milliseconds
              : item.createdAt;        // Already milliseconds
            itemDate = new Date(timestamp);
          }
          // Try standard date parsing
          else {
            itemDate = new Date(item.createdAt);
          }
          
          // Compare only year, month, day
          const match = itemDate.getFullYear() === filterYear &&
                         itemDate.getMonth() === filterMonth &&
                         itemDate.getDate() === filterDay;
          
          // Debug logging occasionally
          if (Math.random() < 0.1) {
            console.log(`Date comparison (${match ? 'MATCH' : 'NO MATCH'}):`, {
              itemDate: `${itemDate.getFullYear()}-${itemDate.getMonth()+1}-${itemDate.getDate()}`,
              filterDate: `${filterYear}-${filterMonth+1}-${filterDay}`
            });
          }
          
          return match;
        } catch (error) {
          console.error(`Error comparing dates for item ${item.id}:`, error);
          return false;
        }
      });
    }
    
    setFilteredUploads(filtered);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Map Section in its own container */}
      <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ color: '#6014cc', fontWeight: 600 }}>
            Accessibility Map
          </Typography>
        </Box>
        <MapSection markers={filteredUploads} />
      </Paper>

      {/* Reports Gallery container */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AssessmentIcon sx={{ fontSize: 32, color: '#6014cc', mr: 2 }} />
            <Typography variant="h5" sx={{ color: '#6014cc', fontWeight: 600 }}>
              Reports Gallery
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Filter Reports">
              <IconButton onClick={() => setShowFilters(!showFilters)} sx={{ color: '#6014cc', mr: 1 }}>
                <FilterListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh Reports">
              <IconButton 
                onClick={handleRefresh} 
                sx={{ color: '#6014cc' }} 
                disabled={loading || refreshing}
              >
                <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {loading || refreshing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Filter panel */}
        {showFilters && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Filter Reports</Typography>
              <Button 
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                size="small"
              >
                Clear All
              </Button>
            </Box>
            <Grid container spacing={2}>
              {/* Location filter */}
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="Location Search"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Address, city, or coordinates"
                  variant="outlined"
                  size="small"
                />
              </Grid>
              
              {/* Verdict filter */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Assessment</InputLabel>
                  <Select
                    multiple
                    value={verdictFilter}
                    onChange={(e) => setVerdictFilter(e.target.value)}
                    input={<OutlinedInput label="Verdict" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip 
                            key={value}
                            label={VERDICT_OPTIONS.find(opt => opt.value === value)?.label} 
                            size="small" 
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {VERDICT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Simplified date filter */}
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Filter by Date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Grid>
              
              {/* Conditions filters */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Conditions</Typography>
                <FormGroup row>
                  {CONDITIONS_OPTIONS.map((option) => (
                    <FormControlLabel
                      key={option.value}
                      control={
                        <Checkbox
                          checked={conditionFilters.includes(option.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConditionFilters([...conditionFilters, option.value]);
                            } else {
                              setConditionFilters(conditionFilters.filter(v => v !== option.value));
                            }
                          }}
                          sx={{ mr: 2 }}
                        />
                      }
                      label={option.label}
                    />
                  ))}
                </FormGroup>
              </Grid>
            </Grid>
            
            {/* Results count */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredUploads.length} of {uploads.length} reports
              </Typography>
            </Box>            
          </Paper>
        )}

        <ErrorAlert error={storageError} />
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {/* Loading indicator */}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Reports Gallery */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Reports Gallery
                  </Typography>
                  {filteredUploads.length !== uploads.length && (
                    <Chip
                      label={`Filtered: ${filteredUploads.length} of ${uploads.length}`}
                      size="small"
                    />
                  )}
                </Box>
                
                {filteredUploads.length === 0 && !loading ? (
                  <Typography variant="body1" sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    {uploads.length === 0 ? 
                      'No reports found. Reports will appear here when available.' : 
                      'No reports match your filter criteria. Try adjusting your filters.'}
                  </Typography>
                ) : (
                  <Grid container spacing={3}>
                    {filteredUploads.map((item, index) => (
                      <Grid item xs={12} sm={6} md={4} key={index}>
                        <ReportCard 
                          item={item} 
                          index={index}
                          exportingId={exportingId}
                          setExportingId={setExportingId}
                        />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Reports;