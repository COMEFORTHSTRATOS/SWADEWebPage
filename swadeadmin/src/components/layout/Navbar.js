import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Badge, IconButton } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { Link } from 'react-router-dom';
import notificationService from '../../services/notificationService';

const Navbar = () => {
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Subscribe to notification updates
    const unsubscribe = notificationService.subscribe(count => {
      setNotificationCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AppBar position="static" sx={{ bgcolor: '#6014cc' }}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          SWADE Admin
        </Typography>
        
        <IconButton 
          component={Link} 
          to="/reports" 
          color="inherit"
          onClick={() => notificationService.markAsSeen()}
        >
          <Badge badgeContent={notificationCount} color="error">
            <AssessmentIcon />
          </Badge>
        </IconButton>
        
        {/* Other navbar items */}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
