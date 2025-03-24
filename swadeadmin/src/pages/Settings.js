import React from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Switch,
  Divider,
  useTheme
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SecurityIcon from '@mui/icons-material/Security';
import LanguageIcon from '@mui/icons-material/Language';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useDarkMode } from '../context/DarkModeContext';

const Settings = () => {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useTheme();
  
  const settingsOptions = [
    { 
      title: 'Notifications',
      description: 'Manage your notification preferences',
      icon: <NotificationsIcon />,
      hasSwitch: true,
      checked: false,
      onChange: () => {}
    },
    {
      title: 'Security',
      description: 'Configure security settings',
      icon: <SecurityIcon />,
      hasSwitch: false
    },
    {
      title: 'Language',
      description: 'Change your language preferences',
      icon: <LanguageIcon />,
      hasSwitch: false
    },
    {
      title: 'Dark Mode',
      description: 'Toggle dark mode',
      icon: <DarkModeIcon />,
      hasSwitch: true,
      checked: darkMode,
      onChange: toggleDarkMode
    }
  ];

  return (
    <Box sx={{ 
      p: 3,
      minHeight: '100vh',
      width: '100%',
      bgcolor: 'background.default',
      color: 'text.primary'
    }}>
      <Paper 
        elevation={darkMode ? 4 : 1}
        sx={{ 
          p: 3, 
          borderRadius: 2,
          bgcolor: 'background.paper',
          transition: theme.transitions.create(['background-color', 'box-shadow'])
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <SettingsIcon sx={{ fontSize: 32, color: '#6014cc', mr: 2 }} />
          <Typography variant="h5" sx={{ color: '#6014cc', fontWeight: 600 }}>
            Settings
          </Typography>
        </Box>

        <List sx={{ width: '100%' }}>
          {settingsOptions.map((option, index) => (
            <React.Fragment key={option.title}>
              <ListItem 
                disablePadding
                secondaryAction={
                  option.hasSwitch && (
                    <Switch
                      edge="end"
                      checked={option.checked}
                      onChange={option.onChange}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#6014cc',
                          '&:hover': {
                            backgroundColor: 'rgba(96, 20, 204, 0.08)',
                          },
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#6014cc',
                        },
                      }}
                    />
                  )
                }
              >
                <ListItemButton
                  sx={{
                    py: 2,
                    '&:hover': {
                      bgcolor: 'rgba(96, 20, 204, 0.08)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: '#6014cc' }}>
                    {option.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={option.title}
                    secondary={option.description}
                    primaryTypographyProps={{
                      fontWeight: 500
                    }}
                  />
                </ListItemButton>
              </ListItem>
              {index < settingsOptions.length - 1 && (
                <Divider variant="inset" component="li" />
              )}
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default Settings;
