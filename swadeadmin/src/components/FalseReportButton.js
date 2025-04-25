import React, { useState } from 'react';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
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
  
  // Check if the report is already marked as false
  const isAlreadyMarked = item.isFalseReport === true;
  
  const handleOpenDialog = () => {
    setDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setDialogOpen(false);
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
    
    setIsProcessing(true);
    try {
      // Get Firestore instance
      const db = getFirestore();
      
      // Create reference to the report document
      const reportRef = doc(db, collection, item.id);
      
      // Determine new validity state (toggle current state)
      const newIsInvalid = !isAlreadyMarked;
      const newStatus = newIsInvalid ? 'invalid' : 'valid';
      
      // Prepare update data
      const updateData = {
        isFalseReport: newIsInvalid,
        statusChangedAt: new Date(),
        status: newIsInvalid ? 'rejected' : 'approved'
      };
      
      // If marking as invalid, set markedFalseAt timestamp
      if (newIsInvalid) {
        updateData.markedFalseAt = new Date();
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
        console.log(`Calling onSuccess with: ${item.id}, ${newStatus}`);
        
        // Add small delay to avoid UI race conditions
        setTimeout(() => {
          onSuccess(item.id, newStatus);
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
      >
        <DialogTitle>
          {isAlreadyMarked ? 'Mark Report as Valid?' : 'Mark Report as Invalid?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isAlreadyMarked ? (
              <>
                This action will mark this report as valid. This will reverse the previous invalid status.
                <br /><br />
                The report will be treated as a normal valid report in the system.
              </>
            ) : (
              <>
                This action will mark this report as invalid or false. This is typically done for 
                reports with inaccurate information, spam, or content that violates guidelines.
                <br /><br />
                The report will still be visible but will be flagged in the system.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleToggleValidity} 
            color={isAlreadyMarked ? "success" : "error"} 
            disabled={isProcessing}
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
