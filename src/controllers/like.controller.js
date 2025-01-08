import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video
    if(!isValidObjectId(videoId)){
        throw new ApiError(400 , "Invalid VideoId");
    }
    const likedalready = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id
    })
    if(likedalready){
        await Like.findByIdAndDelete(likedalready?._id)

        return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: false }))
    }
    await Like.create({
        video : videoId,
        likedBy : req.user?._id
    })

    return res
    .status(200)
    .json(new ApiResponse(200 , {isLiked : true}))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment

    if(!isValidObjectId(commentId)){
        throw new ApiError(400 , "Invalid commentId");
    }
    const commentlikedalready = await Like.findOne({
        comment: commentId,
        likedBy : req.user?._id
    })
    if(commentlikedalready){
        await Like.findByIdAndDelete(commentlikedalready?._id)

        return res
        .status(200)
        .json(new ApiResponse(200 , {isLiked: false}))
    }
    await Like.create({
        comment: commentId,
        likedBy: res.user?._id
    })
    return res
    .status(200)
    .json(new ApiResponse(200 , {isLiked: true}))
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    if(!isValidObjectId(tweetId)){
        throw new ApiError(400 , "Invalid commentId");
    }
    const tweetlikedalready = await Like.findOne({
        tweet: tweetId,
        likedBy : req.user?._id
    })
    if(tweetlikedalready){
        await Like.findByIdAndDelete(tweetlikedalready?._id)

        return res
        .status(200)
        .json(new ApiResponse(200 , {isLiked: false}))
    }
    await Like.create({
        tweet: tweetId,
        likedBy: res.user?._id
    })
    return res
    .status(200)
    .json(new ApiResponse(200 , {isLiked: true}))
})

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    user_id = req.user?._id
    const allLikedvideo = await Like.aggregate([
        {
            $match: new mongoose.Types.ObjectId(user_id)
        },
        {
            $lookup:{
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideo",
                pipeline: [
                    {
                        $lookup:{
                            from: "user",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerInfo"
                        },
                    },
                    {
                        $unwind: "$ownerInfo", 
                    }
                ]
            },
        },
        {
            $unwind: "likedVideo"
        },
        {
            $sort:{
                createdAt: -1,
            }
        },
        {
            $project:{
                _id: 0,
                likedvideo: {
                    _id :1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    owner: 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    duration: 1,
                    createdAt: 1,
                    idPublished: 1,
                    ownerInfo: {
                        username: 1,
                        fullname: 1,
                        avatar: 1
                    }
                }
            }
        }
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200 ,allLikedvideo, "Liked videos fetched successfully"))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}