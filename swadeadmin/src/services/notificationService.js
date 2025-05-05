import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';

// Simple notification service with consistent API
class NotificationService {
  constructor() {
    this.unsubscribe = null;
    this.lastSeen = localStorage.getItem('lastSeenUpload') 
      ? new Date(localStorage.getItem('lastSeenUpload')) 
      : new Date();
    this.newUploadsCount = 0;
    this.originalTitle = document.title;
    this.callbacks = [];
  }

  // Start listening for new uploads
  startNotifications() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    // Convert lastSeen to Firestore Timestamp
    const lastSeenTimestamp = Timestamp.fromDate(this.lastSeen);

    // Create a query for uploads newer than last seen
    const uploadsCollection = collection(db, 'uploads');
    const uploadsQuery = query(
      uploadsCollection,
      where('createdAt', '>', lastSeenTimestamp),
      orderBy('createdAt', 'desc')
    );

    // Set up real-time listener
    this.unsubscribe = onSnapshot(uploadsQuery, (snapshot) => {
      // Filter out local changes
      const newUploads = snapshot.docChanges()
        .filter(change => change.type === 'added' && !change.doc.metadata.hasPendingWrites);
      
      if (newUploads.length > 0) {
        this.newUploadsCount += newUploads.length;
        this.updateTabNotification();
        
        // Notify any component that subscribed to notification events
        this.callbacks.forEach(callback => callback(this.newUploadsCount));
      }
    }, (error) => {
      console.error('Error in uploads notification listener:', error);
    });

    console.log('[Notification] Started listening for new uploads');
    return this;
  }

  // Update the browser tab with notification count
  updateTabNotification() {
    if (this.newUploadsCount > 0) {
      document.title = `(${this.newUploadsCount}) ${this.originalTitle}`;
    } else {
      document.title = this.originalTitle;
    }
  }

  // Mark current time as the last seen time
  markAsSeen() {
    this.lastSeen = new Date();
    localStorage.setItem('lastSeenUpload', this.lastSeen.toISOString());
    this.newUploadsCount = 0;
    this.updateTabNotification();
    
    // Notify subscribers that count was reset
    this.callbacks.forEach(callback => callback(0));
    
    console.log('[Notification] Marked uploads as seen');
  }

  // Subscribe to notification updates
  subscribe(callback) {
    this.callbacks.push(callback);
    // Immediately notify with current count
    callback(this.newUploadsCount);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  // Clean up listeners
  stopNotifications() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      console.log('[Notification] Stopped listening for new uploads');
    }
  }

  // Method to register a callback for notifications
  registerCallback(callback) {
    this.callbacks.push(callback);
  }

  // Add a notify method to maintain compatibility with the new code
  notify(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Use alert for simple visual feedback if nothing else available
    if (this.callbacks.length === 0) {
      if (type === 'error') {
        alert(`Error: ${message}`);
      } else if (type === 'success') {
        alert(`Success: ${message}`);
      }
    }
    
    // Call any registered callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(message, type);
      } catch (e) {
        console.error('Error in notification callback:', e);
      }
    });
    
    // Make the notification available globally for components to use
    window.showToast = (msg, msgType) => this.notify(msg, msgType);
    
    return true;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
