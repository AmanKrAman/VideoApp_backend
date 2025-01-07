import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const commentsAggregate = await Comment.aggregate([
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
                owner:{
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
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner:{
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
    )
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

    try {
        const updatecomment = await Comment.findOneAndUpdate({owner:ownerId , video: videoId} , {$set: {content : content}},{new: true})

        if(!updatecomment){
            throw new ApiError(404 , "Comment not found.")
        }
        return res
        .status(200)
        .json(new ApiResponse(200 , "Comment updated successfully."))
        
    } catch (error) {
        throw new ApiError(500 , error?.message || "Failed to update comment.")
    }
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const ownerId = req.user._id;
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    try {
        await Comment.findByIdAndDelete({comment: commentId})

        await Like.deleteMany({comment: commentId,likedBy: ownerId});

        return res
        .status(200)
        .json(new ApiResponse(200, "Comment deleted successfully."))
        
    } catch (error) {
        throw new ApiError(500 , error?.message || "Failed to delete comment.")
    }
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
    }