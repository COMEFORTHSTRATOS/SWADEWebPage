/**
 * Global utility functions that can be called from anywhere in the application
 */

// Setup global function to open the Barangay Export dialog
export const setupGlobalBarangayExport = (openDialogFn) => {
  window.openBarangayExport = (address) => {
    // Extract barangay from address if possible
    const barangayName = extractBarangayFromAddress(address);
    openDialogFn(barangayName);
  };
};

// Helper function to extract barangay name from an address
const extractBarangayFromAddress = (address) => {
  if (!address) return null;
  
  // List of common QC barangays to look for
  const commonBarangays = [
    'Bagong Silangan', 'Batasan Hills', 'Commonwealth', 'Holy Spirit', 'Payatas',
    'Bagong Pag-asa', 'Bago Bantay', 'Damayang Lagi', 'Kristong Hari', 
    'Masambong', 'San Jose', 'Santa Teresita', 'San Isidro',
    'Amihan', 'Kamias', 'San Vicente', 'Silangan', 'Socorro', 'UP Village', 
    'Bagumbayan', 'Kalusugan', 'Kamuning', 'Laging Handa', 'South Triangle',
    'Fairview', 'Greater Lagro', 'Gulod', 'Kaligayahan', 'North Fairview', 
    'Novaliches', 'Pasong Putik', 'San Bartolome', 'Santa Lucia',
    'Apolonio Samson', 'Baesa', 'Balingasa', 'Balintawak', 'Culiat', 
    'Pasong Tamo', 'Sangandaan', 'Tandang Sora'
  ];
  
  // Try to find a matching barangay
  for (const barangay of commonBarangays) {
    if (address.toLowerCase().includes(barangay.toLowerCase())) {
      return barangay;
    }
  }
  
  // If no specific barangay found, check for variations of Brgy./Barangay indicator
  const brgyMatch = address.match(/brgy\.?\s+([a-z0-9\s]+?)(?:,|\s+(?:quezon|qc))/i);
  if (brgyMatch && brgyMatch[1]) {
    return brgyMatch[1].trim();
  }
  
  // Return null if no barangay could be extracted
  return null;
};

// Clean up global functions when no longer needed
export const cleanupGlobalFunctions = () => {
  delete window.openBarangayExport;
};
