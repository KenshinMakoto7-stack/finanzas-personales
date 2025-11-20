import nodemailer from "nodemailer";

// Configuración del transporter de email
// En producción, usa variables de entorno para credenciales
const createTransporter = () => {
  // Configuración para Gmail (puedes cambiar a otro proveedor)
  // Para usar Gmail, necesitas una "App Password" en lugar de tu contraseña normal
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true para 465, false para otros puertos
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });

  return transporter;
};

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  // Si no hay configuración de email, mostrar en consola (desarrollo)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`\n=== RECUPERACIÓN DE CONTRASEÑA ===`);
    console.log(`Email: ${email}`);
    console.log(`URL: ${resetUrl}`);
    console.log(`===================================\n`);
    console.log("⚠️  Para enviar emails reales, configura SMTP_USER y SMTP_PASS en .env");
    return;
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Finanzas Personales" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Recuperación de Contraseña - Finanzas Personales",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Recuperación de Contraseña</h1>
            </div>
            <div class="content">
              <p>Hola,</p>
              <p>Recibimos una solicitud para recuperar tu contraseña. Si fuiste tú, haz clic en el botón siguiente para restablecerla:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
              </p>
              <p>O copia y pega este enlace en tu navegador:</p>
              <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
              <p><strong>Este enlace expirará en 1 hora.</strong></p>
              <p>Si no solicitaste este cambio, puedes ignorar este email de forma segura.</p>
            </div>
            <div class="footer">
              <p>© Finanzas Personales - Este es un email automático, por favor no respondas.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Recuperación de Contraseña - Finanzas Personales
        
        Hola,
        
        Recibimos una solicitud para recuperar tu contraseña. Si fuiste tú, visita el siguiente enlace:
        
        ${resetUrl}
        
        Este enlace expirará en 1 hora.
        
        Si no solicitaste este cambio, puedes ignorar este email de forma segura.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de recuperación enviado a ${email}`);
  } catch (error) {
    console.error("❌ Error enviando email:", error);
    // En desarrollo, mostrar el enlace en consola como fallback
    console.log(`\n=== FALLBACK: RECUPERACIÓN DE CONTRASEÑA ===`);
    console.log(`Email: ${email}`);
    console.log(`URL: ${resetUrl}`);
    console.log(`==============================================\n`);
  }
}

