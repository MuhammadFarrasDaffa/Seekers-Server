const { verifyToken } = require("../helpers/jwt");
const User = require("../models/User");

const authentication = async (req, res, next) => {
    try {
        const { authorization } = req.headers;

        if (!authorization) {
            throw { name: "Unauthorized", message: "Please login first" };
        }

        const token = authorization.split(" ")[1];

        if (!token) {
            throw { name: "Unauthorized", message: "Invalid token" };
        }

        const payload = verifyToken(token);

        const user = await User.findById(payload.id);

        if (!user) {
            throw { name: "Unauthorized", message: "User not found" };
        }

        req.user = {
            id: user._id,
            email: user.email,
            role: user.role,
        };

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = authentication;
