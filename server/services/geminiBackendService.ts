import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import os from 'os';

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export const uploadToGeminiBackend = async (buffer: Buffer, originalname: string, mimetype: string): Promise<string> => {
  const tempFilePath = path.join(os.tmpdir(), `${Date.now()}_${originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  try {
    const ai = getAI();
    fs.writeFileSync(tempFilePath, buffer);
    
    const uploadResult = await ai.files.upload({
        file: tempFilePath,
        config: { 
            displayName: originalname,
            mimeType: mimetype
        }
    });
    
    fs.unlinkSync(tempFilePath);
    return uploadResult.uri;
  } catch (error) {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    console.error("Gemini Backend Upload Failed:", error);
    throw error;
  }
};
