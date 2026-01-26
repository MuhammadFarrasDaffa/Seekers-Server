const User = require("../models/User");

const { hashPassword, comparePassword } = require("../helpers/bcrypt");
const { signToken } = require("../helpers/jwt");

class AuthController {
    static async register(req, res, next) {
        try {
            const { name, email, password } = req.body;

            if (!name || !email || !password) {
                throw {
                    name: "ValidationError",
                    message: "Name, email, and password are required",
                };
            }

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                throw { name: "ValidationError", message: "Email already registered" };
            }
            const hashedPassword = hashPassword(password);

            const user = await User.create({
                name,
                email,
                password: hashedPassword,
                role: "user",
            });


            res.status(201).json({
                message: "User registered successfully",
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    static async login(req, res, next) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                throw {
                    name: "ValidationError",
                    message: "Email and password are required",
                };
            }

            const user = await User.findOne({ email });
            if (!user) {
                throw { name: "Unauthorized", message: "Invalid email or password" };
            }

            if (!user.password) {
                throw { name: "Unauthorized", message: "Please login with Google" };
            }

            const isPasswordValid = comparePassword(password, user.password);
            if (!isPasswordValid) {
                throw { name: "Unauthorized", message: "Invalid email or password" };
            }

            const token = signToken({
                id: user._id,
                email: user.email,
            });

            res.status(200).json({
                message: "Login successful",
                access_token: token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                },
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AuthController;
