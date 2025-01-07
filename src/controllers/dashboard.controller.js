import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const user_id = req.user?._id;
    const totalSubscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(user_id)
            }
        },
        {
            $group: {
                _id: null,
                subscribersCount: {
                    $sum : 1
                }
            }
        }
    ]);

    const video = await video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(user_id)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField:"_id",
                foreignField:"video",
                as: "likes"
            }
        },
        {
            $project: {
                totallikes: {
                    $size: "$likes"
                },
                totalviews: "views",
                totalvideos: 1
            }
        },
        {
            $group:{
                _id: null,
                totallikes:{
                    $sum : "$totallikes"
                },
                totalviews: {
                    $sum : "$totalviews"
                },
                totalvideos: {
                    $sum : 1
                }
            }
        }
    ]);

    const channelstats = {
        totalSubscribers : totalSubscribers[0]?.subscribersCount || 0,
        totallikes: video[0]?.totallikes || 0,
        totalviews: video[0]?.totalviews || 0,
        totalvideos: video[0]?.totalvideos || 0
    }
    return res.
    .status(200)
    .json(new ApiResponse(200, channelstats , "channel details fetched successfully"))
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel

    const user_id = req.user?._id
    const videos = await Video.aggregate([
        {
            $match: {
                owner : new mongoose.Types.ObjectId(user_id)
            }
        },
        {
            $lookup:{
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                createdAt: {
                    $dateToParts: { date: "$createdAt" }
                },
                totallikes: {
                    $size: "$likes"
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
                _id: 1,
                "videoFile.url" :1,
                "thumbnail.url" :1,
                title: 1,
                description: 1,
                duration: 1,
                createdAt: {
                    year: 1,
                    month :1,
                    day: 1
                },
                idPublished: 1,
                totallikes : 1
            }
        }
    ]);
    return res
    .status(200)
    .json(new ApiResponse(200 , videos , "channel stats fetched successfully."))
})

export {
    getChannelStats, 
    getChannelVideos
    }