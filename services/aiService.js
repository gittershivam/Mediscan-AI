// Add this at the top if not already there
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const MODEL_NAME = "gemini-flash-latest"; 

async function analyzeText(text, mode) {
  let prompt;


  const guidanceInstruction = `
    CRITICAL EVALUATION: Before the main explanation, analyze the report values and start your response with exactly ONE of these three HTML headers:
    
    1. <h2 class="status-green">🟢 No Immediate Concern</h2>
       (Use if results are within acceptable/normal ranges.)
    2. <h2 class="status-yellow">🟡 Monitor & Take Preventive Action</h2>
       (Use if mild deviations are detected or lifestyle adjustments are recommended.)
    3. <h2 class="status-red">🔴 Consult a Healthcare Professional</h2>
       (Use if significant abnormalities are identified.)
    
    Do not add any text before this header.
  `;

  if (mode === "simple") {
    prompt = `
      ${guidanceInstruction}
      You are a compassionate medical assistant explaining a medical report to a patient.
      
      Rules:
      1. Analyze the following medical report text.
      2. Explain findings in very simple language.
      3. Use bullet points for clarity.
      4. FORMATTING: Return raw HTML (<h3>, <ul>, <li>, <strong>). No Markdown.

      Report Text:
      ${text}
    `;
  } else {
    prompt = `
      ${guidanceInstruction}
      You are a senior medical consultant assisting a general practitioner.
      
      Rules:
      1. Analyze the following medical report text.
      2. Provide structured clinical assessment (Observations, Differentials, Next Steps).
      3. Use professional medical terminology.
      4. FORMATTING: Return raw HTML (<h3>, <ul>, <li>). No Markdown.

      Report Text:
      ${text}
    `;
  }

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const response = result.response || result;

    if (typeof response.text === 'function') {
      return response.text();
    } else if (response.candidates && response.candidates[0].content.parts[0].text) {
      return response.candidates[0].content.parts[0].text;
    } else {
      return "<p>Error: Could not extract explanation.</p>";
    }

  } catch (error) {
    console.error("AI Service Error:", error);
    
    if (error.status === 429) {
        return "<p><strong>System Busy:</strong> Too many requests. Please wait a minute and try again.</p>";
    }
    return `<p>Error generating analysis: ${error.message}</p>`;
  }
}


async function analyzeImage(filePath, mode) {
  const guidanceInstruction = `
    CRITICAL EVALUATION: Before the main explanation, analyze the report values and start your response with exactly ONE of these three HTML headers:
    
    1. <h2 class="status-green">🟢 No Immediate Concern</h2>
    2. <h2 class="status-yellow">🟡 Monitor & Take Preventive Action</h2>
    3. <h2 class="status-red">🔴 Consult a Healthcare Professional</h2>
    
    Do not add any text before this header.
  `;

  let modeInstruction;
  if (mode === "simple") {
    modeInstruction = `
      You are a compassionate medical assistant explaining a medical report to a patient.
      Explain findings in very simple language. Use bullet points.
      FORMATTING: Return raw HTML (<h3>, <ul>, <li>, <strong>). No Markdown.
    `;
  } else {
    modeInstruction = `
      You are a senior medical consultant assisting a general practitioner.
      Provide structured clinical assessment (Observations, Differentials, Next Steps).
      Use professional medical terminology.
      FORMATTING: Return raw HTML (<h3>, <ul>, <li>). No Markdown.
    `;
  }

  // Read the image and convert to base64
  const imageData = fs.readFileSync(filePath);
  const base64Image = imageData.toString("base64");

  // Detect MIME type from extension
  const ext = filePath.split(".").pop().toLowerCase();
  const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
  const mimeType = mimeMap[ext] || "image/jpeg";

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
            {
              text: `${guidanceInstruction}\n${modeInstruction}\nAnalyze this medical report image.`,
            },
          ],
        },
      ],
    });

    const response = result.response || result;
    if (typeof response.text === "function") return response.text();
    if (response.candidates?.[0]?.content?.parts?.[0]?.text)
      return response.candidates[0].content.parts[0].text;
    return "<p>Error: Could not extract explanation.</p>";

  } catch (error) {
    console.error("Image Analysis Error:", error);
    if (error.status === 429)
      return "<p><strong>System Busy:</strong> Too many requests. Please wait and try again.</p>";
    return `<p>Error analyzing image: ${error.message}</p>`;
  }
}


async function translateText(htmlText, targetLanguage) {
  const prompt = `
    You are a professional medical translator.
    
    Task:
    Translate the following HTML content into ${targetLanguage}.
    
    CRITICAL RULES:
    1. STRICTLY PRESERVE all HTML tags (<h3>, <ul>, <li>, <strong>, etc.). Do not remove or change them.
    2. Only translate the human-readable text inside the tags.
    3. Keep medical terms accurate for the target language.
    4. Return ONLY the translated HTML. No preamble.

    Input HTML:
    ${htmlText}
  `;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });

    const response = result.response || result;

    if (typeof response.text === 'function') {
      return response.text();
    } 

    else if (response.candidates && response.candidates[0].content.parts[0].text) {
      return response.candidates[0].content.parts[0].text;
    } 
    else {
      console.error("Translation Response structure issue:", JSON.stringify(response, null, 2));
      return htmlText; 
    }
    
  } catch (error) {
    console.error("Translation Error:", error);
    if (error.status === 429) {
        console.log("Quota exceeded during translation.");
    }
    return htmlText; 
  }
}

async function chatWithReport(reportContext, chatHistory, userMessage) {
  
  // Build conversation history for Gemini
  const contents = [];

  // First message always includes the report context
  contents.push({
    role: "user",
    parts: [{ text: `
      You are MediScan AI, a helpful medical assistant.
      The user has uploaded a medical report. Here is the analysis already done on it:
      
      ${reportContext}
      
      Now answer the user's questions based on this report and your general medical knowledge.
      
      RULES:
      1. Be helpful, clear and empathetic.
      2. If asked about values in the report, refer to them specifically.
      3. For general medical questions, answer accurately.
      4. Always remind user to consult a doctor for serious concerns.
      5. FORMATTING: Use simple HTML (<p>, <strong>, <ul>, <li>). No Markdown.
      6. Keep responses concise — 3 to 5 lines max unless detail is needed.
    `}]
  });

  contents.push({
    role: "model",
    parts: [{ text: "<p>Understood! I've reviewed the report. What would you like to know?</p>" }]
  });

  // Add previous chat history
  chatHistory.forEach(msg => {
    contents.push({
      role: msg.role,
      parts: [{ text: msg.text }]
    });
  });

  // Add the new user message
  contents.push({
    role: "user",
    parts: [{ text: userMessage }]
  });

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents
    });

    const response = result.response || result;
    if (typeof response.text === "function") return response.text();
    if (response.candidates?.[0]?.content?.parts?.[0]?.text)
      return response.candidates[0].content.parts[0].text;
    return "<p>Sorry, I couldn't generate a response.</p>";

  } catch (error) {
    console.error("Chat Error:", error);
    if (error.status === 429)
      return "<p>System busy. Please wait a moment and try again.</p>";
    return `<p>Error: ${error.message}</p>`;
  }
}

// Don't forget to export it:
module.exports = { analyzeText, analyzeImage, translateText, chatWithReport };