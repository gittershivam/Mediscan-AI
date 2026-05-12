module.exports = {
    ensureAuthenticated: (req, res, next) => {
        if (req.isAuthenticated() || (req.session && req.session.userId)) return next();
        res.redirect("/auth/login");
    },

    forwardAuthenticated: (req, res, next) => {
        if (!req.isAuthenticated() && (!req.session || !req.session.userId)) return next();
        res.redirect("/upload");
    }
};