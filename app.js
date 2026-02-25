const express = require('express');
const multer = require('multer');
const { generateResume, generateCoverLetter } = require('./resumeGenerator');
const app = express();
const upload = multer({ dest: 'uploads/' });

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Route for rendering the input form
app.get('/', (req, res) => {
  console.log("Rendering index page");
  res.render('index');
});

// Route for generating resume
app.post('/generate-resume', upload.single('resumeFile'), async (req, res) => {
  console.log("Form Data:", req.body);
  console.log("File:", req.file);
  try {
    const userData = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      summary: req.body.summary,
      experience: req.body.experience,
      education: req.body.education,
      skills: req.body.skills,
      additional: req.body.additional,
    };
    const resumeText = await generateResume(userData);
    console.log("Resume text generated:", resumeText.substring(0, 100) + "...");
    res.render('resume', { resumeText, userData });
  } catch (error) {
    console.error("Route Error:", error.message, error.stack);
    if (error.message.includes("429") || error.message.includes("quota")) {
      res.status(429).send(
        `Quota exceeded for Gemini API. Please enable billing in Google Cloud Console (https://console.cloud.google.com/billing) to upgrade to a paid tier, or try again after the daily quota resets at midnight Pacific Time. Alternatively, use a model with higher free-tier limits like gemini-1.5-flash. Error details: ${error.message}`
      );
    } else {
      res.status(500).send(`Error generating resume: ${error.message}`);
    }
  }
});

// Route for generating cover letter
app.post('/generate-cover-letter', async (req, res) => {
  console.log("Cover Letter Form Data:", req.body);
  try {
    const userData = JSON.parse(req.body.userData);
    const jobDescription = req.body.jobDescription;
    const companyInfo = req.body.companyInfo;
    const resumeText = req.body.resumeText;
    const coverLetterText = await generateCoverLetter(userData, jobDescription, companyInfo);
    console.log("Cover letter text generated:", coverLetterText.substring(0, 100) + "...");
    res.render('resume', { resumeText, userData, coverLetterText });
  } catch (error) {
    console.error("Route Error:", error.message, error.stack);
    if (error.message.includes("429") || error.message.includes("quota")) {
      res.status(429).send(
        `Quota exceeded for Gemini API. Please enable billing in Google Cloud Console (https://console.cloud.google.com/billing) to upgrade to a paid tier, or try again after the daily quota resets at midnight Pacific Time. Alternatively, use a model with higher free-tier limits like gemini-1.5-flash. Error details: ${error.message}`
      );
    } else {
      res.status(500).send(`Error generating cover letter: ${error.message}`);
    }
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));