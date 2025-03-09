import React from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  IconButton
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import AssessmentIcon from '@mui/icons-material/Assessment';

const Dashboard = () => {
  const cards = [
    { title: 'Users', icon: <PeopleIcon sx={{ fontSize: 40 }} />, value: '150' },
    { title: 'Reports', icon: <AssessmentIcon sx={{ fontSize: 40 }} />, value: '28' },
    { title: 'Settings', icon: <SettingsIcon sx={{ fontSize: 40 }} />, value: '5' }
  ];

  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <DashboardIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
            <Typography variant="h4" component="h1">
              Welcome to Dashboard
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {cards.map((card, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <IconButton
                      color="primary"
                      sx={{ mb: 2, '&:hover': { bgcolor: 'transparent' } }}
                    >
                      {card.icon}
                    </IconButton>
                    <Typography variant="h5" component="div" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {card.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default Dashboard;
