import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, CircularProgress, IconButton, Tooltip } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import { fetchReportsOnly } from '../services/firebase';
import ErrorAlert from '../components/ErrorAlert';
import ReportCard from '../components/ReportCard';

const Reports = () => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [exportingId, setExportingId] = useState(null); // Track which report is being exported

  const loadReports = async () => {
    setLoading(true);
    try {
      const { uploads: fetchedUploads, storageError: error } = await fetchReportsOnly();
      setUploads(fetchedUploads);
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
  }, []);

  // Handle refresh button click
  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
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

        {/* Add CSS for the refresh animation */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

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
                <Typography variant="h6" sx={{ mt: 2, mb: 2 }}>
                  Reports Gallery
                </Typography>
                
                {uploads.length === 0 && !loading ? (
                  <Typography variant="body1" sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No reports found. Reports will appear here when available.
                  </Typography>
                ) : (
                  <Grid container spacing={3}>
                    {uploads.map((item, index) => (
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