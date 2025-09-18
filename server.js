import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Cargar trabajos.json
const trabajosPath = path.join(process.cwd(), "trabajos.json");
const trabajos = JSON.parse(fs.readFileSync(trabajosPath, "utf-8"));

// Endpoint para enviar código al correo (solo código)
app.post("/send_code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Falta el correo" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Trabajos Prácticos" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Código de verificación",
      text: `Tu código de verificación es: ${code}`,
    });

    res.json({ message: "Código enviado", code });
  } catch (err) {
    console.error("Error enviando correo:", err);
    res.status(500).json({ error: "No se pudo enviar el correo" });
  }
});

// Endpoint Mercado Pago
app.post("/create_preference", async (req, res) => {
  try {
    const { items, back_urls, email } = req.body;

    const preferenceData = {
      items,
      back_urls,
      payer: { email },
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

// Webhook para recibir notificaciones de pago
app.post("/mp_webhook", async (req, res) => {
  const { type, data } = req.body;

  if (type === "payment") {
    const paymentId = data.id;

    // Obtener info del pago desde Mercado Pago
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const paymentInfo = await paymentRes.json();

    if (paymentInfo.status === "approved") {
      const email = paymentInfo.payer.email;

      // Enviar TP al correo
      const tpFilePath = path.join(process.cwd(), trabajos[0].tp);
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"Trabajos Prácticos" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Tu Trabajo Práctico",
        text: "Gracias por tu compra. Adjuntamos el TP.",
        attachments: [
          {
            filename: path.basename(tpFilePath),
            path: tpFilePath,
          },
        ],
      });

      console.log(`TP enviado a ${email}`);
    }
  }

  res.status(200).send("OK");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
