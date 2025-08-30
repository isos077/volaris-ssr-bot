import express from "express";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cargar SSRs al inicio
const ssrData = JSON.parse(fs.readFileSync("./ssrs.json", "utf-8"));

// Endpoint para recibir solicitudes desde Slack
app.post("/ssr", async (req, res) => {
  const text = req.body.text || "";
  const isShort = text.startsWith("-s ");
  const ssrCodes = (isShort ? text.slice(3) : text).split(/[ ,]+/).filter(Boolean);

  const known = [];
  const unknown = [];

  for (const code of ssrCodes) {
    const upper = code.toUpperCase();
    if (ssrData[upper]) {
      known.push({ code: upper, meaning: ssrData[upper] });
    } else {
      unknown.push(upper);
    }
  }

  // MODO CORTO
  if (isShort) {
    const lines = known.map((item) => `"${item.code}": "${item.meaning}"`);
    if (unknown.length > 0) {
      lines.push(`⚠️ Sin definición: ${unknown.join(", ")}`);
    }
    return res.send(lines.join("\n"));
  }

  // MODO LARGO (IA solo si hay desconocidos)
  try {
    let aiResponse = "";
    if (unknown.length > 0) {
      const prompt = `
Soy un bot que interpreta SSR (Special Service Requests) de la aerolínea Volaris.

Algunos códigos no están en el catálogo oficial. Por favor, intenta inferir su posible significado usando el contexto de vuelos comerciales **y asumiendo que los códigos están en inglés**, ya que son abreviaciones aeronáuticas.

Devuélvelo en español, y aclara que es una suposición no confirmada.

Códigos SSR a interpretar: ${unknown.join(", ")}
`;
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      aiResponse = response.data.choices[0].message.content.trim();
    }

    const knownLines = known.map(
      (item) => `✅ ${item.code}: ${item.meaning}`
    );

    const finalResponse = [...knownLines, aiResponse].filter(Boolean).join("\n\n");

    res.send(finalResponse);
  } catch (error) {
    console.error("Error al generar respuesta con OpenAI:", error.response?.data || error.message);
    res.send("❌ Error al procesar tu solicitud con OpenAI.");
  }
});

// Inicializar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Volaris SSR Bot activo en http://localhost:${PORT}`);
});