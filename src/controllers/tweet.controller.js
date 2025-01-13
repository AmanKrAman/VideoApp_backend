import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const user_id = req.user?._id
    const {content} = req.body
    if(!content){
        throw new ApiError(400, "content is required")
    }
    const tweet = await Tweet.create({
                content: content,
                owner: user_id
            })
    if(!tweet){
        throw new ApiError(400 , "unable to create tweet, please try again.")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, "Tweet created successfully."))
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params;

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "Invalid userId");
    }
    const usertweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            },

        },
        {
            $lookup: {
                from:"users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerdetails",
                pipeline: [
                    {
                        $project:{
                            username: 1,
                            "avatar.url": 1,
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likedetails",
                pipeline: [
                    {
                        $project:{
                            likedBy: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likecounts: {
                    $size: "$likedetails"
                },
                ownerdetails: {
                    $size: "$ownerdetails"
                },
                isliked: {
                    $cond:{
                       if:{$in: [req.user?._id , "$likedetails.likedBy"]},
                       then: true,
                       else: false
                    }
                }
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project:{
                content: 1,
                ownerdetails: 1,
                likecounts: 1,
                createdAt: 1,
                isliked: 1
            }
        }
    ])
    return res
    .status(200)
    .json(new ApiResponse(200 , usertweets , "Tweets fetched successfully."))
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { tweetId } = req.params
    const { content } = req.body;
    
    if(!content){
        throw new ApiError(400 , "content is required.")
    }
    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweetId.")
    }

    const tweet = await Tweet.findById(tweetId)
    if(!tweet){
        throw new ApiError(404 , "Tweet not found.")
    }
    if(tweet?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "only owner can update this tweet.")
    }

    const newTweet = await Tweet.findByIdAndUpdate(tweetId,
        {
            $set:{
                content
            }
        },
        {
            new: true
        }
    )
    if(!newTweet){
        throw new ApiError(500, "Tweet not done, Please try again.")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, newTweet, "Tweet updated successfully."))
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params;

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400 , "Invalid tweetId")
    }
    const tweet = await Tweet.findById(tweetId)
    if(!tweet){
        throw new ApiError(404 , "Tweet not found.")
    }
    if(tweet.owner?._id.toString() !== req.user?._id.toString()){
        throw new ApiError(404, "only owner can delete the tweet")
    }
    await Tweet.findByIdAndDelete(tweetId)

    return res
    .status(200)
    .json(new ApiResponse(200, {tweetId}, "tweet deleted successfully."))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}