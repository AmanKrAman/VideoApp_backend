import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { cacheManager } from "../utils/cacheManager.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    const user_id = req.user?._id
    // TODO: toggle subscription
    if(!isValidObjectId(channelId)){
        throw new ApiError(400 , "Invalid channelId")
    }
    const issubscribed = await Subscription.findOne({
        subscriber: user_id,
        channel : channelId
    })
    if(issubscribed){
        await Subscription.findByIdAndDelete(issubscribed?._id)
        await cacheManager.clearSubscriptionCache(channelId, user_id)
        return res
        .status(200)
        .json(new ApiResponse(200, {channelId ,subscribed: false}, "Unsubscribed successfully."))
    }

    await Subscription.create({
        channel: channelId,
        subscriber: req.user?._id
    })

    await cacheManager.clearSubscriptionCache(channelId, user_id)

    return res
    .status(200)
    .json(new ApiResponse(200 , {channelId, subscribed : true} ,"Subscribed successfully."))
})

// controller to return subscriber list of a channel  + //error in this endpoint
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    let { subscriberId } = req.params;  
    let channelId = subscriberId

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channelId");
    }

    const cacheKey = cacheManager.keys.userChannelSubscriberList(channelId)
    const cachedSubscribers = await cacheManager.get(cacheKey);

    if (cachedSubscribers) {
        return res
            .status(200)
            .json(new ApiResponse(200, cachedSubscribers, "Subscribers fetched successfully from cache"));
    }

    channelId = new mongoose.Types.ObjectId(channelId);

    const channelExists = await User.findById(channelId);
    if (!channelExists) {
        throw new ApiError(404, "Channel not found");
    }

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: channelId,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribedToSubscriber",
                        },
                    },
                    {
                        $addFields: {
                            subscribedToSubscriber: {
                                $cond: {
                                    if: {
                                        $in: [
                                            channelId,
                                            "$subscribedToSubscriber.subscriber",
                                        ],
                                    },
                                    then: true,
                                    else: false,
                                },
                            },
                            subscribersCount: {
                                $size: "$subscribedToSubscriber",
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscriber",
        },
        {
            $project: {
                _id: 0,
                subscriber: {
                    _id: 1,
                    username: 1,
                    fullname: 1,
                    "avatar.url": 1,
                    subscribedToSubscriber: 1,
                    subscribersCount: 1,
                },
            },
        },
    ]);

    await cacheManager.set(cacheKey , subscribers)

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribers,
                "subscribers fetched successfully"
            )
        );
})


const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { channelId } = req.params
    const subscriberId = channelId

    if(!isValidObjectId(subscriberId)){
        throw new ApiError(400, "Invalid subscriberId");
    }

    const cacheKey = cacheManager.keys.userSubscribedChannelList(subscriberId)
    const cachedChannels = await cacheManager.get(cacheKey);

    if (cachedChannels) {
        return res
            .status(200)
            .json(new ApiResponse(200, cachedChannels, "Channels fetched successfully from cache"));
    }

    const subscriberExists = await User.findById(subscriberId);
    if (!subscriberExists) {
        throw new ApiError(404, "Subscriber not found");
    }

    const subscribedchannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from:"users",
                localField: "channel",
                foreignField: "_id",
                as: "subscribedChannel",
                pipeline: [
                    {
                        $lookup:{
                            from: "videos",
                            localField: "_id",
                            foreignField:"owner",
                            as: "videos",
                        }
                    },
                    {
                        $addFields: {
                            latestvideos: {
                                $last: "$videos",
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$subscribedChannel"
        },
        {
            $project: {
                _id : 1,
                subscribedChannel: {
                    _id : 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    owner : 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    createdAt: 1,
                    views: 1
                }
            }
        }
    ])

    await cacheManager.set(cacheKey , subscribedchannels)

    return res
    .status(200)
    .json(new ApiResponse(200 , subscribedchannels, "channel fetched successfully."))
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}