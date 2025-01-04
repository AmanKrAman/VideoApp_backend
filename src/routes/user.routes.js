import { Router } from "express";
import { refreshAccessToken , 
    logoutUser,
    loginUser ,
    registerUser , 
    changeCurrentPassword, 
    getCurrentUser , 
    updateAccountDetails , 
    updateUserAvatar,
    updateUserCoverImage} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import {verifyJWT } from "../middlewares/auth.middleware.js";

const userRouter = Router()

userRouter.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

userRouter.route("/login").post(loginUser)

//secured routes
userRouter.route("/logout").post(verifyJWT , logoutUser)
userRouter.route("/refresh-token").post(refreshAccessToken)
userRouter.route("/changepassword").post(verifyJWT ,changeCurrentPassword)
userRouter.route("/getuser").get(verifyJWT ,getCurrentUser)
userRouter.route("/updateaccount").patch(verifyJWT, updateAccountDetails)
userRouter.route("/updateavatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
userRouter.route("/updatecoverimage").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)

export default userRouter