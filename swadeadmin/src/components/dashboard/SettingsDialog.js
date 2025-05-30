import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Typography, Box, Button, IconButton, 
  FormControlLabel, Switch, Select, MenuItem, FormControl
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';

const SettingsDialog = ({ 
  open, 
  onClose, 
  settings, 
  onSettingChange, 
  onResetSettings 
}) => {
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon color="primary" />
          <Typography variant="h6">Dashboard Settings</Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: theme => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Dashboard Layout
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={settings.showSummaryCards} 
                onChange={(e) => onSettingChange('showSummaryCards', e.target.checked)}
                color="primary"
              />
            }
            label="Show Summary Cards"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={settings.showPhilippinesStats} 
                onChange={(e) => onSettingChange('showPhilippinesStats', e.target.checked)}
                color="primary"
              />
            }
            label="Show Philippines Regional Statistics"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={settings.showQuezonCityStats} 
                onChange={(e) => onSettingChange('showQuezonCityStats', e.target.checked)}
                color="primary"
              />
            }
            label="Show Quezon City District Statistics"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={settings.showTrafficSources} 
                onChange={(e) => onSettingChange('showTrafficSources', e.target.checked)}
                color="primary"
              />
            }
            label="Accessibility Pie"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.showAccessibilityStats}
                onChange={(e) => onSettingChange('showAccessibilityStats', e.target.checked)}
                color="primary"
              />
            }
            label="Show Accessibility Statistics"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.showTotalReports}
                onChange={(e) => onSettingChange('showTotalReports', e.target.checked)}
                color="primary"
              />
            }
            label="Show Total Reports"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.showPriorityAnalysis}
                onChange={(e) => onSettingChange('showPriorityAnalysis', e.target.checked)}
                name="showPriorityAnalysis"
              />
            }
            label="Show Priority Analysis"
          />
        </Box>

        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
          Content Settings
        </Typography>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={settings.showRecentUsers} 
                onChange={(e) => onSettingChange('showRecentUsers', e.target.checked)}
                color="primary"
              />
            }
            label="Show Recent Users"
          />
          {settings.showRecentUsers && (
            <Box sx={{ pl: 2, pt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">Users to display:</Typography>
              <FormControl size="small" sx={{ width: 100 }}>
                <Select
                  value={Number(settings.usersToShow)}
                  onChange={(e) => onSettingChange('usersToShow', Number(e.target.value))}
                >
                  <MenuItem value={2}>2</MenuItem>
                  <MenuItem value={4}>4</MenuItem>
                  <MenuItem value={6}>6</MenuItem>
                  <MenuItem value={8}>8</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={settings.showRecentReports} 
                onChange={(e) => onSettingChange('showRecentReports', e.target.checked)}
                color="primary"
              />
            }
            label="Show Recent Reports"
          />
          {settings.showRecentReports && (
            <Box sx={{ pl: 2, pt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">Reports to display:</Typography>
              <FormControl size="small" sx={{ width: 100 }}>
                <Select
                  value={Number(settings.reportsToShow)}
                  onChange={(e) => onSettingChange('reportsToShow', Number(e.target.value))}
                >
                  <MenuItem value={2}>2</MenuItem>
                  <MenuItem value={3}>3</MenuItem>
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onResetSettings} color="error">
          Reset to Defaults
        </Button>
        <Button onClick={onClose} variant="contained" color="primary">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;