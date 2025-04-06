import React from 'react';
import { Card, CardContent, Typography, Box, List, ListItem, ListItemText } from '@mui/material';

const TrafficSourcesSection = ({ trafficSources }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Traffic Sources</Typography>
        <List sx={{ width: '100%' }}>
          {trafficSources.length > 0 ? trafficSources.map((source, index) => (
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