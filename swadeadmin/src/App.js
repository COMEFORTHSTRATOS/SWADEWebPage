import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import { RouterProvider } from 'react-router-dom';
import { useMemo } from 'react';
import router from './navigation';
import './App.css';
import { DarkModeProvider, useDarkMode } from './context/DarkModeContext';

const AppContent = () => {
  const { darkMode } = useDarkMode();
  
  // Create theme based on dark mode state
  const theme = useMemo(() => 
    createTheme({
      palette: {
        mode: darkMode ? 'dark' : 'light',
        primary: {
          main: darkMode ? '#9573d4' : '#6014cc', // Lighter purple for dark mode
          contrastText: '#ffffff'
        },
        secondary: {
          main: darkMode ? '#c597ff' : '#8540e6',
        },
        background: {
          default: darkMode ? '#121212' : '#f5f5f5',
          paper: darkMode ? '#1e1e1e' : '#ffffff',
        },
        text: {
          primary: darkMode ? '#e0e0e0' : '#000000',
          secondary: darkMode ? '#a0a0a0' : '#505050',
        },
        divider: darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            'html, body': {
              backgroundColor: darkMode ? '#121212' : '#f5f5f5',
              margin: 0,
              padding: 0,
              minHeight: '100vh',
              width: '100%',
              transition: 'background-color 0.3s ease',
            },
            '#root': {
              backgroundColor: darkMode ? '#121212' : '#f5f5f5',
              minHeight: '100vh',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
            },
            '*': {
              boxSizing: 'border-box',
            }
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
              transition: 'background-color 0.2s ease',
              boxShadow: darkMode ? '0 4px 6px rgba(0, 0, 0, 0.4)' : '0 1px 3px rgba(0, 0, 0, 0.12)',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              transition: 'background-color 0.2s',
              '&:hover': {
                backgroundColor: darkMode ? 'rgba(149, 115, 212, 0.12)' : 'rgba(96, 20, 204, 0.08)',
              },
            },
          },
        },
        MuiListItemIcon: {
          styleOverrides: {
            root: {
              color: darkMode ? '#9573d4' : '#6014cc',
              minWidth: '42px',
            },
          },
        },
        MuiListItemText: {
          styleOverrides: {
            primary: {
              fontWeight: 500,
              color: darkMode ? '#e0e0e0' : 'inherit',
            },
            secondary: {
              color: darkMode ? '#a0a0a0' : 'inherit',
            },
          },
        },
        MuiSwitch: {
          styleOverrides: {
            switchBase: {
              '&.Mui-checked': {
                color: darkMode ? '#9573d4' : '#6014cc',
                '& + .MuiSwitch-track': {
                  backgroundColor: darkMode ? '#9573d4' : '#6014cc',
                  opacity: 0.9,
                },
                '&:hover': {
                  backgroundColor: darkMode ? 'rgba(149, 115, 212, 0.12)' : 'rgba(96, 20, 204, 0.08)',
                },
              },
            },
            track: {
              opacity: 0.2,
            },
          },
        },
        MuiDivider: {
          styleOverrides: {
            root: {
              opacity: darkMode ? 0.4 : 0.6,
            },
          },
        },
      }
    }),
    [darkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        bgcolor: 'background.default', 
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <RouterProvider router={router} />
      </Box>
    </ThemeProvider>
  );
};

function App() {
  return (
    <DarkModeProvider>
      <AppContent />
    </DarkModeProvider>
  );
}   

export default App;
