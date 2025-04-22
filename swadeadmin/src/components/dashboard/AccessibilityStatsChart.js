import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const AccessibilityStatsChart = ({ reportStats }) => {
  const data = [
    { name: 'Accessible', value: reportStats.accessible, color: '#4caf50' },
    { name: 'Not Accessible', value: reportStats.notAccessible, color: '#f44336' },
    { name: 'Pending', value: reportStats.pending, color: '#ff9800' }
  ];

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
        Accessibility Analysis
      </Typography>
      <Box sx={{ height: '85%', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value} reports`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="subtitle1" align="center" sx={{ mt: 1 }}>
        Accessibility Rate: {reportStats.accessibilityRate}
      </Typography>
    </Paper>
  );
};

export default AccessibilityStatsChart;
