const express = require("express");
const router = express.Router();
const fs = require('fs');


const upload = require('../utils/uploadConfig');
const { extractText } = require('../services/pdfService');
const { analyzeText,analyzeImage, translateText, chatWithReport } = require('../services/aiService');

const { ensureAuthenticated } = require("../middleware/auth");
const Report = require("../models/Report");

router.get("/", (req, res) => {
    res.render("home");
});

router.get("/features", (req, res) => {
    res.render("features");
});

router.get("/aboutUs", (req, res) => {
    res.render("aboutUs");
});

router.get("/how-it-works", (req, res) => {
    res.render("howItWorks");
});

// Protected route - must be logged in
router.get("/upload", ensureAuthenticated, (req, res) => {
    res.render("upload");
});

router.get('/debug-auth', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        user: req.user ? req.user.email : null,
        sessionID: req.sessionID,
        session: req.session
    });
});

router.post('/analyze', upload.single('report'), async (req, res) => {
    try {
        const mode = req.body.mode;
        const filePath = req.file.path;
        const ext = req.file.originalname.split('.').pop().toLowerCase();

        let result;
        let fileType;

        if (ext === 'pdf') {
            const text = await extractText(filePath);
            result = await analyzeText(text, mode);
            fileType = 'pdf';
        } else {
            result = await analyzeImage(filePath, mode);
            fileType = 'image';
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Save report to database
        await Report.create({
            user: req.user._id,
            mode,
            result,
            fileType
        });

        res.json({ success: true, result });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.json({ success: false, message: "Analysis failed" });
    }
});


router.post('/translate', async (req, res) => {
    try {
        const { text, language } = req.body;
        
        if (!text || !language) {
            return res.json({ success: false, message: "Missing text or language" });
        }

        const translatedText = await translateText(text, language);
        res.json({ success: true, result: translatedText });

    } catch (error) {
        console.error("Translation Error:", error);
        res.json({ success: false, message: "Translation failed" });
    }
});

router.post('/chat', async (req, res) => {
    try {
        const { reportContext, chatHistory, userMessage } = req.body;

        if (!userMessage) {
            return res.json({ success: false, message: "No message provided" });
        }

        const reply = await chatWithReport(
            reportContext || "No report context available.",
            chatHistory || [],
            userMessage
        );

        res.json({ success: true, reply });

    } catch (error) {
        console.error("Chat Route Error:", error);
        res.json({ success: false, message: "Chat failed" });
    }
});

// History page - protected
router.get("/history", ensureAuthenticated, async (req, res) => {
    try {
        const reports = await Report.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(10);

        res.render("history", { reports });
    } catch (err) {
        console.error("History Error:", err);
        res.redirect("/");
    }
});

router.get("/profile", ensureAuthenticated, async (req, res) => {
    try {
        const totalReports = await Report.countDocuments({ user: req.user._id });
        
        // Reports this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const thisMonthReports = await Report.countDocuments({
            user: req.user._id,
            createdAt: { $gte: startOfMonth }
        });

        // Most used mode
        const simpleModeCount = await Report.countDocuments({ 
            user: req.user._id, 
            mode: "simple" 
        });
        const proModeCount = await Report.countDocuments({ 
            user: req.user._id, 
            mode: "professional" 
        });
        const mostUsedMode = simpleModeCount >= proModeCount ? "Patient Mode" : "Medical Mode";

        res.render("profile", {
            user: req.user,
            totalReports,
            thisMonthReports,
            mostUsedMode,
            simpleModeCount,
            proModeCount
        });

    } catch (err) {
        console.error("Profile Error:", err);
        res.redirect("/");
    }
});

module.exports = router;