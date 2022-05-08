import { json } from "express";
import cors from "cors";
import chalk from "chalk";
import { MongoClient } from "mongodb";
import express from "express";
import dayjs from "dayjs";
import joi from 'joi';
import { v4 } from "uuid";
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
app.use(json());

app.post("/signUp", async (req, res) => {
    const userSchema = joi.object({
        name: joi.string().required(),
        email: joi.string().required(),
        password: joi.number().required(),
        secondPassword: joi.number().required()
    });

    const user = req.body;
    const {name, email, password, secondPassword} = req.body;
    const participant = userSchema.validate(userSchema);
    const validatePassword = (password === secondPassword);
    const passwordCrypt = bcrypt.hashSync(password, 10);

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        if (participant.error || !validatePassword) {
            return res.sendStatus(422)
        } else {
            const existUser = await db.collection("users").findOne({email: email});
            if (existUser) {
                console.log(`User ${name} exist in database`);
                return res.sendStatus(409);
            } else {
                await db.collection("users").insertOne({...user, password: passwordCrypt});

                return res.sendStatus(201);
            }
    }}catch(e){
        res.sendStatus(500);
        console.error("Erro no servidor, " + e); 
    }
});



app.listen(process.env.PORT, () => console.log(chalk.green.bold("Server is working in port " + process.env.PORT)));


