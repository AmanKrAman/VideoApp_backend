import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { cacheManager } from "../utils/cacheManager.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    const cacheKey = cacheManager.keys.videoCommentList(videoId, {
        page,
        limit,
        videoId 
    });
    const cachedComments = await cacheManager.get(cacheKey);

    if (cachedComments) {
        return res
            .status(200)
            .json(new ApiResponse(200, cachedComments, "Comments fetched from cache successfully"));
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const commentsAggregate = Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes"
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
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
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
            $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullname: 1,
                    "avatar.url": 1
                },
                isLiked: 1
            }
        }
    ]);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const comments = await Comment.aggregatePaginate(
        commentsAggregate,
        options
    );

    await cacheManager.set(cacheKey , comments)

    return res
        .status(200)
        .json(new ApiResponse(200,comments , "Comments fetched successfully."))
});

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {videoId} = req.params;
    const { content } = req.body;
    const ownerId = req.user._id;

    if(!content){
        throw new ApiError(400, "Comment content is required.")
    }
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    try {
        const newcomment = await Comment.create({
            content, 
            video: videoId,
            owner: ownerId
        })

        await cacheManager.clearCommentCache(videoId);
    
        return res
        .status(201)
        .json(new ApiResponse(201, "comment added successfully."))
    } catch (error) {
        throw new ApiError(500 , error?.message || "Failed to add comment.")
    }
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const ownerId = req.user._id;
    const {commentId} = req.params;
    const { content } = req.body;

    if(!content){
        throw new ApiError(400, "Comment content is required.")
    }
    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    if (comment?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only comment owner can edit their comment");
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        comment?._id,
        {
            $set: {
                content
            }
        },
        { new: true }
    );

    if (!updatedComment) {
        throw new ApiError(500, "Failed to edit comment please try again");
    }

    await cacheManager.clearCommentCache(comment.video.toString());
    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedComment, "Comment edited successfully")
        );
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const ownerId = req.user?._id;
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    if (comment?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only comment owner can delete their comment");
    }

    await Comment.findByIdAndDelete(commentId);

    await Like.deleteMany({
        comment: commentId,
        likedBy: req.user
    });

    await cacheManager.clearCommentCache(comment.video.toString());

    return res
        .status(200)
        .json(
            new ApiResponse(200, { commentId }, "Comment deleted successfully")
        );
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
    }