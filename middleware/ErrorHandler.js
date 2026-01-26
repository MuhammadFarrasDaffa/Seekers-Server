const errorHandler = (err, req, res, next) => {
    let status = 500;
    let message = "Internal Server Error";

    if (err.name === "ValidationError") {
        status = 400;
        message = err.message;
    } else if (err.name === "Unauthorized" || err.name === "JsonWebTokenError") {
        status = 401;
        message = err.message || "Unauthorized";
    } else if (err.name === "Forbidden") {
        status = 403;
        message = err.message || "Forbidden";
    } else if (err.name === "NotFound") {
        status = 404;
        message = err.message || "Not Found";
    } else if (err.message) {
        message = err.message;
    }

    res.status(status).json({ message });
};

module.exports = errorHandler;
