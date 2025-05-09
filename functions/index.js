const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const cors = require('cors')({origin: true});

// Use v1 syntax for functions to avoid unknown trigger issue
exports.sendAccountDisabledEmail = functions.https.onRequest((req, res) => {
  // Use cors middleware
  return cors(req, res, async () => {
    try {
      // Add this log to force change detection
      console.log('Email function triggered:', new Date().toISOString());
      
      // Get email credentials inside the function execution
      const emailConfig = functions.config().email || {};
      const emailUser = emailConfig.user || process.env.EMAIL_USER;
      const emailPass = emailConfig.password || process.env.EMAIL_PASSWORD;
      
      console.log('Request received:', req.method, req.path, req.body);
      console.log('Email config status:', emailUser ? 'Email set' : 'No email', 
                  emailPass ? 'Password set' : 'No password');
      
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      
      const { email, name, userId } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      if (!emailUser || !emailPass) {
        console.error('Missing email credentials - check Firebase config');
        return res.status(500).json({ 
          error: 'Server configuration error - email credentials not available'
        });
      }
      
      // Create transporter inside function execution for better reliability
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });
      
      const mailOptions = {
        from: `"SWADE Admin" <${emailUser}>`,
        to: email,
        subject: 'Your Account Has Been Disabled',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #6014cc;">Account Notification</h2>
            <p>Hello ${name || 'User'},</p>
            <p>We regret to inform you that your account has been disabled.</p>
            <p>If you believe this was done in error or would like to appeal this decision, please contact our support team.</p>
            <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
              This is an automated message. Please do not reply directly to this email.
            </p>
          </div>
        `
      };
      
      console.log(`Attempting to send email to ${email}`);
      await transporter.sendMail(mailOptions);
      
      console.log(`Email sent successfully to ${email} for user ${userId}`);
      return res.status(200).json({ 
        success: true, 
        message: 'Email notification sent successfully',
        timestamp: Date.now() // Add this line to force change detection
      });
    } catch (error) {
      console.error('Error sending email:', error);
      return res.status(500).json({ error: 'Failed to send email notification', details: error.message });
    }
  });
});

// Change the function name to make it distinct
exports.onUserStatusChange = functions.firestore
  .document('users/{userId}')
  .onUpdate((change, context) => {
    // Get the data before and after the update
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userId = context.params.userId;
    
    // Only send email if status changed from enabled to disabled
    if (beforeData.status === 'enabled' && afterData.status === 'disabled') {
      console.log(`User ${userId} was disabled - sending notification email`);
      
      // Get email credentials from Firebase config
      const emailConfig = functions.config().email || {};
      const emailUser = emailConfig.user || process.env.EMAIL_USER;
      const emailPass = emailConfig.password || process.env.EMAIL_PASSWORD;
      
      // Email sending logic
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });
      
      const mailOptions = {
        from: `"SWADE Admin" <${emailUser}>`,
        to: afterData.email,
        subject: 'Your Account Has Been Disabled',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #6014cc;">Account Notification</h2>
            <p>Hello ${afterData.fullName || afterData.displayName || 'User'},</p>
            <p>We regret to inform you that your account has been disabled.</p>
            <p>If you believe this was done in error or would like to appeal this decision, please contact our support team.</p>
          </div>
        `
      };
      
      // Send the email
      return transporter.sendMail(mailOptions)
        .then(result => {
          console.log(`Email sent to ${afterData.email}:`, result);
          return null;
        })
        .catch(error => {
          console.error('Error sending email:', error);
          return null;
        });
    }
    
    // No status change to disabled, so do nothing
    return null;
  });
