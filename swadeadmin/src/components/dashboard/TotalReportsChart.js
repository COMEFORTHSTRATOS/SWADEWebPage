import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TotalReportsChart = ({ reports }) => {
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

  const data = getMonthlyData();

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
      <Typography component="h2" variant="h6" color="primary" gutterBottom>
        Report Submissions Over Time
      </Typography>
      <Box sx={{ height: '85%', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value) => [`${value} reports`, "Count"]}
              labelFormatter={(label) => `Month: ${label}`}
            />
            <Bar dataKey="count" fill="#6014cc" name="Reports" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="subtitle1" align="center" sx={{ mt: 1 }}>
        Total Reports: {reports.length}
      </Typography>
    </Paper>
  );
};

export default TotalReportsChart;
