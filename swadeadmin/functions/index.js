const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Get email credentials from Firebase config
const emailUser = functions.config().email?.user || process.env.EMAIL_USER;
const emailPass = functions.config().email?.password || process.env.EMAIL_PASSWORD;

// Log whether we have credentials
console.log(`Email credentials available: User ${emailUser ? 'YES' : 'NO'}, Password ${emailPass ? 'YES' : 'NO'}`);

// Configure the email transport
const transporter = nodemailer.createTransport({
  service: 'gmail',  // Or another email service
  auth: {
    user: emailUser,
    pass: emailPass
  }
});

// HTTP function for manual email sending
exports.sendAccountDisabledEmail = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    // Handle preflight request
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  
  try {
    // Log the request for debugging
    console.log('Received email request:', req.body);
    
    const { email, name, userId } = req.body;
    
    if (!email) {
      console.error('Missing email in request');
      return res.status(400).send({ error: 'Email is required' });
    }
    
    if (!emailUser || !emailPass) {
      console.error('Missing email credentials - check Firebase config');
      return res.status(500).send({ 
        error: 'Server configuration error - email credentials not available'
      });
    }
    
    // Add deployment timestamp for version tracking
    const deploymentTimestamp = Date.now();
    console.log(`Function execution timestamp: ${deploymentTimestamp}`);
    
    const mailOptions = {
      from: `"SWADE Admin" <${emailUser}>`,
      to: email,
      subject: 'Your Account Has Been Disabled',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #6014cc;">Account Notification</h2>
          <p>Hello ${name || 'User'},</p>
          <p>We regret to inform you that your account has been disabled by an administrator.</p>
          <p>If you believe this was done in error or would like to appeal this decision, please contact our support team.</p>
          <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
            This is an automated message. Please do not reply directly to this email.
          </p>
        </div>
      `
    };
    
    console.log(`Attempting to send email to ${email} from ${emailUser}`);
    await transporter.sendMail(mailOptions);
    
    // Log the email sending for auditing purposes
    console.log(`Account disabled notification email sent to ${email} for user ${userId}`);
    
    res.status(200).send({ success: true, message: 'Email notification sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send({ 
      error: 'Failed to send email notification', 
      details: error.message,
      stack: error.stack
    });
  }
});

// Firestore trigger for user status change (v1 syntax)
exports.userStatusChangeEmailNotifier = functions.firestore
  .document('users/{userId}')
  .onUpdate((change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userId = context.params.userId;
    
    // Only send email if status changed from enabled to disabled
    if (beforeData.status === 'enabled' && afterData.status === 'disabled') {
      const email = afterData.email;
      const name = afterData.fullName || afterData.displayName || afterData.name || 'User';

      if (!email) {
        console.error(`No email found for user ${userId}`);
        return null;
      }

      if (!emailUser || !emailPass) {
        console.error('Missing email credentials - check Firebase config');
        return null;
      }

      const mailOptions = {
        from: `"SWADE Admin" <${emailUser}>`,
        to: email,
        subject: 'Your Account Has Been Disabled',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #6014cc;">Account Notification</h2>
            <p>Hello ${name},</p>
            <p>We regret to inform you that your account has been disabled by an administrator.</p>
            <p>If you believe this was done in error or would like to appeal this decision, please contact our support team.</p>
            <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
              This is an automated message. Please do not reply directly to this email.
            </p>
          </div>
        `
      };

      console.log(`Attempting to send email to ${email} from ${emailUser}`);
      return transporter.sendMail(mailOptions)
        .then(() => {
          console.log(`Account disabled notification email sent to ${email} for user ${userId}`);
          return null;
        })
        .catch(error => {
          console.error('Error sending email:', error);
          return null;
        });
    }
    
    return null;
  });
