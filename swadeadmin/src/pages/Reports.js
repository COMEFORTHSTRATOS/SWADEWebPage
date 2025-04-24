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
  { value: 'unknown', label: 'Not Accessible' }
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
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

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
  }, [uploads, locationFilter, verdictFilter, conditionFilters, dateRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const handleClearFilters = () => {
    setLocationFilter('');
    setVerdictFilter([]);
    setConditionFilters([]);
    setDateRange({ start: '', end: '' });
  };

  const applyFilters = () => {
    if (!uploads.length) return;
    
    let filtered = [...uploads];
    
    // Filter by location text
    if (locationFilter) {
      const searchTerm = locationFilter.toLowerCase();
      filtered = filtered.filter(item => {
        // Check address or location data (adjust based on your actual data structure)
        const address = item.address || '';
        const locationData = JSON.stringify(item.location || item.Location || item.geoLocation || {});
        return address.toLowerCase().includes(searchTerm) || locationData.toLowerCase().includes(searchTerm);
      });
    }
    
    // Filter by verdict
    if (verdictFilter.length > 0) {
      filtered = filtered.filter(item => {
        if (verdictFilter.includes('accessible') && (item.finalVerdict === true || item.FinalVerdict === true)) return true;
        if (verdictFilter.includes('notAccessible') && (item.finalVerdict === false || item.FinalVerdict === false)) return true;
        if (verdictFilter.includes('unknown') && (item.finalVerdict === null || item.FinalVerdict === null)) return true;
        return false;
      });
    }
    
    // Filter by conditions - Simplify to directly access accessibilityCriteria
    if (conditionFilters.length > 0) {
      filtered = filtered.filter(item => {
        // Debug the first item to see its structure
        if (filtered.indexOf(item) === 0) {
          console.log('Item structure:', {
            id: item.id,
            accessibilityCriteria: item.accessibilityCriteria,
            accessValues: item.accessibilityCriteriaValues
          });
        }
        
        // Check for any matching condition
        return conditionFilters.some(condition => {
          const [criterionName, valueStr] = condition.split('_');
          const targetValue = parseInt(valueStr, 10);
          
          // Try all possible paths to find the value
          
          // 1. Direct accessibilityCriteria property (as seen in the Firebase image)
          if (item.accessibilityCriteria && criterionName) {
            // Check both lowercase and uppercase first letter variations
            const lowerCaseValue = item.accessibilityCriteria[criterionName];
            const upperCaseKey = criterionName.charAt(0).toUpperCase() + criterionName.slice(1);
            const upperCaseValue = item.accessibilityCriteria[upperCaseKey];
            
            const rawValue = lowerCaseValue !== undefined ? lowerCaseValue : upperCaseValue;
            
            if (rawValue !== undefined) {
              const numValue = typeof rawValue === 'string' ? parseInt(rawValue, 10) : rawValue;
              if (numValue === targetValue) return true;
            }
          }
          
          // 2. From preprocessed accessibilityCriteriaValues
          if (item.accessibilityCriteriaValues && 
              item.accessibilityCriteriaValues[criterionName] && 
              item.accessibilityCriteriaValues[criterionName].value !== undefined) {
            
            const criterionValue = item.accessibilityCriteriaValues[criterionName].value;
            const numValue = typeof criterionValue === 'string' ? parseInt(criterionValue, 10) : criterionValue;
            
            if (numValue === targetValue) return true;
          }
          
          // 3. Direct item property
          const directValue = item[criterionName] !== undefined ? 
                            item[criterionName] : 
                            item[criterionName.charAt(0).toUpperCase() + criterionName.slice(1)];
                            
          if (directValue !== undefined) {
            const numValue = typeof directValue === 'string' ? parseInt(directValue, 10) : directValue;
            if (numValue === targetValue) return true;
          }
          
          return false;
        });
      });
    }
    
    // Filter by date range
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(item => {
        const reportDate = new Date(item.createdAt);
        
        if (dateRange.start && dateRange.end) {
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          return reportDate >= startDate && reportDate <= endDate;
        } else if (dateRange.start) {
          const startDate = new Date(dateRange.start);
          return reportDate >= startDate;
        } else if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          return reportDate <= endDate;
        }
        
        return true;
      });
    }
    
    setFilteredUploads(filtered);
  };

  return (
    <Box sx={{ p: 3 }}>
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
              <IconButton 
                onClick={() => setShowFilters(!showFilters)} 
                sx={{ color: '#6014cc', mr: 1 }}
              >
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
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Location Search"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Address or coordinates"
                  variant="outlined"
                  size="small"
                />
              </Grid>
              
              {/* Verdict filter */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Verdict</InputLabel>
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
              
              {/* Date range */}
              <Grid item xs={12} md={4}>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="From Date"
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="To Date"
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                    />
                  </Grid>
                </Grid>
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
                          size="small"
                        />
                      }
                      label={option.label}
                      sx={{ mr: 2 }}
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

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        <ErrorAlert error={storageError} />
        
        <Grid container spacing={3}>
          {/* Map Section */}
          <Grid item xs={12}>
            <MapSection markers={filteredUploads} /> {/* Pass filtered markers if possible */}
          </Grid>
          
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
                      color="primary"
                      variant="outlined"
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