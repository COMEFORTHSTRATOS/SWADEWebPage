import React from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  IconButton,
  AppBar,
  Toolbar
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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" sx={{ bgcolor: '#6014cc' }}>
        <Toolbar>
          <DashboardIcon sx={{ fontSize: 32, mr: 2 }} />
          <Typography variant="h6" component="div">
            SWADE Admin
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Box sx={{ flexGrow: 1, bgcolor: '#f5f5f5', py: 4 }}>
        <Container maxWidth="lg">
          <Paper 
            elevation={0}
            sx={{ 
              p: 4, 
              mb: 4,
              bgcolor: 'transparent',
              borderRadius: 2
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#6014cc', fontWeight: 600 }}>
              Welcome to Dashboard
            </Typography>
            <Grid container spacing={4}>
              {cards.map((card, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card 
                    elevation={2}
                    sx={{
                      borderRadius: 2,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4
                      }
                    }}
                  >
                    <CardContent sx={{ textAlign: 'center' }}>
                      <IconButton
                        sx={{ 
                          mb: 2, 
                          color: '#6014cc',
                          '&:hover': { 
                            bgcolor: 'rgba(96, 20, 204, 0.1)' 
                          }
                        }}
                      >
                        {card.icon}
                      </IconButton>
                      <Typography variant="h6" component="div" gutterBottom>
                        {card.title}
                      </Typography>
                      <Typography variant="h4" sx={{ color: '#6014cc', fontWeight: 600 }}>
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
    </Box>
  );
};

export default Dashboard;
