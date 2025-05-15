import React, { useState } from 'react';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import VerifiedIcon from '@mui/icons-material/Verified';
import { getFirestore, doc, updateDoc, getDoc, increment } from 'firebase/firestore';

/**
 * Button component for marking a report as false/invalid
 * @param {Object} props Component props
 * @param {Object} props.item Report item to be marked
 * @param {String} props.collection Collection name where the report is stored
 * @param {Function} props.onSuccess Callback function after successfully marking report
 */
const FalseReportButton = ({ item, collection = 'reports', onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [remarksError, setRemarksError] = useState(false);
  
  // Check if the report is already marked as false
  const isAlreadyMarked = item.isFalseReport === true;
  
  const handleOpenDialog = () => {
    setDialogOpen(true);
    setRemarks(item.invalidRemarks || '');
    setRemarksError(false);
  };
  
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setRemarks('');
    setRemarksError(false);
  };
  
  const handleRemarksChange = (event) => {
    setRemarks(event.target.value);
    if (event.target.value.trim()) {
      setRemarksError(false);
    }
  };
  
  // Function to add a strike to the user who uploaded the report
  const updateUserStrikes = async (userId, addStrike) => {
    if (!userId) {
      console.warn('Cannot update user strikes: Missing user ID');
      return;
    }
    
    try {
      const db = getFirestore();
      const userRef = doc(db, 'users', userId);
      
      // First check if the user exists
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        console.warn(`User ${userId} not found, cannot update strikes`);
        return;
      }
      
      // Update user document with strike information
      await updateDoc(userRef, {
        strikes: addStrike ? increment(1) : increment(-1),
        lastStrikeDate: addStrike ? new Date() : userSnap.data().lastStrikeDate,
      });
      
      console.log(`User ${userId} strikes ${addStrike ? 'increased' : 'decreased'}`);
    } catch (error) {
      console.error('Error updating user strikes:', error);
    }
  };
  
  const handleToggleValidity = async () => {
    if (!item.id) {
      console.error('Cannot update report validity: Missing item ID');
      return;
    }
    
    // Check if remarks are required (when marking as invalid) and present
    const newIsInvalid = !isAlreadyMarked;
    if (newIsInvalid && !remarks.trim()) {
      setRemarksError(true);
      return;
    }
    
    setIsProcessing(true);
    try {
      // Get Firestore instance
      const db = getFirestore();
      
      // Create reference to the report document
      const reportRef = doc(db, collection, item.id);
      
      // Determine new validity state (toggle current state)
      const newStatus = newIsInvalid ? 'invalid' : 'valid';
      
      // Prepare update data
      const updateData = {
        isFalseReport: newIsInvalid,
        statusChangedAt: new Date(),
        status: newIsInvalid ? 'rejected' : 'approved'
      };
      
      // If marking as invalid, set markedFalseAt timestamp and invalidRemarks
      if (newIsInvalid) {
        updateData.markedFalseAt = new Date();
        updateData.invalidRemarks = remarks.trim();
      } else {
        // If marking as valid again, clear the invalidRemarks field
        updateData.invalidRemarks = null;
      }
      
      // Log the update before sending
      console.log(`Updating report ${item.id} with data:`, updateData);
      
      // Update the document with new validity state
      await updateDoc(reportRef, updateData);
      
      console.log(`Report ${item.id} validity toggled to ${newStatus} (isInvalid=${newIsInvalid})`);
      
      // Update user strikes if we have a userId
      if (item.userId) {
        await updateUserStrikes(item.userId, newIsInvalid);
      } else if (item.uploaderId) {
        await updateUserStrikes(item.uploaderId, newIsInvalid);
      } else {
        console.warn('No userId found in the report, cannot update strikes');
      }
      
      // Close the dialog before calling onSuccess to avoid UI conflicts
      handleCloseDialog();
      
      // Call success callback if provided - with explicit delay to ensure UI updates properly
      if (onSuccess) {
        console.log(`Calling onSuccess with: ${item.id}, ${newStatus}, ${remarks}`);
        
        // Add small delay to avoid UI race conditions
        setTimeout(() => {
          onSuccess(item.id, newStatus, newIsInvalid ? remarks : null);
        }, 50);
      }
    } catch (error) {
      console.error('Error updating report validity:', error);
      alert(`Error updating report: ${error.message}`);
      handleCloseDialog();
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <>
      <Button 
        size="small"
        onClick={handleOpenDialog}
        disabled={isProcessing}
        startIcon={isProcessing ? 
          <CircularProgress size={16} /> : 
          (isAlreadyMarked ? <VerifiedIcon /> : <FlagIcon />)
        }
        sx={{ 
          color: isAlreadyMarked ? 'success.main' : 'error.main',
          mr: 1,
          ...(isAlreadyMarked && {
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(76, 175, 80, 0.2)',
            }
          })
        }}
        title={isAlreadyMarked ? 'Mark as valid report' : 'Mark as invalid report'}
        variant={isAlreadyMarked ? "outlined" : "text"}
      >
        {isProcessing ? 'Processing...' : (isAlreadyMarked ? 'Mark as Valid' : 'Mark Invalid')}
      </Button>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isAlreadyMarked ? 'Mark Report as Valid?' : 'Mark Report as Invalid?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isAlreadyMarked ? (
              <>     
              </>
            ) : (
              <>
                Please provide the reason why this report is being marked as invalid:
              </>
            )}
          </DialogContentText>
          
          {/* Add remarks field when marking as invalid */}
          {!isAlreadyMarked && (
            <TextField
              autoFocus
              margin="dense"
              id="remarks"
              label="Reason for marking invalid"
              type="text"
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              value={remarks}
              onChange={handleRemarksChange}
              required
              error={remarksError}
              helperText={remarksError ? "Please provide a reason for marking this report as invalid" : ""}
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleToggleValidity} 
            color={isAlreadyMarked ? "success" : "error"} 
            disabled={isProcessing || (!isAlreadyMarked && !remarks.trim())}
            startIcon={isProcessing && <CircularProgress size={16} />}
          >
            {isProcessing ? 'Processing...' : (isAlreadyMarked ? 'Mark as Valid' : 'Mark as Invalid')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FalseReportButton;
