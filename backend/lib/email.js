import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "email-smtp.ap-south-1.amazonaws.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASS
  }
});

export async function sendEmail(to, subject, html) {
  return transporter.sendMail({
    from: "noreply@hriatrengna.in",
    to,
    subject,
    html
  });
}
