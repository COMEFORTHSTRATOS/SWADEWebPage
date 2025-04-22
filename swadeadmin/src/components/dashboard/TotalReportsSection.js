import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, Divider, Grid, Button, CircularProgress } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TimelineIcon from '@mui/icons-material/Timeline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { fetchReportsOnly } from '../../services/firebase';

const TotalReportsSection = () => {
  const [reports, setReports] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [maxCount, setMaxCount] = useState(1); // Avoid division by zero
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageError, setStorageError] = useState(null);
  
  // Load reports using the same function from Reports.js
  const loadReports = async () => {
    setLoading(true);
    try {
      const { uploads: fetchedUploads, storageError: error } = await fetchReportsOnly();
      setReports(fetchedUploads);
      setStorageError(error);
      processMonthlyData(fetchedUploads);
    } catch (error) {
      console.error("Error loading reports:", error);
      setStorageError(`Unexpected error: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Process reports for monthly data visualization
  const processMonthlyData = (reportData) => {
    const currentYear = new Date().getFullYear();
    const monthCounts = Array(12).fill(0);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (reportData && reportData.length > 0) {
      reportData.forEach(report => {
        if (report.createdAt) {
          const date = new Date(report.createdAt.seconds * 1000);
          if (date.getFullYear() === currentYear) {
            const month = date.getMonth();
            monthCounts[month] += 1;
          }
        }
      });
    }
    
    // Find the maximum count for scaling the bars
    const max = Math.max(...monthCounts, 1);
    setMaxCount(max);
    
    // Prepare the monthly data
    const data = monthNames.map((name, index) => ({
      name,
      count: monthCounts[index],
      percentage: (monthCounts[index] / max) * 100
    }));
    
    setMonthlyData(data);
  };

  // Handle refresh button click
  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  // Load reports on component mount
  useEffect(() => {
    loadReports();
  }, []);

  if (loading && !refreshing) {
    return (
      <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress sx={{ color: '#6014cc' }} />
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AssessmentIcon sx={{ mr: 1, color: '#6014cc' }} />
          <Typography variant="h6" sx={{ color: '#6014cc', fontWeight: 'medium', mb: 0 }}>
            Total Reports
          </Typography>
        </Box>
        <Button 
          size="small" 
          onClick={handleRefresh}
          disabled={loading}
          startIcon={<RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />}
          sx={{ color: '#6014cc' }}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Box sx={{ 
          width: '100%', 
          textAlign: 'center', 
          py: 2,
          backgroundColor: '#f5f5f5',
          borderRadius: 1
        }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#6014cc' }}>
            {reports ? reports.length : 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total Reports Submitted
          </Typography>
        </Box>
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <TimelineIcon sx={{ mr: 1, fontSize: '1rem', color: '#6014cc' }} />
        <Typography variant="subtitle1">
          Reports by Month ({new Date().getFullYear()})
        </Typography>
      </Box>
      
      <Grid container spacing={1} sx={{ mt: 1, height: 150, overflowY: 'hidden' }}>
        {monthlyData.map((month, index) => (
          <Grid item xs={1} key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
            <Box sx={{ 
              flexGrow: 1, 
              display: 'flex', 
              flexDirection: 'column-reverse', 
              width: '100%', 
              position: 'relative',
              height: '100%'
            }}>
              <Box sx={{ 
                height: `${month.percentage}%`, 
                bgcolor: '#6014cc', 
                width: '100%', 
                borderTopLeftRadius: 2, 
                borderTopRightRadius: 2,
                minHeight: month.count > 0 ? 5 : 0,
                transition: 'height 0.5s ease-in-out'
              }} />
            </Box>
            <Typography variant="caption" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
              {month.name}
            </Typography>
            {month.count > 0 && (
              <Typography 
                variant="caption" 
                sx={{ 
                  position: 'absolute', 
                  bottom: `calc(${month.percentage}% + 25px)`, 
                  fontSize: '0.6rem',
                  bgcolor: 'rgba(96, 20, 204, 0.8)',
                  color: 'white',
                  px: 0.5,
                  borderRadius: 1,
                  display: 'none',
                  '.MuiGrid-item:hover &': {
                    display: 'block'
                  }
                }}
              >
                {month.count}
              </Typography>
            )}
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

export default TotalReportsSection;
