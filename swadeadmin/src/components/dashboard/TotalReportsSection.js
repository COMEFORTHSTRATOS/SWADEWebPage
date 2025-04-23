import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, Divider, Grid, Button, CircularProgress } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TimelineIcon from '@mui/icons-material/Timeline';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchReportsOnly } from '../../services/firebase';

const TotalReportsSection = () => {
  const [reports, setReports] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [maxCount, setMaxCount] = useState(1); // Avoid division by zero
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [maxWeeklyCount, setMaxWeeklyCount] = useState(1);
  
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
      name: `${name} ${currentYear}`,
      count: monthCounts[index],
      percentage: (monthCounts[index] / max) * 100
    }));
    
    setMonthlyData(data);
  };

  // Generate weekly data for the selected month
  const getWeeklyData = (monthName) => {
    const [monthStr, yearStr] = monthName.split(' ');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = monthNames.findIndex(m => m === monthStr);
    const year = parseInt(yearStr);
    
    const weekData = [];
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const totalWeeks = Math.ceil((lastDay.getDate() + firstDay.getDay()) / 7);
    
    for (let i = 1; i <= totalWeeks; i++) {
      weekData.push({
        name: `Week ${i}`,
        count: 0,
        percentage: 0
      });
    }
    
    reports.forEach(report => {
      if (report.createdAt) {
        const date = new Date(report.createdAt.seconds * 1000);
        const reportMonth = date.getMonth();
        const reportYear = date.getFullYear();
        
        if (reportMonth === monthIndex && reportYear === year) {
          const dayOfMonth = date.getDate();
          const weekNumber = Math.floor((dayOfMonth - 1 + firstDay.getDay()) / 7);
          
          if (weekData[weekNumber]) {
            weekData[weekNumber].count++;
          }
        }
      }
    });
    
    const maxCount = Math.max(...weekData.map(week => week.count), 1);
    setMaxWeeklyCount(maxCount);
    
    weekData.forEach(week => {
      week.percentage = (week.count / maxCount) * 100;
    });
    
    return weekData;
  };

  // Handle refresh button click
  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
    setSelectedMonth(null);
    setWeeklyData([]);
  };

  // Handle month column click
  const handleMonthClick = (month) => {
    const monthWeeklyData = getWeeklyData(month);
    setWeeklyData(monthWeeklyData);
    setSelectedMonth(month);
  };

  // Handle back button click
  const handleBackClick = () => {
    setSelectedMonth(null);
    setWeeklyData([]);
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
          <AssessmentIcon sx={{ mr: 1, color: '#6014cc' }} />
          <Typography variant="h6" sx={{ color: '#6014cc', fontWeight: 'medium', mb: 0 }}>
            {selectedMonth ? `Reports: ${selectedMonth}` : 'Total Reports'}
          </Typography>
        </Box>
        <Box>
          {selectedMonth && (
            <Button 
              size="small" 
              onClick={handleBackClick}
              startIcon={<ArrowBackIcon />}
              sx={{ mr: 1, color: '#6014cc' }}
            >
              Back
            </Button>
          )}
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
      </Box>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      {!selectedMonth ? (
        <>
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
              Reports by Month ({new Date().getFullYear()}) - Click on a month to see weekly details
            </Typography>
          </Box>
          
          <Grid container spacing={1} sx={{ mt: 1, height: 150, overflowY: 'hidden' }}>
            {monthlyData.map((month, index) => (
              <Grid 
                item 
                xs={1} 
                key={index} 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  height: '100%',
                  cursor: month.count > 0 ? 'pointer' : 'default',
                  '&:hover': month.count > 0 ? {
                    '& .bar': {
                      bgcolor: '#4a11a0',
                    }
                  } : {}
                }}
                onClick={() => month.count > 0 && handleMonthClick(month.name)}
              >
                <Box sx={{ 
                  flexGrow: 1, 
                  display: 'flex', 
                  flexDirection: 'column-reverse', 
                  width: '100%', 
                  position: 'relative',
                  height: '100%'
                }}>
                  <Box 
                    className="bar"
                    sx={{ 
                      height: `${month.percentage}%`, 
                      bgcolor: '#6014cc', 
                      width: '100%', 
                      borderTopLeftRadius: 2, 
                      borderTopRightRadius: 2,
                      minHeight: month.count > 0 ? 5 : 0,
                      transition: 'height 0.5s ease-in-out, background-color 0.2s ease'
                    }} 
                  />
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
        </>
      ) : (
        <>
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TimelineIcon sx={{ mr: 1, fontSize: '1rem', color: '#4CAF50' }} />
            <Typography variant="subtitle1">
              Reports by Week in {selectedMonth}
            </Typography>
          </Box>
          
          <Grid container spacing={1} sx={{ mt: 1, height: 200, overflowY: 'hidden' }}>
            {weeklyData.map((week, index) => (
              <Grid item xs={Math.floor(12 / weeklyData.length)} key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                <Box sx={{ 
                  flexGrow: 1, 
                  display: 'flex', 
                  flexDirection: 'column-reverse', 
                  width: '100%', 
                  position: 'relative',
                  height: '100%'
                }}>
                  <Box sx={{ 
                    height: `${week.percentage}%`, 
                    bgcolor: '#4CAF50', 
                    width: '100%', 
                    borderTopLeftRadius: 2, 
                    borderTopRightRadius: 2,
                    minHeight: week.count > 0 ? 5 : 0,
                    transition: 'height 0.5s ease-in-out'
                  }} />
                </Box>
                <Typography variant="caption" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
                  {week.name}
                </Typography>
                {week.count > 0 && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      position: 'absolute', 
                      bottom: `calc(${week.percentage}% + 25px)`, 
                      fontSize: '0.6rem',
                      bgcolor: 'rgba(76, 175, 80, 0.8)',
                      color: 'white',
                      px: 0.5,
                      borderRadius: 1,
                      display: 'none',
                      '.MuiGrid-item:hover &': {
                        display: 'block'
                      }
                    }}
                  >
                    {week.count}
                  </Typography>
                )}
              </Grid>
            ))}
          </Grid>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'medium', color: '#4CAF50' }}>
              Total Reports in {selectedMonth}: {weeklyData.reduce((sum, item) => sum + item.count, 0)}
            </Typography>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default TotalReportsSection;
