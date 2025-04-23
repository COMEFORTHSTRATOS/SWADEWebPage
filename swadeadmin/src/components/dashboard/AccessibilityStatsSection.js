import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, CircularProgress, Stack, LinearProgress, Divider, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import { fetchReportsOnly } from '../../services/firebase';

const AccessibilityStatsSection = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [stats, setStats] = useState({
    accessible: 0,
    notAccessible: 0,
    total: 0,
    accessiblePercentage: 0,
    notAccessiblePercentage: 0
  });

  // Function to extract finalVerdict following the same logic as ReportCard
  const extractFinalVerdict = (report) => {
    let finalVerdictValue;
    
    if (report.finalVerdict === false || report.FinalVerdict === false) {
      finalVerdictValue = false;
    } else if (report.finalVerdict === true || report.FinalVerdict === true) {
      finalVerdictValue = true;
    } else if (report.finalVerdict === null || report.FinalVerdict === null) {
      finalVerdictValue = false;
    } else {
      // Check string values that represent booleans
      if (report.finalVerdict === 'true' || report.finalVerdict === 'yes' || report.finalVerdict === '1') {
        finalVerdictValue = true;
      } else if (report.FinalVerdict === 'true' || report.FinalVerdict === 'yes' || report.FinalVerdict === '1') {
        finalVerdictValue = true;
      } else if (report.finalVerdict === 'false' || report.finalVerdict === 'no' || report.finalVerdict === '0') {
        finalVerdictValue = false;
      } else if (report.FinalVerdict === 'false' || report.FinalVerdict === 'no' || report.FinalVerdict === '0') {
        finalVerdictValue = false;
      } else if (report.finalVerdict === 1 || report.FinalVerdict === 1) {
        finalVerdictValue = true;
      } else if (report.finalVerdict === 0 || report.FinalVerdict === 0) {
        finalVerdictValue = false;
      } else {
        finalVerdictValue = report.finalVerdict !== undefined ? report.finalVerdict : 
                         (report.FinalVerdict !== undefined ? report.FinalVerdict : undefined);
      }
    }
    
    return finalVerdictValue;
  };

  // Copy of loadReports function from Reports.js
  const loadReports = async () => {
    setLoading(true);
    try {
      const { uploads: fetchedUploads, storageError: error } = await fetchReportsOnly();
      setReports(fetchedUploads);
      setStorageError(error);
      calculateStats(fetchedUploads);
    } catch (error) {
      console.error("Error loading reports:", error);
      setStorageError(`Unexpected error: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Function to calculate statistics from reports
  const calculateStats = (reportData) => {
    if (reportData && reportData.length > 0) {
      let accessibleCount = 0;
      let notAccessibleCount = 0;

      reportData.forEach(report => {
        const finalVerdict = extractFinalVerdict(report);
        if (finalVerdict === true) {
          accessibleCount++;
        } else if (finalVerdict === false) {
          notAccessibleCount++;
        }
      });

      const total = accessibleCount + notAccessibleCount;
      const accessiblePercentage = total > 0 ? (accessibleCount / total) * 100 : 0;
      const notAccessiblePercentage = total > 0 ? (notAccessibleCount / total) * 100 : 0;

      setStats({
        accessible: accessibleCount,
        notAccessible: notAccessibleCount,
        total,
        accessiblePercentage,
        notAccessiblePercentage
      });
    } else {
      setStats({
        accessible: 0,
        notAccessible: 0,
        total: 0,
        accessiblePercentage: 0,
        notAccessiblePercentage: 0
      });
    }
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
    <Paper elevation={2} sx={{ p: 2, height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AccessibilityNewIcon sx={{ mr: 1, color: '#6014cc' }} />
          <Typography variant="h6" sx={{ color: '#6014cc', fontWeight: 'medium', mb: 0 }}>
            Accessibility Status
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
      
      {stats.total > 0 ? (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircleIcon sx={{ color: '#4CAF50', mr: 1 }} />
              <Typography>Accessible</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {stats.accessible} ({stats.accessiblePercentage.toFixed(1)}%)
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={stats.accessiblePercentage} 
            sx={{ 
              mb: 2, 
              height: 10, 
              borderRadius: 5,
              backgroundColor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#4CAF50'
              }
            }} 
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CancelIcon sx={{ color: '#F44336', mr: 1 }} />
              <Typography>Not Accessible</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {stats.notAccessible} ({stats.notAccessiblePercentage.toFixed(1)}%)
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={stats.notAccessiblePercentage} 
            sx={{ 
              height: 10, 
              borderRadius: 5,
              backgroundColor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#F44336'
              }
            }} 
          />
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Box sx={{ 
              width: 120, 
              height: 120, 
              position: 'relative', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <CircularProgress 
                variant="determinate" 
                value={100} 
                size={120} 
                thickness={6} 
                sx={{ 
                  position: 'absolute',
                  color: '#e0e0e0'
                }} 
              />
              <CircularProgress 
                variant="determinate" 
                value={stats.accessiblePercentage} 
                size={120} 
                thickness={6}
                sx={{ 
                  position: 'absolute',
                  color: '#4CAF50',
                  opacity: 0.7,
                  '& .MuiCircularProgress-circle': {
                    strokeLinecap: 'round',
                  },
                }} 
              />
              <Typography variant="h6" component="div" color="text.secondary">
                {stats.accessiblePercentage.toFixed(0)}%
              </Typography>
            </Box>
          </Box>
          
          <Typography variant="subtitle2" sx={{ mt: 2, textAlign: 'center' }}>
            Accessibility Rate
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Typography variant="body1" color="text.secondary">
            No accessibility data available
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default AccessibilityStatsSection;
