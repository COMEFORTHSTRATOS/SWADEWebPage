import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Menu,
  MenuItem,
  Badge,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { getAuth, signOut } from 'firebase/auth';
import { useTheme } from '@mui/material';
import { useDarkMode } from '../context/DarkModeContext';
import notificationService from '../services/notificationService';

const drawerWidth = 240;

const DashboardLayout = () => {
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { darkMode } = useDarkMode();

  useEffect(() => {
    // Start notification service
    notificationService.startNotifications();
    
    // Subscribe to notification updates
    const unsubscribe = notificationService.subscribe(count => {
      setNotificationCount(count);
    });
    
    // If we're on the reports page, mark notifications as seen
    if (location.pathname === '/reports') {
      notificationService.markAsSeen();
    }
    
    return () => {
      unsubscribe();
    };
  }, [location.pathname]);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const toggleDrawer = () => {
    setOpen(!open);
  };
  
  const handleNavigation = (path) => {
    navigate(path);
    if (path === '/reports') {
      notificationService.markAsSeen();
    }
  };

  const mainListItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Users', icon: <PeopleIcon />, path: '/users' },
    { 
      text: 'Reports', 
      icon: notificationCount > 0 ? (
        <Badge badgeContent={notificationCount} color="error">
          <BarChartIcon />
        </Badge>
      ) : <BarChartIcon />, 
      path: '/reports' 
    },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' }
  ];

  return (
    <Box sx={{ 
      display: 'flex',
      bgcolor: 'background.default',
      minHeight: '100vh',
    }}>
      <AppBar
        position="fixed"
        sx={{
          bgcolor: '#6014cc',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          transition: (theme) =>
            theme.transitions.create(['width', 'margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          ...(open && {
            marginLeft: drawerWidth,
            width: `calc(100% - ${drawerWidth}px)`,
            transition: (theme) =>
              theme.transitions.create(['width', 'margin'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
          }),
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={toggleDrawer}
            sx={{ marginRight: 2 }}
          >
            {open ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            SWADE Admin
          </Typography>
          <IconButton 
            color="inherit"
            onClick={handleProfileMenuOpen}
            aria-controls="profile-menu"
            aria-haspopup="true"
          >
            <PersonIcon />
          </IconButton>
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <ExitToAppIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          ...(open && {
            width: drawerWidth,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              transition: (theme) =>
                theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
            },
          }),
          ...(!open && {
            width: theme => theme.spacing(7),
            '& .MuiDrawer-paper': {
              width: theme => theme.spacing(7),
              transition: (theme) =>
                theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.leavingScreen,
                }),
            },
          }),
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#6014cc',
            borderBottom: '1px solid #e0e0e0',
            px: [1, 2],
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', width: '100%' }}>
            <img
              src="../swadelogo.png"
              alt="SWADE Logo"
              style={{ 
                height: '40px', 
                marginRight: open ? '10px' : '0',
                transition: 'margin 0.2s ease-in-out'
              }}
            />
            {open && (
              <Typography
                variant="h6"
                component="div"
                sx={{ 
                  color: '#f9f9f9',
                  fontWeight: 'bold',
                  display: 'inline-block',
                }}
              >
                SWADE
              </Typography>
            )}
          </Box>
        </Toolbar>
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {mainListItems.map((item) => (
              <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    minHeight: 48,
                    justifyContent: open ? 'initial' : 'center',
                    px: 2.5,
                    bgcolor: location.pathname === item.path ? 'rgba(96, 20, 204, 0.08)' : 'transparent',
                    '&:hover': {
                      bgcolor: 'rgba(96, 20, 204, 0.12)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: open ? 3 : 'auto',
                      justifyContent: 'center',
                      color: location.pathname === item.path ? '#6014cc' : 'inherit',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text} 
                    sx={{ 
                      opacity: open ? 1 : 0,
                      color: location.pathname === item.path ? '#6014cc' : 'inherit',
                      fontWeight: location.pathname === item.path ? 600 : 400,
                    }} 
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          overflow: 'auto',
          pt: 10,
          px: 3,
          bgcolor: 'background.default',
          color: 'text.primary',
          transition: theme.transitions.create(['background-color'], {
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;