import React from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import LayersIcon from '@mui/icons-material/Layers';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const Dashboard = () => {
  const cards = [
    { title: 'Total Users', value: '2,300', icon: <PersonIcon />, trend: '+14%' },
    { title: 'New Users', value: '150', icon: <PeopleIcon />, trend: '+21%' },
    { title: 'Active Sessions', value: '48', icon: <LayersIcon />, trend: '+18%' },
    { title: 'Conversion Rate', value: '3.2%', icon: <TrendingUpIcon />, trend: '+12%' }
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {cards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 3,
                }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="h4" component="div" sx={{ color: '#6014cc', fontWeight: 'bold' }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Box 
                    sx={{ 
                      backgroundColor: 'rgba(96, 20, 204, 0.1)',
                      borderRadius: '50%',
                      p: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {React.cloneElement(card.icon, { sx: { color: '#6014cc' } })}
                  </Box>
                </Box>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mt: 2,
                    color: 'success.main',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  <TrendingUpIcon fontSize="small" />
                  {card.trend}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default Dashboard;
