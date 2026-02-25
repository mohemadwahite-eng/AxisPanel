const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

console.log("API Key:", process.env.GEMINI_API_KEY ? "Loaded" : "Not Loaded");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in .env file");
}

function validateUserData(userData) {
  console.log("Validating user data:", userData);
  const requiredFields = ['name', 'email', 'phone', 'experience', 'education', 'skills'];
  for (const field of requiredFields) {
    if (!userData[field] || userData[field].trim() === '') {
      throw new Error(`Missing or empty required field: ${field}`);
    }
  }
}

function enhanceContent(field, value) {
  if (!value || value.trim().length < 10 || value.match(/[^a-zA-Z0-9\s.,-]/) || value.toLowerCase().includes('not specified')) {
    console.log(`Enhancing ${field} due to insufficient or poor quality input: "${value}"`);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    let prompt = "";
    switch (field) {
      case 'summary':
        prompt = `Generate a detailed, professional summary (200-300 words) for a resume. Assume the candidate has basic skills in ${userData.skills || 'various areas'} and experience in ${userData.experience || 'general work'}. Highlight adaptability, teamwork, leadership, problem-solving, and a strong work ethic. Include specific examples of achievements or goals, even if hypothetical, to showcase professionalism.`;
        break;
      case 'experience':
        prompt = `Generate a comprehensive work experience section (200-300 words) for a resume. Assume the candidate has worked in ${userData.experience || 'a professional role'} with skills in ${userData.skills || 'multiple domains'}. Include 3-4 job roles with detailed responsibilities such as project management, team leadership, client communication, and technical expertise. Add measurable achievements (e.g., increased sales by 20%) to enhance professionalism.`;
        break;
      case 'education':
        prompt = `Generate a detailed education section (200-300 words) for a resume. Assume the candidate has a degree or certification in ${userData.education || 'a relevant field'}. Include a graduation year (e.g., 2020), academic achievements, relevant coursework, extracurricular activities, and a brief note on how the education supports their career goals.`;
        break;
      case 'skills':
        prompt = `Generate a detailed list of 8-12 professional skills (200-300 words) for a resume based on ${userData.skills || 'general expertise'}. Include a mix of technical skills (e.g., Python, JavaScript, SQL), soft skills (e.g., communication, leadership), and industry-specific abilities. Provide a brief description (1-2 sentences) for each skill to explain its relevance.`;
        break;
      case 'additional':
        prompt = `Generate a detailed additional information section (200-300 words) for a resume. Assume the candidate has interests or certifications related to ${userData.skills || 'their field'}. Include hobbies, certifications, languages, or volunteer work, with explanations of how these enhance their professional profile.`;
        break;
      default:
        return value;
    }
    return model.generateContent(prompt).then(result => result.response.text()).catch(error => {
      console.error(`Error enhancing ${field}:`, error.message);
      return value || `Details for ${field} are incomplete.`;
    });
  }
  return Promise.resolve(value);
}

async function generateResume(userData) {
  try {
    validateUserData(userData);
    const modelName = "gemini-1.5-flash";
    const fallbackModel = "gemini-pro";
    let model = genAI.getGenerativeModel({ model: modelName });
    let enhancedData = {
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      address: userData.address || '',
      summary: await enhanceContent('summary', userData.summary),
      experience: await enhanceContent('experience', userData.experience),
      education: await enhanceContent('education', userData.education),
      skills: await enhanceContent('skills', userData.skills),
      additional: await enhanceContent('additional', userData.additional)
    };
    const prompt = `
      Generate a professional, ATS-friendly resume in plain text format based on the following information:
      
      Personal Information:
      - Name: ${enhancedData.name}
      - Email: ${enhancedData.email}
      - Phone: ${enhancedData.phone}
      - Address: ${enhancedData.address || 'Not specified'}
      
      Professional Summary:
      ${enhancedData.summary}
      
      Work Experience:
      ${enhancedData.experience}
      
      Education:
      ${enhancedData.education}
      
      Skills:
      ${enhancedData.skills}
      
      Additional Information:
      ${enhancedData.additional || 'None'}
      
      Format the resume with clear section headers (e.g., "Professional Summary", "Work Experience") and use bullet points for lists. Avoid special characters, tables, or complex formatting to ensure ATS compatibility.
    `;
    console.log("Generating resume with prompt:", prompt.substring(0, 200) + "...");
    let attempts = 3;
    while (attempts > 0) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log("Resume generated successfully");
        return response.text();
      } catch (retryError) {
        if (retryError.message.includes("Quota exceeded") && attempts > 1) {
          attempts--;
          console.log(`Retrying... (${attempts} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        } else if (retryError.message.includes("Model") && attempts > 1) {
          console.log(`Model ${modelName} failed, trying fallback model ${fallbackModel}`);
          model = genAI.getGenerativeModel({ model: fallbackModel });
          attempts--;
          continue;
        }
        throw retryError;
      }
    }
  } catch (error) {
    console.error("Error generating resume:", error.message, error.stack);
    throw new Error(`Failed to generate resume: ${error.message}`);
  }
}

async function generateCoverLetter(userData, jobDescription, companyInfo) {
  try {
    validateUserData(userData);
    if (!jobDescription.jobTitle || !jobDescription.description || !companyInfo.companyName) {
      throw new Error("Missing required job or company information");
    }
    const modelName = "gemini-1.5-flash";
    const fallbackModel = "gemini-pro";
    let model = genAI.getGenerativeModel({ model: modelName });
    const enhancedSummary = await enhanceContent('summary', userData.summary);
    const enhancedExperience = await enhanceContent('experience', userData.experience);
    const prompt = `
      Write a compelling cover letter in plain text for ${userData.name} applying to ${companyInfo.companyName} for the position of ${jobDescription.jobTitle}.
      
      Candidate Information:
      - Name: ${userData.name}
      - Email: ${userData.email}
      - Phone: ${userData.phone}
      - Most Relevant Experience: ${enhancedExperience}
      - Key Skills: ${userData.skills || await enhanceContent('skills', '')}
      
      Job Description:
      ${jobDescription.description}
      
      Company Information:
      ${companyInfo.about || 'Not specified'}
      
      The cover letter should:
      1. Address the hiring manager (use "Dear Hiring Manager" if no name is provided)
      2. Highlight how the candidate's skills and experience match the job requirements
      3. Show enthusiasm for the position and company
      4. Be concise (3-4 paragraphs, max 400 words)
      5. Include a professional closing
      6. Use plain text format for ATS compatibility
    `;
    console.log("Generating cover letter with prompt:", prompt.substring(0, 200) + "...");
    let attempts = 3;
    while (attempts > 0) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log("Cover letter generated successfully");
        return response.text();
      } catch (retryError) {
        if (retryError.message.includes("Quota exceeded") && attempts > 1) {
          attempts--;
          console.log(`Retrying... (${attempts} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        } else if (retryError.message.includes("Model") && attempts > 1) {
          console.log(`Model ${modelName} failed, trying fallback model ${fallbackModel}`);
          model = genAI.getGenerativeModel({ model: fallbackModel });
          attempts--;
          continue;
        }
        throw retryError;
      }
    }
  } catch (error) {
    console.error("Error generating cover letter:", error.message, error.stack);
    throw new Error(`Failed to generate cover letter: ${error.message}`);
  }
}

module.exports = { generateResume, generateCoverLetter };