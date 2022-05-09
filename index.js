import { json } from "express";
import cors from "cors";
import chalk from "chalk";
import { MongoClient } from "mongodb";
import express from "express";
import dayjs from "dayjs";
import joi from 'joi';
import { v4 as uuid } from "uuid";
import bcrypt from "bcrypt";

import dotenv from "dotenv";
dotenv.config();

let db;
const mongoClient = new MongoClient(process.env.MONGO_URL);
mongoClient.connect().then(() => {
    db = mongoClient.db(process.env.DATABASE);
    console.log(chalk.green.bold("Mongo is working!"))
});

const app = express();
app.use(cors());
app.use(express.json());

app.post("/signUp", async (req, res) => {
    const user = req.body;
    const { name, email, password } = req.body;

    const userSchema = joi.object({
        name: joi.string().required(),
        email: joi.string().required(),
        password: joi.string().required(),
    });
    const validation = userSchema.validate(user);

    const passwordCrypt = bcrypt.hashSync(password, 10);

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        if (validation.error) {
            console.log(validation.error.details);
            return res.sendStatus(422);
        } else {
            const existUser = await db.collection("users").findOne({ email: email });
            if (existUser) {
                console.log(`User ${name} exist in database`);
                return res.sendStatus(409);
            } else {
                await db.collection("users").insertOne({ ...user, password: passwordCrypt });

                return res.sendStatus(201);
            }
        }
    } catch (e) {
        res.sendStatus(500);
        console.error("Erro no servidor, " + e);
    }
});

app.post("/signIn", async (req, res) => {
    const { email, password } = req.body;

    const userSchema = joi.object({
        email: joi.string().required(),
        password: joi.string().required()
    });
    const validation = userSchema.validate({ email, password });

    const user = await db.collection('users').findOne({ email });

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        if (validation.error) {
            console.log(validation.error.details);
            return res.sendStatus(422);
        } else {
            if (user && bcrypt.compareSync(password, user.password)) {
                const token = uuid();

                await db.collection("sessions").insertOne({
                    userId: user._id,
                    token
                });

                delete user.password,

                    res.send({ ...user, token }).status(201);
            } else {
                console.log(`User with ${email} does not exist in database`);
                return res.sendStatus(409);
            }
        }
    } catch (e) {
        res.sendStatus(500);
        console.error("Erro no servidor, " + e);
    }
})

app.post("/myFinance", async (req, res) => {

    const data = req.body;

    const { authorization } = req.headers;
    const token = authorization?.replace("Bearer ", "");

    const financeSchema = joi.object({
        type: joi.string().required(),
        value: joi.string().required(),
        description: joi.string().required()
    })
    const validation = financeSchema.validate(data);

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        if (validation.error) {
            console.log(validation.error.details);
            return res.sendStatus(422);
        } else {
            if (!token) return res.sendStatus(401);

            const session = await db.collection("sessions").findOne({ token });
            if (!session) return res.sendStatus(401);

            const user = await db.collection("users").findOne({ _id: session.userId });

            if (user) {
                await db.collection("myFinance").insertOne({
                    email: user.email,
                    type: data.type,
                    value: data.value,
                    description: data.description,
                    date: dayjs('2019-01-25').format('DD/MM')
                });
                res.send({email: user.email, type: data.type, value: data.value, description: data.description, date: dayjs().format('DD/MM') }).status(201);
            } else {
                res.sendStatus(409);
            }
        }
    } catch (e) {
        res.sendStatus(500);
        console.error("Erro no servidor, " + e);
    }
})

app.get("/myFinance", async (req, res) => {
    const { authorization } = req.headers;
    const token = authorization?.replace("Bearer ", "");

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        if (!token) return res.sendStatus(401);

        const session = await db.collection("sessions").findOne({ token });
        if (!session) return res.sendStatus(401);

        const user = await db.collection("users").findOne({ _id: session.userId });

        if (user) {
            const finance = await db.collection("myFinance").find({ email: user.email }).toArray();
            res.send(finance).status(201);
        } else {
            res.sendStatus(409);
        }
    } catch (e) {
        res.sendStatus(500);
        console.error("Erro no servidor, " + e);
    }
})

app.post("/logout", async (req, res) => {
    const { authorization } = req.headers;
    const token = authorization?.replace("Bearer ", "");

    try{
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        if (!token) return res.sendStatus(401);

        const session = await db.collection("sessions").findOne({ token });
        if (session){
            await db.collection("sessions").deleteOne({token});
            res.sendStatus(204);
        }

    }catch (e){
        res.sendStatus(500);
        console.error("Problema nos servidor: ",e);
    }
})

app.listen(process.env.PORT, () => console.log(chalk.green.bold("Server is working in port " + process.env.PORT)));


