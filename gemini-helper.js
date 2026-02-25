const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateResume(userData) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const prompt = `
    Generate a professional resume based on the following information:
    
    Personal Information:
    - Name: ${userData.name}
    - Email: ${userData.email}
    - Phone: ${userData.phone}
    - Address: ${userData.address || 'Not specified'}
    
    Professional Summary:
    ${userData.summary || 'Not specified'}
    
    Work Experience:
    ${userData.experience || 'Not specified'}
    
    Education:
    ${userData.education || 'Not specified'}
    
    Skills:
    ${userData.skills || 'Not specified'}
    
    Additional Information:
    ${userData.additional || 'None'}
    
    Please format this into a well-structured, professional resume. 
    Use appropriate sections and bullet points where necessary.
    Make sure the resume is ATS (Applicant Tracking System) friendly.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

async function generateCoverLetter(userData, jobDescription, companyInfo) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const prompt = `
    Write a compelling cover letter for the following candidate applying to ${companyInfo.companyName} for the position of ${jobDescription.jobTitle}.
    
    Candidate Information:
    - Name: ${userData.name}
    - Email: ${userData.email}
    - Phone: ${userData.phone}
    - Most Relevant Experience: ${userData.experience || 'Not specified'}
    - Key Skills: ${userData.skills || 'Not specified'}
    
    Job Description:
    ${jobDescription.description}
    
    Company Information:
    ${companyInfo.about || 'Not specified'}
    
    The cover letter should:
    1. Be addressed to the hiring manager
    2. Highlight how the candidate's skills and experience match the job requirements
    3. Show enthusiasm for the position and company
    4. Be concise (no more than 3-4 paragraphs)
    5. Include a professional closing
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

module.exports = { generateResume, generateCoverLetter };