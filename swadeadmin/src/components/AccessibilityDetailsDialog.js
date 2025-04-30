import React from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Typography,
  Box,
  Divider,
  Paper,
  Grid
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const getSimplifiedDescription = (criterionName, value) => {
  if (value === undefined || value === null || value === 'Not Available') return "Not Available";
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  switch (criterionName.toLowerCase()) {
    case 'damages':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Good condition";
        case 2: return "Minor damages";
        case 3: return "Severe damages";
        default: return value;
      }
    case 'obstructions':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Clear path";
        case 2: return "Minor obstructions";
        case 3: return "Major obstructions";
        default: return value;
      }
    case 'ramps':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Good condition";
        case 2: return "Minor issues";
        case 3: return "Severe issues";
        default: return value;
      }
    case 'width':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Standard compliant";
        case 2: return "Non-compliant";
        default: return value;
      }
    default:
      return value;
  }
};

const AccessibilityDetailsDialog = ({ open, handleClose, item, accessibilityCriteriaValues }) => {
  // Add debugging for invalid report fields
  React.useEffect(() => {
    if (item && open) {
      // Enhanced debugging to verify all fields and their values
      console.log('AccessibilityDetailsDialog - Invalid Report Debug:', {
        id: item.id,
        isFalseReport: item.isFalseReport,
        status: item.status,
        invalidRemarks: item.invalidRemarks,
        typeof_invalidRemarks: typeof item.invalidRemarks,
        falseReportReason: item.falseReportReason,
        rejectionReason: item.rejectionReason,
        markedFalseAt: item.markedFalseAt,
        statusChangedAt: item.statusChangedAt,
        // Add stringified version to check for hidden characters or formatting issues
        invalidRemarks_json: JSON.stringify(item.invalidRemarks)
      });
    }
  }, [item, open]);

  // Check if report is marked as invalid using same logic as FalseReportButton
  const isReportInvalid = 
    item?.isFalseReport === true || 
    item?.status === 'rejected' || 
    item?.status === 'invalid';

  // Get remarks from any of the possible fields using same logic as FalseReportButton
  const getInvalidRemarks = () => {
    if (!item) return null;
    
    // Directly access and log the invalidRemarks field for debugging
    console.log("InvalidRemarks in getInvalidRemarks:", item.invalidRemarks);
    
    // Use a simplified approach that directly returns the field value if it exists
    const remarks = item.invalidRemarks || item.falseReportReason || item.rejectionReason;
    
    // If we have any remarks, return them
    if (remarks && remarks !== "") {
      console.log("Returning remarks:", remarks);
      return remarks;
    }
    
    console.log("No remarks found, returning default message");
    return "No reason specified";
  };

  if (!item || !accessibilityCriteriaValues) {
    return (
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#5013a7', color: 'white' }}>
          Error
        </DialogTitle>
        <DialogContent>
          <Typography color="error">
            Missing data required to display details.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  let finalVerdictValue;
  if (item.finalVerdict === false || item.FinalVerdict === false) {
    finalVerdictValue = false;
  } else if (item.finalVerdict === true || item.FinalVerdict === true) {
    finalVerdictValue = true;
  } else if (item.finalVerdict === null || item.FinalVerdict === null) {
    finalVerdictValue = false;
  } else {
    finalVerdictValue = item.finalVerdict !== undefined ? item.finalVerdict : 
                       (item.FinalVerdict !== undefined ? item.FinalVerdict : undefined);
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="accessibility-details-dialog-title"
    >
      <DialogTitle id="accessibility-details-dialog-title" sx={{ 
        bgcolor: '#5013a7', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Typography variant="h6">Accessibility Assessment Details</Typography>
        <Button 
          onClick={handleClose} 
          color="inherit" 
          sx={{ minWidth: 'auto', p: 0.5 }}
          aria-label="close"
        >
          <CloseIcon />
        </Button>
      </DialogTitle>
      
      <DialogContent dividers sx={{ bgcolor: '#f9f9f9' }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#5013a7' }}>
          {item.name || 'Accessibility Report'}
        </Typography>
        
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {/* Invalid Report Section - with improved display of invalidRemarks */}
          {isReportInvalid && (
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ 
                p: 2, 
                bgcolor: '#feeeee', 
                border: '1px solid #e53e3e',
                mb: 2
              }}>
                <Typography variant="h6" gutterBottom sx={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 'bold', 
                  color: '#e53e3e'
                }}>
                  This Report Has Been Marked as Invalid
                </Typography>
                
                {item.markedFalseAt && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Marked invalid on: {new Date(item.markedFalseAt.seconds * 1000).toLocaleString()}
                  </Typography>
                )}
                
                <Divider sx={{ my: 1 }} />
                
                <Typography variant="subtitle2" color="error" gutterBottom sx={{ fontWeight: 'medium' }}>
                  Reason:
                </Typography>
                <Typography variant="body2" sx={{ 
                  whiteSpace: 'pre-wrap',
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid #ffcccc'
                }}>
                  {
                    (() => {
                      // Debug log right before rendering
                      console.log("Rendering invalidRemarks:", {
                        value: item.invalidRemarks,
                        type: typeof item.invalidRemarks,
                        keys: Object.keys(item)
                      });
                      if (typeof item.invalidRemarks === "string" && item.invalidRemarks.trim() !== "") {
                        return item.invalidRemarks;
                      }
                      if (item.invalidRemarks !== undefined && item.invalidRemarks !== null) {
                        // Show raw value and type for debugging
                        return (
                          <>
                            <span style={{color: 'red'}}>Non-string value:</span>
                            <pre>{JSON.stringify(item.invalidRemarks, null, 2)}</pre>
                            <span>Type: {typeof item.invalidRemarks}</span>
                          </>
                        );
                      }
                      return "No reason specified";
                    })()
                  }
                </Typography>
              </Paper>
            </Grid>
          )}
          
          {/* Damages Assessment */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" color="#5013a7" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                Damages Assessment
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium' }}>
                Rating: {getSimplifiedDescription('damages', accessibilityCriteriaValues.damages?.value)}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
                {accessibilityCriteriaValues.damages?.description || "No additional details provided."}
              </Typography>
            </Paper>
          </Grid>
          
          {/* Obstructions Assessment */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" color="#5013a7" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                Obstructions Assessment
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium' }}>
                Rating: {getSimplifiedDescription('obstructions', accessibilityCriteriaValues.obstructions?.value)}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
                {accessibilityCriteriaValues.obstructions?.description || "No additional details provided."}
              </Typography>
            </Paper>
          </Grid>
          
          {/* Ramps Assessment */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" color="#5013a7" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                Ramps Assessment
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium' }}>
                Rating: {getSimplifiedDescription('ramps', accessibilityCriteriaValues.ramps?.value)}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
                {accessibilityCriteriaValues.ramps?.description || "No additional details provided."}
              </Typography>
            </Paper>
          </Grid>
          
          {/* Width Assessment */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" color="#5013a7" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                Width Assessment
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="body1" gutterBottom sx={{ fontWeight: 'medium' }}>
                Rating: {getSimplifiedDescription('width', accessibilityCriteriaValues.width?.value)}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
                {accessibilityCriteriaValues.width?.description || "No additional details provided."}
              </Typography>
            </Paper>
          </Grid>
          
          {/* Final Verdict */}
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2, bgcolor: finalVerdictValue ? '#f0fff4' : '#fff5f5', border: `1px solid ${finalVerdictValue ? '#38A169' : '#E53E3E'}` }}>
              <Typography variant="h6" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold', color: finalVerdictValue ? '#38A169' : '#E53E3E' }}>
                Assessment: {finalVerdictValue === undefined ? 'Not Available' : (finalVerdictValue ? 'Accessible' : 'Not Accessible')}
              </Typography>
              
              {item.comments && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Additional Comments:
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {item.comments}
                  </Typography>
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f3f3f3' }}>
        <Button onClick={handleClose} variant="outlined" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AccessibilityDetailsDialog;