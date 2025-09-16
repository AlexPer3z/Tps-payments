import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Endpoint para crear preferencia
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
