const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GOOGLE_SA_USERNAME,
    pass: process.env.GOOGLE_APP_PASSWORD
  }
});

const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('Email service connected successfully');
  } catch (error) {
    console.error('Email service connection error:', error);
    throw error;
  }
};

verifyConnection();

const sendEmail = async ({ to, subject, html }) => {
  try {
    const mailOptions = {
      from: process.env.GOOGLE_SA_USERNAME,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

const getShareInviteEmail = ({ list, senderName, email, inviteLink }) => {
  return {
    to: email,
    subject: `${senderName} shared a wishlist with you`,
    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      ">
        <h2 style="color: #333; margin-bottom: 16px;">
          ${list.name}
        </h2>

        <div style="margin-bottom: 24px;">
          ${list.description ? 
            `<p style="color: #666; font-style: italic; margin: 0 0 16px;">
              "${list.description}"
            </p>` : 
            ''
          }
        </div>

        <p style="color: #444; line-height: 1.5;">
          ${senderName} has shared their wishlist with you. Click the button below to view the list.
        </p>

        <a 
          href="${inviteLink}" 
          style="
            display: inline-block;
            background-color: #1976d2;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 16px 0;
          "
        >
          View Wishlist
        </a>

        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          If you can't click the button, copy and paste this link into your browser:<br>
          <a href="${inviteLink}" style="color: #1976d2;">${inviteLink}</a>
        </p>
      </div>
    `
  };
};

module.exports = {
  sendEmail,
  getShareInviteEmail
}; 