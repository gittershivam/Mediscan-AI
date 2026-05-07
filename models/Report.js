const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    mode: {
        type: String,
        enum: ["simple", "professional"],
        required: true
    },
    result: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        enum: ["pdf", "image"],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Report", ReportSchema);