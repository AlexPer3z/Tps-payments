import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔹 Ajuste para Render: usar ruta absoluta desde __dirname
const trabajosPath = path.join(path.resolve(), "trabajos.json");
if (!fs.existsSync(trabajosPath)) {
  console.error("Error: trabajos.json no encontrado en", trabajosPath);
  process.exit(1);
}
const trabajos = JSON.parse(fs.readFileSync(trabajosPath, "utf-8"));

// Endpoint para enviar código al correo
app.post("/send_code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Falta el correo" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
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
    const preferenceData = { items, back_urls, payer: { email }, auto_return: "approved" };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
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
  const mpSignature = req.headers["x-meli-signature"];
  const body = JSON.stringify(req.body);

  // Verificar webhook usando la clave secreta
  const expectedSignature = crypto
    .createHmac("sha256", process.env.MP_SECRET)
    .update(body)
    .digest("hex");

  if (mpSignature !== expectedSignature) {
    console.log("Webhook no válido");
    return res.status(401).send("No autorizado");
  }

  const { type, data } = req.body;

  if (type === "payment") {
    const paymentId = data.id;

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const paymentInfo = await paymentRes.json();

    if (paymentInfo.status === "approved") {
      const email = paymentInfo.payer.email;

      // 🔹 Usar ruta absoluta del TP en Render
      const tpFilePath = path.join(path.resolve(), trabajos[0].tp);
      if (!fs.existsSync(tpFilePath)) {
        console.error("TP no encontrado:", tpFilePath);
        return res.status(500).send("TP no encontrado");
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });

      await transporter.sendMail({
        from: `"Trabajos Prácticos" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Tu Trabajo Práctico",
        text: "Gracias por tu compra. Adjuntamos el TP.",
        attachments: [{ filename: path.basename(tpFilePath), path: tpFilePath }],
      });

      console.log(`TP enviado a ${email}`);
    }
  }

  res.status(200).send("OK");
});

// Clave secreta de Mercado Pago directamente (opcional si no querés usar .env)
process.env.MP_SECRET = "f90c1b370fdb95a3fa4acefb037fc1f63f6621522e0ae0b1af49a2fa6998694b";

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
