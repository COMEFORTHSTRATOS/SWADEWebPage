import React, { useEffect } from 'react';
import { Card, CardContent, Typography, Box, List, ListItem, ListItemText, Button } from '@mui/material';

const TrafficSourcesSection = ({ trafficSources, sourcesToShow = 5 }) => {
  // Convert sourcesToShow to a number and ensure it's valid
  const numSourcesToShow = parseInt(sourcesToShow, 10) || 5;
  
  // Limit the number of sources to display based on settings
  const displayedSources = trafficSources.slice(0, numSourcesToShow);
  
  // For debugging
  useEffect(() => {
    console.log('TrafficSourcesSection received sourcesToShow:', sourcesToShow);
    console.log('Parsed numSourcesToShow:', numSourcesToShow);
    console.log('Displaying sources:', displayedSources.length, 'of', trafficSources.length);
  }, [sourcesToShow, numSourcesToShow, trafficSources, displayedSources.length]);
  
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Traffic Sources</Typography>
          {trafficSources.length > numSourcesToShow && (
            <Button 
              size="small" 
              color="primary"
            >
              View All
            </Button>
          )}
        </Box>
        <List sx={{ width: '100%' }}>
          {displayedSources.length > 0 ? displayedSources.map((source, index) => (
            <ListItem
              key={source.location}
              sx={{
                bgcolor: index === 0 ? 'rgba(96, 20, 204, 0.1)' : 'transparent',
                borderRadius: 1,
                mb: 1
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: index === 0 ? 'bold' : 'regular' }}>
                      {source.location}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {source.percentage}%
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 1 }}>
                    <Box
                      sx={{
                        width: '100%',
                        height: 4,
                        bgcolor: 'rgba(96, 20, 204, 0.1)',
                        borderRadius: 2,
                      }}
                    >
                      <Box
                        sx={{
                          width: `${source.percentage}%`,
                          height: '100%',
                          bgcolor: '#6014cc',
                          borderRadius: 2,
                        }}
                      />
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          )) : (
            <ListItem>
              <ListItemText primary="No traffic data available" />
            </ListItem>
          )}
        </List>
      </CardContent>
    </Card>
  );
};

export default TrafficSourcesSection;