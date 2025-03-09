import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';

const Reports = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AssessmentIcon sx={{ fontSize: 32, color: '#6014cc', mr: 2 }} />
          <Typography variant="h5" sx={{ color: '#6014cc', fontWeight: 600 }}>
            Reports
          </Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography>Reports content will go here</Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Reports;
