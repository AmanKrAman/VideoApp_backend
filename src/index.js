import dotenv from "dotenv"
import connect_db from "./db/index.js";

dotenv.config({path: './env'})


connect_db()

.then(() => {
    app.listen(process.env.PORT, () => {
        console.log(`server is running at port: ${process.env.PORT}`)
    })
})
.catch((err) => {
    console.log("Mongo db connection failed...!" , err)
})




/*
import express from "express"
const app = express()

(async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("errror", (error) => {
            console.log("ERRROR: " , error)
            throw error
        })

        app.listen(process.env.PORT , () =>{
            console.log(`App is listening on ${process.env.PORT}`)
        })

    } catch (error) {
        console.log("ERROR: ",error)
        throw error
    }

}) */