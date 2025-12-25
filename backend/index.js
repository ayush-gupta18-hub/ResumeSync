
require("dotenv").config();
const mongoose = require("mongoose");


const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");
const bcrypt = require("bcrypt");
const User = require("./models/user");
const verifyToken = require("./middleware/auth");
const app = express();

 app.use(cors({
  origin: "*",
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: "Content-Type, Authorization"
}));

app.use(express.json({ limit: "5mb" }));


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});


const upload = multer({
  storage: multer.diskStorage({
    destination: "/tmp",   
    filename: (_, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    }
  })
});



// Health check
app.get("/", (req, res) => {
  res.send("Server running");
});

// Gemini 2.5 Flash (REST v1)
app.post("/summarize", async (req, res) => {
  try {
    const resumeText = req.body.resumeText;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Summarize this resume in concise bullet points:\n${resumeText}`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!data.candidates) {
      return res.status(500).json({
        error: data.error?.message || "Gemini returned no candidates",
      });
    }

    res.json({
      summary: data.candidates[0].content.parts[0].text,
    });
  } catch (err) {
    console.error("GEMINI FINAL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/upload", verifyToken, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let extractedText = "";

    if (ext === ".txt") {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value;
    } else if (ext === ".pdf") {
      return res.status(400).json({
        error: "PDF support coming soon — upload TXT or DOCX."
      });
    } else {
      return res.status(400).json({
        error: "PDF Unsupported file type. Only TXT and DOCX allowed."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
      process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are an AI resume reviewer.
Analyze the resume and provide:
1. Short professional summary
2. Key strengths
3. Missing skills
4. Resume improvement suggestions

Resume:
${extractedText}`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!data.candidates) {
      return res.status(500).json({
        error: data.error?.message || "AI returned no analysis."
      });
    }

    const analysis = data.candidates[0].content.parts[0].text;

    return res.json({
      message: "Resume analyzed successfully",
      analysis,
      rawText: extractedText
    });

  } catch (error) {
    if (process.env.DEBUG === "true") console.error(error);
    return res.status(500).json({ error: "Server error while analyzing resume" });
  }
});


// TEMP LOGIN API 
const jwt = require("jsonwebtoken");

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

  
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});



// TEMP SIGNUP API
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword
    });

    await user.save();

    res.json({ message: "Signup successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});


// TEMP JD MATCH API (GEMINI API)
app.post("/match", verifyToken, express.json(), async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: "Missing resume or job description" });
    }

    // MOCK MODE 
    if (process.env.MOCK_MODE === "true") {
      if (process.env.DEBUG === "true") console.log("⚠ MOCK MODE ENABLED");

      return res.json({
        matchResult: `
Match Score: 82%

Strong Matches:
• JavaScript
• Node.js
• REST APIs

Missing Skills:
• Docker
• Cloud

Verdict:
Good internship fit.
`
      });
    }

    const prompt = `
You are an AI recruiter.

Compare the RESUME and the JOB DESCRIPTION.
Return the result in this EXACT format:

Match Percentage: XX%

Strong Matches:
- ...

Missing Skills:
- ...

Improvement Suggestions:
- ...

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
      process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    if (!data?.candidates) {
      if (process.env.DEBUG === "true") console.log("❌ GEMINI ERROR ->", data);

      return res.status(502).json({
        error: data.error?.message || "AI service unavailable. Please try again."
      });
    }

    return res.json({
      matchResult: data.candidates[0].content.parts[0].text
    });

  } catch (err) {
    if (process.env.DEBUG === "true") console.log("❌ MATCH ROUTE ERROR ->", err.message);
    return res.status(500).json({ error: "Server error in match route" });
  }
});



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 ResumeSync Backend Running on port ${PORT}`);
});


