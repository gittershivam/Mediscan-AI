const express = require("express");
const router = express.Router();
const passport = require("passport");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// ===== GET /auth/signup =====
router.get("/signup", (req, res) => {
    if (req.isAuthenticated()) return res.redirect("/");
    res.render("signup", { error: null });
});

// ===== POST /auth/signup =====
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        // Validation
        if (!name || !email || !password || !confirmPassword) {
            return res.render("signup", { error: "All fields are required" });
        }

        if (password !== confirmPassword) {
            return res.render("signup", { error: "Passwords do not match" });
        }

        if (password.length < 6) {
            return res.render("signup", { error: "Password must be at least 6 characters" });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render("signup", { error: "An account with this email already exists" });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        // Auto login after signup
        req.login(user, (err) => {
            if (err) return res.render("signup", { error: "Signup failed. Try again." });
            return res.redirect("/upload");
        });

    } catch (err) {
        console.error("Signup Error:", err);
        res.render("signup", { error: "Something went wrong. Please try again." });
    }
});

// ===== GET /auth/login =====
router.get("/login", (req, res) => {
    if (req.isAuthenticated()) return res.redirect("/");
    res.render("login", { error: null });
});

// ===== POST /auth/login =====
router.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) return next(err);

        if (!user) {
            return res.render("login", { error: info.message });
        }

        req.login(user, (err) => {
            if (err) return next(err);
            return res.redirect("/upload");
        });
    })(req, res, next);
});

// ===== GET /auth/logout =====
router.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) return res.redirect("/");
        res.redirect("/auth/login");
    });
});

module.exports = router;