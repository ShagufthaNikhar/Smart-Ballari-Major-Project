const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from:    process.env.MAIL_FROM,
    to, subject, html
  });
}

module.exports = { sendMail };