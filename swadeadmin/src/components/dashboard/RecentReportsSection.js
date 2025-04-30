import React from 'react';
import { 
  Card, CardContent, Typography, Box, List, ListItem, 
  ListItemText, ListItemIcon, Button, Divider 
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AttachmentIcon from '@mui/icons-material/Attachment';
import FeedIcon from '@mui/icons-material/Feed';
import { useNavigate } from 'react-router-dom';

const RecentReportsSection = ({ reports, reportsToShow = 5 }) => {
  const navigate = useNavigate();
  
  // Convert reportsToShow to a number and ensure it's valid
  const numReportsToShow = Number(reportsToShow) || 5;
  
  // Limit the number of reports to display based on settings
  const displayedReports = reports.slice(0, numReportsToShow);
  
  // Function to get a shortened report identifier from the ID
  const getShortReportId = (reportId) => {
    if (!reportId) return 'Unknown';
    // Get first 4 characters of the report ID
    return "#" + reportId.toString().substring(0, 4).toUpperCase();
  };
  
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FeedIcon sx={{ mr: 1, color: '#6014cc' }} />
            <Typography variant="h6" sx={{ color: '#6014cc', fontWeight: 'medium', mb: 0 }}>
              Recent Reports
            </Typography>
          </Box>
          <Button 
            size="small" 
            color="primary"
            onClick={() => navigate('/reports')}
          >
            All Reports
          </Button>
        </Box>
        <List>
          {displayedReports.length > 0 ? displayedReports.map((report) => (
            <React.Fragment key={report.id}>
              <ListItem 
                alignItems="flex-start"
                sx={{ px: 1, py: 1.5 }}
                secondaryAction={
                  <Button 
                    startIcon={<AttachmentIcon />} 
                    size="small" 
                    href={report.url}
                    target="_blank"
                    sx={{ fontSize: '0.75rem' }}
                  >
                    View
                  </Button>
                }
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <DescriptionIcon sx={{ color: '#6014cc' }} />
                </ListItemIcon>
                <ListItemText
                  primary={`Report ${getShortReportId(report.id)}`}
                  secondary={
                    <React.Fragment>
                      <Typography
                        component="span"
                        variant="body2"
                        color="textSecondary"
                      >
                        {report.type} • {report.date}
                      </Typography>
                    </React.Fragment>
                  }
                />
              </ListItem>
              {report.id !== displayedReports[displayedReports.length-1].id && <Divider component="li" />}
            </React.Fragment>
          )) : (
            <ListItem>
              <ListItemText primary="No reports found" />
            </ListItem>
          )}
        </List>
      </CardContent>
    </Card>
  );
};

export default RecentReportsSection;