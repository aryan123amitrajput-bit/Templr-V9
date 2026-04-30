import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = "gemini-3-flash-preview";

export const checkImageContent = async (imageDataBase64: string): Promise<{isUiOrLandingPage: boolean, reason: string}> => {
  try {
    const prompt = "Analyze this image. Is it a landing page design, a dashboard UI, or a website interface? Please respond in JSON format.";
    
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageDataBase64.split(',')[1],
              mimeType: "image/jpeg"
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isUiOrLandingPage: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    return { 
        isUiOrLandingPage: !!json.isUiOrLandingPage, 
        reason: json.reason || "Analyzed" 
    };

  } catch (error) {
    console.error("Gemini Image Check Error:", error);
    return { isUiOrLandingPage: true, reason: "Error, assuming safe fallback" };
  }
};

export const uploadImageToGemini = async (blob: Blob): Promise<string> => {
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    
    const uploadResult = await ai.files.upload({
        file: base64Data.split(',')[1],
        mimeType: blob.type || "image/jpeg",
    });
    return uploadResult.uri;
  } catch (error) {
    console.error("Gemini Upload Failed:", error);
    throw error;
  }
};
