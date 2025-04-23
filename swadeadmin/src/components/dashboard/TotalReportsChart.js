import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, Button, Grid, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TimelineIcon from '@mui/icons-material/Timeline';

const TotalReportsChart = ({ reports }) => {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [maxWeeklyCount, setMaxWeeklyCount] = useState(1); // Avoid division by zero
  
  // Group reports by month
  const getMonthlyData = () => {
    const monthlyData = {};
    const now = new Date();
    
    // Initialize data for the last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthYear = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
      monthlyData[monthYear] = 0;
    }
    
    // Count reports by month
    reports.forEach(report => {
      if (report.createdAt) {
        const date = new Date(report.createdAt.seconds * 1000);
        const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        
        // Only count if it's within the last 6 months
        if (monthlyData[monthYear] !== undefined) {
          monthlyData[monthYear]++;
        }
      }
    });
    
    // Convert to array for chart
    return Object.entries(monthlyData).map(([month, count]) => ({
      month,
      count
    }));
  };

  // Generate weekly data for the selected month
  const getWeeklyData = (monthYear) => {
    const [monthStr, yearStr] = monthYear.split(' ');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = monthNames.findIndex(m => m === monthStr);
    const year = parseInt(yearStr);
    
    console.log(`Generating weekly data for ${monthStr} ${year} (month index: ${monthIndex})`);
    
    // Create data structure for weekly reports
    const weekData = [];
    
    // Get first and last date of the month
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    
    // Calculate weeks of the month
    const totalWeeks = Math.ceil((lastDay.getDate() + firstDay.getDay()) / 7);
    
    // Initialize week data
    for (let i = 1; i <= totalWeeks; i++) {
      weekData.push({
        name: `Week ${i}`,
        count: 0,
        percentage: 0
      });
    }
    
    // Count reports by week
    reports.forEach(report => {
      if (report.createdAt) {
        const date = new Date(report.createdAt.seconds * 1000);
        const reportMonth = date.getMonth();
        const reportYear = date.getFullYear();
        
        // Check if report is in the selected month
        if (reportMonth === monthIndex && reportYear === year) {
          // Calculate which week of the month
          const dayOfMonth = date.getDate();
          const weekNumber = Math.floor((dayOfMonth - 1 + firstDay.getDay()) / 7);
          
          // Increment count for this week
          if (weekData[weekNumber]) {
            weekData[weekNumber].count++;
          }
        }
      }
    });
    
    // Find max count for percentage calculation
    const maxCount = Math.max(...weekData.map(week => week.count), 1);
    setMaxWeeklyCount(maxCount);
    
    // Calculate percentages
    weekData.forEach(week => {
      week.percentage = (week.count / maxCount) * 100;
    });
    
    console.log("Weekly data generated:", weekData);
    return weekData;
  };

  const handleMonthClick = (month) => {
    console.log("Month clicked:", month);
    const monthWeeklyData = getWeeklyData(month);
    setWeeklyData(monthWeeklyData);
    setSelectedMonth(month);
  };

  const handleBackClick = () => {
    setSelectedMonth(null);
    setWeeklyData([]);
  };

  // Effect to log reports data
  useEffect(() => {
    console.log("TotalReportsChart received reports:", reports?.length || 0);
  }, [reports]);

  const data = getMonthlyData();
  
  // Find max count for percentage calculation 
  const maxCount = Math.max(...data.map(item => item.count), 1);

  return (
    <Paper
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        height: 340,
        boxShadow: 3,
        borderRadius: 2
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography component="h2" variant="h6" color="primary" gutterBottom>
          {selectedMonth ? `Weekly Reports for ${selectedMonth}` : 'Report Submissions Over Time'}
        </Typography>
        {selectedMonth && (
          <Button 
            startIcon={<ArrowBackIcon />} 
            size="small" 
            onClick={handleBackClick}
            variant="outlined"
          >
            Back to Months
          </Button>
        )}
      </Box>
      
      <Divider sx={{ my: 1 }} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <TimelineIcon sx={{ mr: 1, fontSize: '1rem', color: '#6014cc' }} />
        <Typography variant="subtitle1">
          {selectedMonth 
            ? `Reports by Week (${selectedMonth})` 
            : 'Reports by Month (Last 6 Months)'}
        </Typography>
      </Box>
      
      <Grid container spacing={1} sx={{ mt: 1, height: 180, overflowY: 'hidden', flexGrow: 1 }}>
        {!selectedMonth ? (
          // Monthly view
          data.map((month, index) => {
            const percentage = (month.count / maxCount) * 100;
            return (
              <Grid 
                item 
                xs={2} 
                key={index} 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  height: '100%',
                  cursor: 'pointer',
                  '&:hover': {
                    '& .bar': {
                      bgcolor: '#4a11a0', // Darker on hover
                    }
                  }
                }}
                onClick={() => handleMonthClick(month.month)}
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
                      height: `${percentage}%`, 
                      bgcolor: '#6014cc', 
                      width: '100%', 
                      borderTopLeftRadius: 2, 
                      borderTopRightRadius: 2,
                      minHeight: month.count > 0 ? 5 : 0,
                      transition: 'height 0.5s ease-in-out, background-color 0.2s ease'
                    }} 
                  />
                </Box>
                <Typography variant="caption" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
                  {month.month}
                </Typography>
                {month.count > 0 && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      position: 'absolute', 
                      bottom: `calc(${percentage}% + 25px)`, 
                      fontSize: '0.7rem',
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
            );
          })
        ) : (
          // Weekly view
          weeklyData.map((week, index) => (
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
              <Typography variant="caption" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
                {week.name}
              </Typography>
              {week.count > 0 && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    position: 'absolute', 
                    bottom: `calc(${week.percentage}% + 25px)`, 
                    fontSize: '0.7rem',
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
          ))
        )}
      </Grid>
      
      <Typography variant="subtitle1" align="center" sx={{ mt: 2 }}>
        {selectedMonth 
          ? `Total Reports in ${selectedMonth}: ${weeklyData.reduce((sum, item) => sum + item.count, 0)}`
          : `Total Reports: ${reports?.length || 0}`}
      </Typography>
    </Paper>
  );
};

export default TotalReportsChart;
