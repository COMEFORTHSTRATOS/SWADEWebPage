import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, CircularProgress, IconButton, Tooltip,
  FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput, TextField,
  Button, FormGroup, FormControlLabel, Checkbox, Divider,
  Tabs, Tab, Badge, Pagination
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlagIcon from '@mui/icons-material/Flag';
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

// Tab enum for better readability
const TabOptions = {
  ALL: 0,
  VALID: 1,
  INVALID: 2
};

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

  // Add a state to store geocoded addresses from ReportCard components
  const [geocodedAddresses, setGeocodedAddresses] = useState({});
  
  // Add state for controlling search behavior
  const [searchMode, setSearchMode] = useState(false);
  const [locationSearchResults, setLocationSearchResults] = useState([]);
  
  // Add state for tab selection
  const [currentTab, setCurrentTab] = useState(TabOptions.ALL);
  const [invalidReportsCount, setInvalidReportsCount] = useState(0);
  const [validReportsCount, setValidReportsCount] = useState(0);
  
  // Add pagination state
  const [page, setPage] = useState(1);
  const [reportsPerPage, setReportsPerPage] = useState(10);
  
  // Helper function to extract date for sorting regardless of format
  const extractDateForSorting = (item) => {
    if (!item.createdAt) return 0; // Items without dates go last
    
    try {
      // Handle Firebase Timestamp (has toDate method)
      if (typeof item.createdAt === 'object' && item.createdAt.toDate) {
        return item.createdAt.toDate().getTime();
      } 
      // Handle timestamp as seconds or milliseconds
      else if (typeof item.createdAt === 'number') {
        // If it's seconds (Firestore timestamp), convert to milliseconds
        return item.createdAt < 10000000000 
          ? item.createdAt * 1000 // Convert seconds to milliseconds
          : item.createdAt;        // Already milliseconds
      }
      // Try standard date parsing
      return new Date(item.createdAt).getTime();
    } catch (error) {
      console.error(`Error extracting date for sorting from item:`, error);
      return 0; // Default to oldest (will appear last)
    }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const { uploads: fetchedUploads, storageError: error } = await fetchReportsOnly();
      
      // Sort uploads by creation date (newest first)
      const sortedUploads = [...fetchedUploads].sort((a, b) => {
        return extractDateForSorting(b) - extractDateForSorting(a);
      });
      
      // Count valid and invalid reports
      const invalidCount = sortedUploads.filter(item => item.isFalseReport === true).length;
      const validCount = sortedUploads.length - invalidCount;
      
      setInvalidReportsCount(invalidCount);
      setValidReportsCount(validCount);
      setUploads(sortedUploads);
      setFilteredUploads(sortedUploads);
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

  // Apply filters whenever filter criteria or tab changes
  useEffect(() => {
    applyFilters();
  }, [uploads, locationFilter, verdictFilter, conditionFilters, dateFilter, geocodedAddresses, currentTab]);

  // Add effect to collect addresses from ReportCard components
  useEffect(() => {
    // Create a callback function that ReportCard components can use
    window.updateGeocodedAddress = (itemId, address) => {
      if (itemId && address) {
        console.log(`Collected address for item ${itemId}:`, address);
        setGeocodedAddresses(prev => ({
          ...prev,
          [itemId]: address
        }));
      }
    };
    
    // Cleanup function
    return () => {
      window.updateGeocodedAddress = undefined;
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  // Add handler for tab change
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // Handler when a report is marked as invalid or valid
  const handleReportStatusChange = (reportId, status) => {
    console.log(`Report ${reportId} status changed to: ${status}`);
    
    // Update the local state to reflect the change
    const updatedUploads = uploads.map(item => {
      if (item.id === reportId) {
        return {
          ...item,
          isFalseReport: status === 'invalid',
          status: status === 'invalid' ? 'rejected' : 'approved'
        };
      }
      return item;
    });
    
    // Recalculate counts
    const invalidCount = updatedUploads.filter(item => item.isFalseReport === true).length;
    const validCount = updatedUploads.length - invalidCount;
    
    setInvalidReportsCount(invalidCount);
    setValidReportsCount(validCount);
    setUploads(updatedUploads);
    
    // Always switch to the appropriate tab when status changes
    if (status === 'valid' || status === 'invalid') {
      // Switch to the Valid tab when marking as valid, or Invalid tab when marking as invalid
      const newTab = status === 'valid' ? TabOptions.VALID : TabOptions.INVALID;
      
      console.log(`Switching to ${status === 'valid' ? 'Valid' : 'Invalid'} tab`);
      
      // Use timeout to avoid UI jumps during state updates
      setTimeout(() => {
        setCurrentTab(newTab);
      }, 300);
    }
    
    // Re-apply filters to update the UI
    applyFilters();
  };

  const applyFilters = () => {
    if (!uploads.length) return;
    
    let filtered = [...uploads]; // Already sorted by date in loadReports
    
    // First, apply tab filtering
    if (currentTab === TabOptions.VALID) {
      filtered = filtered.filter(item => item.isFalseReport !== true);
    } else if (currentTab === TabOptions.INVALID) {
      filtered = filtered.filter(item => item.isFalseReport === true);
    }
    
    let useLocationSearch = locationFilter && locationFilter.trim() !== '';
    
    // Apply other filters (verdict, conditions, date) but NOT location
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
    
    // Apply location filter
    if (useLocationSearch) {
      console.log("Filtering by location:", locationFilter);
      const searchTerm = locationFilter.toLowerCase().trim();
      setSearchMode(true);
      
      const matchingItems = filtered.filter(item => {
        // Check if we have a geocoded address for this item
        const geocodedAddress = geocodedAddresses[item.id];
        
        // Check address from geocoding
        if (geocodedAddress && geocodedAddress.toLowerCase().includes(searchTerm)) {
          return true;
        }
        
        // Check location or coordinates
        const locationValue = item.location || item.Location || item.geoLocation || 
                             item.geopoint || item.coordinates;
        
        if (!locationValue) return false;
        
        // Format location to string for search
        let locationString = '';
        
        // Handle different location formats
        if (typeof locationValue === 'string') {
          locationString = locationValue.toLowerCase();
        } else if (Array.isArray(locationValue)) {
          locationString = locationValue.join(', ').toLowerCase();
        } else if (typeof locationValue === 'object') {
          // Check different object formats
          if ('_lat' in locationValue && '_long' in locationValue) {
            locationString = `${locationValue._lat}, ${locationValue._long}`.toLowerCase();
          } else if ('latitude' in locationValue && 'longitude' in locationValue) {
            locationString = `${locationValue.latitude}, ${locationValue.longitude}`.toLowerCase();
          } else if (locationValue.lat && locationValue.lng) {
            locationString = `${locationValue.lat}, ${locationValue.lng}`.toLowerCase();
          } else if (typeof locationValue.lat === 'function' && typeof locationValue.lng === 'function') {
            locationString = `${locationValue.lat()}, ${locationValue.lng()}`.toLowerCase();
          } else {
            try {
              locationString = JSON.stringify(locationValue).toLowerCase();
            } catch (e) {
              console.error("Error stringifying location", e);
            }
          }
        }
        
        return locationString.includes(searchTerm);
      });
      
      // Store the results specifically from location search
      setLocationSearchResults(matchingItems);
      
      // Update the filtered results
      filtered = matchingItems;
      
      // Show/hide the "no location matches" message
      const noLocationMatches = document.getElementById('no-location-matches');
      if (noLocationMatches) {
        if (matchingItems.length === 0 && uploads.length > 0) {
          noLocationMatches.style.display = 'block';
          // Update the message with the search term
          noLocationMatches.innerHTML = `No reports match your location search for "${locationFilter}". <br>Try different search terms or clear the location filter.`;
        } else {
          noLocationMatches.style.display = 'none';
        }
      }
    } else {
      setSearchMode(false);
      // Hide the no matches message when not searching
      const noLocationMatches = document.getElementById('no-location-matches');
      if (noLocationMatches) {
        noLocationMatches.style.display = 'none';
      }
    }
    
    setFilteredUploads(filtered);
  };

  const handleClearFilters = () => {
    setLocationFilter('');
    setVerdictFilter([]);
    setConditionFilters([]);
    setDateFilter(''); // Clear the single date filter
    
    // Hide the no matches message when clearing filters
    const noLocationMatches = document.getElementById('no-location-matches');
    if (noLocationMatches) {
      noLocationMatches.style.display = 'none';
    }
    
    setSearchMode(false);
  };

  // Add handler for page change
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    // Scroll to top when changing pages
    window.scrollTo(0, 0);
  };

  // Calculate pagination values
  const indexOfLastReport = page * reportsPerPage;
  const indexOfFirstReport = indexOfLastReport - reportsPerPage;
  const currentReports = filteredUploads.slice(indexOfFirstReport, indexOfLastReport);
  const totalPages = Math.ceil(filteredUploads.length / reportsPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [locationFilter, verdictFilter, conditionFilters, dateFilter, currentTab]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Map Section in its own container */}
      <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ color: '#6014cc', fontWeight: 600 }}>
            Accessibility Heat Map
          </Typography>
        </Box>
        <MapSection markers={filteredUploads} />
      </Paper>

      {/* Reports Gallery container */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
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

        {/* Tabs for filtering between all/valid/invalid reports */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange} 
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Badge badgeContent={uploads.length} color="primary" sx={{ mr: 1 }}>
                    <AssessmentIcon fontSize="small" />
                  </Badge>
                  All Reports
                </Box>
              } 
              value={TabOptions.ALL} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Badge badgeContent={validReportsCount} color="success" sx={{ mr: 1 }}>
                    <CheckCircleIcon fontSize="small" />
                  </Badge>
                  Valid Reports
                </Box>
              } 
              value={TabOptions.VALID} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Badge badgeContent={invalidReportsCount} color="error" sx={{ mr: 1 }}>
                    <FlagIcon fontSize="small" />
                  </Badge>
                  Invalid Reports
                </Box>
              } 
              value={TabOptions.INVALID} 
            />
          </Tabs>
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
        <Box sx={{ width: '100%' }}>
          {currentReports.map((item, index) => (
            <ReportCard 
              key={index}
              item={item} 
              index={indexOfFirstReport + index}
              exportingId={exportingId}
              setExportingId={setExportingId}
              onReportStatusChange={handleReportStatusChange}
            />
          ))}
          
          {/* Pagination controls */}
          {filteredUploads.length > 0 && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              mt: 4,
              mb: 2,
              alignItems: 'center'
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
                Showing {indexOfFirstReport + 1}-{Math.min(indexOfLastReport, filteredUploads.length)} of {filteredUploads.length} reports
              </Typography>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={handlePageChange} 
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
          
          {filteredUploads.length === 0 && !loading && (
            <Box sx={{ 
              textAlign: 'center', 
              mt: 3, 
              p: 3, 
              bgcolor: '#f5f5f5',
              borderRadius: 1
            }}>
              <Typography variant="body1">
                No reports found with the current filters.
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Add a "no matches" message element */}
      <Typography 
        id="no-location-matches" 
        variant="body1" 
        sx={{ 
          textAlign: 'center', 
          mt: 3, 
          p: 2, 
          display: 'none',
          bgcolor: '#f5f5f5',
          borderRadius: 1
        }}
      >
        No reports match your location search for "{locationFilter}".
        Try different search terms or clear the location filter.
      </Typography>
    </Box>
  );
};

export default Reports;