import { ThemeProvider, createTheme } from '@mui/material';
import { RouterProvider } from 'react-router-dom';
import router from './navigation';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#6014cc',
      contrastText: '#ffffff'
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff'
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none'
        }
      }
    }
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}   

export default App;
