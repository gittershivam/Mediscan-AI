module.exports = {
    // Use this on routes that require login
    ensureAuthenticated: (req, res, next) => {
        if (req.isAuthenticated()) return next();
        res.redirect("/auth/login");
    },

    // Use this on routes that should redirect logged-in users
    forwardAuthenticated: (req, res, next) => {
        if (!req.isAuthenticated()) return next();
        res.redirect("/upload");
    }
};