import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {Like} from "../models/like.model.js"
import {Comment} from "../models/comment.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary , deleteFromCloudinary} from "../utils/cloudinary.js"
import { cacheManager } from "../utils/cacheManager.js"

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query

    const cacheKey = cacheManager.keys.videoList(req.query);
    const cachedData = await cacheManager.get(cacheKey);

    if (cachedData) {
        return res
            .status(200)
            .json(new ApiResponse(200, cachedData, 'Videos fetched successfully (from cache)'));
    }
    
    const pipeline = [];
    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"] 
                }
            }
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId");
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    pipeline.push({ $match: { isPublished: true } });
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }
    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    )
    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const video = await Video.aggregatePaginate(videoAggregate, options);

    await cacheManager.set(cacheKey, video);
    return res
        .status(200)
        .json(new ApiResponse(200, video, "Videos fetched successfully"));
})


const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    if (!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid userId");
    }

    const cachekey = cacheManager.keys.videoDetail(videoId, req.user?._id.toString())
    const cachedVideo = await cacheManager.get(cachekey);
    if (cachedVideo) {
        return res.status(200).json(new ApiResponse(200, cachedVideo, "video details fetched successfully from cache"));
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: {
                                $size: "$subscribers"
                            },
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$likes.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                "videoFile.url": 1,
                title: 1,
                description: 1,
                views: 1,
                createdAt: 1,
                duration: 1,
                comments: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1
            }
        }
    ]);
    if (video.length == 0) {
        throw new ApiError(500, "failed to fetch video");
    }

    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    });

    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: {
            watchHistory: videoId
        }
    });

    await cacheManager.set(cachekey, video[0]);

    return res
        .status(200)
        .json(
            new ApiResponse(200, video[0], "video details fetched successfully")
        );
})


const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video

    if(!title || !description){
        throw new ApiError(400 , "title and description are required")
    }
    const videoLocalPath = req.files?.videoFile[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

    if(!videoLocalPath){
        throw new ApiError(400, "Video is required.")
    }
    if(!thumbnailLocalPath){
        throw new ApiError(400, "thumbnail is required.")
    }

    const videoFile = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!videoFile) {
        throw new ApiError(400, "video is required.")
    }

    if (!thumbnail) {
        throw new ApiError(400, "thumbnail is required.")
    }
    const videoobj = await Video.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url: videoFile.url,
            public_id: videoFile.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id
        },
        owner: req.user?._id,
        isPublished: false
    });

    const videoupload = await Video.findById(videoobj._id)

    if(!videoupload){
        throw new ApiError(500 , "Video upload failed , please try again.")
    }

    await cacheManager.clearVideoCache(videoobj._id, req.user?._id);
    await cacheManager.clearByPattern(cacheManager.patterns.userVideos(req.user?._id));
    await cacheManager.clearByPattern(cacheManager.patterns.allVideos);


    return res
    .status(200)
    .json(new ApiResponse(200 , {video: videoobj}, "video uploaded successfully."))
})


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body;
    //TODO: update video details like title, description, thumbnail

    if(!isValidObjectId(videoId)){
        throw new ApiError(400 , "Invalid videoId.")
    }
    if(!title || !description){
        throw new ApiError(400 , "title and description are required")
    }
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "No video found");
    }

    if(video.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(404 , "you are not allowed to update the user.")
    }

    const thumbnailToDelete = video.thumbnail.public_id;

    const thumbnailLocalPath = req.file?.path;

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnail is required");
    }
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
        throw new ApiError(400, "thumbnail not found");
    }

    const updatevideo = await Video.findByIdAndUpdate(videoId, {
        $set : {
            title,
            description,
            thumbnail: {
                url: thumbnail.url,
                public_id: thumbnail.public_id
            }
        }
    },{new: true})

    if(!updatevideo){
        throw new ApiError(500 , "failed to update video, please try again.")
    }
    if(updatevideo){
        await deleteFromCloudinary(thumbnailToDelete);
    }

    await cacheManager.clearVideoCache(videoId, req.user?._id.toString());
    await cacheManager.clearByPattern(cacheManager.patterns.userVideos(req.user?._id.toString()));
    await cacheManager.clearByPattern(cacheManager.patterns.allVideos);

    return res
    .status(200)
    .json(new ApiResponse(200 , updatevideo , "video updated successfully."))
})  

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "No video found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't delete this video as you are not the owner"
        );
    }

    const videoDeleted = await Video.findByIdAndDelete(video?._id);

    if (!videoDeleted) {
        throw new ApiError(400, "Failed to delete the video please try again");
    }

    await deleteFromCloudinary(video.thumbnail.public_id); 
    await deleteFromCloudinary(video.videoFile.public_id, "video"); 

    await Like.deleteMany({
        video: videoId
    })

    await Comment.deleteMany({
        video: videoId,
    })

    await cacheManager.clearVideoCache(videoId, req.user?._id.toString());
    await cacheManager.clearByPattern(cacheManager.patterns.userVideos(req.user?._id.toString()));
    await cacheManager.clearByPattern(cacheManager.patterns.allVideos);
    
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"));
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't toogle publish status as you are not the owner"
        );
    }

    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video?.isPublished
            }
        },
        { new: true }
    );

    if (!toggledVideoPublish) {
        throw new ApiError(500, "Failed to toogle video publish status");
    }

    await cacheManager.clearVideoCache(videoId, req.user?._id);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { videoId, isPublished: toggledVideoPublish.isPublished },
                "Video publish toggled successfully"
            )
        );
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}