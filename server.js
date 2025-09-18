import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Endpoint para enviar código al correo
app.post("/send_code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Falta el correo" });

  // Generar código
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Configuración de transporte
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // tu correo Gmail
        pass: process.env.EMAIL_PASS, // contraseña o App Password
      },
    });

    // Enviar mail
    await transporter.sendMail({
      from: `"Trabajos Prácticos" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Código de verificación",
      text: `Tu código de verificación es: ${code}`,
    });

    res.json({ message: "Código enviado" }); // ⚠️ en prod no devolver el código!
  } catch (error) {
    console.error("Error enviando correo:", error);
    res.status(500).json({ error: "No se pudo enviar el correo" });
  }
});

// Endpoint Mercado Pago
app.post("/create_preference", async (req, res) => {
  try {
    const { items, back_urls } = req.body;

    const preferenceData = {
      items,
      back_urls,
      auto_return: "approved",
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceData),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error creating preference:", error);
    res.status(500).json({ error: "Error creating preference" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
