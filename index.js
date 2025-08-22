import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import bodyParser from "body-parser";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Cargar tu catálogo de SSRs desde ssrs.json
const ssrCatalog = JSON.parse(fs.readFileSync("./ssrs.json", "utf-8"));

app.post("/ssr", async (req, res) => {
  const inputText = req.body.text || ""; // Ej: "-s MAAS, PETC"
  const isShort = inputText.trim().startsWith("-s");
  const rawSsrList = isShort ? inputText.replace("-s", "").trim() : inputText.trim();

  // Limpiar, separar y normalizar los SSRs ingresados
  const ssrCodes = rawSsrList.split(",").map(code => code.trim().toUpperCase());

  if (isShort) {
    // RESPUESTA CORTA: Buscar en el JSON
    const result = {};
    ssrCodes.forEach(code => {
      result[code] = ssrCatalog[code] || "Código no reconocido";
    });
    return res.json(result);
  } else {
    // RESPUESTA LARGA: Enviar a OpenAI con catálogo incluido
    const catalogText = Object.entries(ssrCatalog)
      .map(([code, desc]) => `${code}: ${desc}`)
      .join("\n");

    const prompt = `
Eres un asistente de atención al cliente de una aerolínea. Usa el siguiente catálogo de SSRs como base:

${catalogText}

Con base en esta entrada: ${ssrCodes.join(", ")}

Devuelve una explicación clara y útil de cada SSR para el equipo de atención o el agente. Responde en lenguaje profesional, breve y sin exageraciones.`;

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const answer = response.data.choices[0].message.content;
      return res.send(answer);
    } catch (error) {
      console.error("Error con OpenAI:", error?.response?.data || error.message);
      console.log("🔐 Clave de OpenAI:", process.env.OPENAI_API_KEY);
      return res.status(500).send("Error al generar respuesta con OpenAI.");
      
    }
  }
});

app.get("/", (req, res) => {
  res.send("✅ Volaris SSR Bot activo.");
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});