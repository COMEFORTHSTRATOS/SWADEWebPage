import { ThemeProvider, createTheme } from '@mui/material';
import { RouterProvider } from 'react-router-dom';
import router from './navigation';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2'
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
