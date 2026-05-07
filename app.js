const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const passport = require("passport");
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

const app = express();

// Passport config
require("./config/passport")(passport);

const mainRoutes = require("./routes/mainRoutes");
const authRoutes = require("./routes/authRoutes");

// ===== DATABASE CONNECTION =====
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// ===== MIDDLEWARE =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "10mb" }));

// ===== SESSION =====
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

// ===== PASSPORT =====
app.use(passport.initialize());
app.use(passport.session());

// ===== MAKE USER AVAILABLE IN ALL VIEWS =====
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, "public")));

// ===== VIEW ENGINE =====
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ===== ROUTES =====
app.use("/", mainRoutes);
app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});