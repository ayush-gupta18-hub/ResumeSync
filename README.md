\# ResumeSync — AI-Powered Resume \& JD Match Assistant



ResumeSync is a MERN + AI powered tool that analyzes resumes, summarizes key strengths,

and matches resumes against job descriptions using the Gemini AI API.



\##  Features

\-  Login \& Signup (JWT + MongoDB)

\-  Resume Upload \& AI Analysis

\-  JD vs Resume Matching

\-  Dark Mode Output Card

\-  Gemini AI Integration

\-  Auth-Protected Routes



\## Tech Stack

#Frontend

HTML / CSS / JavaScript

#Backend

Node.js

Express.js

JWT Auth

Multer (file uploads)

Mammoth (DOCX parsing)

#Database

MongoDB Atlas

#AI

Google Gemini 2.5 Flash API

#Deployment

Render (Backend)

Vercel (Frontend)

##Architecture Diagram
User → Frontend (Vercel)
        ↓
     JWT Login
        ↓
Backend API (Render)
        ↓
 MongoDB Atlas
        ↓
Gemini AI API

