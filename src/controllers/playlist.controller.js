import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {Video} from "../models/video.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { cacheManager } from "../utils/cacheManager.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    //TODO: create playlist
    const user_id = req.user?._id

    if (!name || !description) {
        throw new ApiError(400, "name and description both are required");
    }

    try {
        const newplaylist = await Playlist.create({name , description , owner: req.user?._id})

        await cacheManager.clearPlaylistCache(user_id)

        return res
        .status(200)
        .json(new ApiResponse(200 ,{Playlist_id : newplaylist._id},"Playlist created successfully."))
    } catch (error) {
        throw new ApiError(500 , error?.message || "Unable to create playlist.")
    }
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    //TODO: get user playlists

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid userId");
    }

    const cacheKey = cacheManager.keys.UserPlayList(userId)
    const cachedPlaylists = await cacheManager.get(cacheKey)

    if (cachedPlaylists) {
        return res
        .status(200)
        .json(new ApiResponse(200, cachedPlaylists, "Playlists fetched from cache successfully."))
    }

    const playlists = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            },   
        },
        {
            $lookup:{
                from: "videos",
                localField:"videos",
                foreignField: "_id",
                as: "videos"
            }
        },
        {
            $addFields : {
                totalvideos: {
                    $size: "$videos"
                },
                totalviews: {
                    $sum: "$videos.views"
                }
            }
        },
        {
            $project :{
                _id : 1,
                name: 1,
                description: 1,
                totalvideos: 1,
                totalviews: 1,
                updatedAt : 1
            }
        }
    ])
    await cacheManager.set(cacheKey, playlists)
    return res
    .status(200)
    .json(new ApiResponse(200 , playlists, "playlist fetched successfully."))

})


const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;   

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid PlaylistId");
    }

    const cacheKey = cacheManager.keys.PlaylistList(playlistId)
    const cachedPlaylist = await cacheManager.get(cacheKey)

    if (cachedPlaylist) {
        return res
        .status(200)
        .json(new ApiResponse(200, cachedPlaylist, "Playlist fetched from cache successfully"));
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    const playlistVideos = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
            }
        },
        {
            $match: {
                "videos.isPublished": true
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            }
        },
        {
            $addFields: {
                totalVideos: {
                    $size: "$videos"
                },
                totalViews: {
                    $sum: "$videos.views"
                },
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                createdAt: 1,
                updatedAt: 1,
                totalVideos: 1,
                totalViews: 1,
                videos: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    createdAt: 1,
                    views: 1
                },
                owner: {
                    username: 1,
                    fullname: 1,
                    "avatar.url": 1
                }
            }
        }
        
    ]);

    await cacheManager.set(cacheKey, playlistVideos[0])

    return res
        .status(200)
        .json(new ApiResponse(200, playlistVideos[0], "playlist fetched successfully"));
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid PlaylistId or videoId");
    }

    const playlist = await Playlist.findById(playlistId);
    const video = await Video.findById(videoId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }
    if (!video) {
        throw new ApiError(404, "video not found");
    }

    if (
        (playlist.owner?.toString() && video.owner.toString()) !==
        req.user?._id.toString()
    ) {
        throw new ApiError(400, "only owner can add video to thier playlist");
    }
    const addvideo = await Playlist.findByIdAndUpdate(playlist?._id,{
        $addToSet: {
            videos: videoId
        }
    },{new : true})

    if(!addvideo){
        throw new ApiError(400, "Failed to add video to playlist , please try again")
    }

    await cacheManager.clearPlaylistCache(playlistId)
    await cacheManager.clearPlaylistCache(req.user?._id)

    return res
    .status(200)
    .json(new ApiResponse(200 ,addvideo, "video added to playlist successfully."))

})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid PlaylistId or videoId");
    }

    const playlist = await Playlist.findById(playlistId);
    const video = await Video.findById(videoId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }
    if (!video) {
        throw new ApiError(404, "video not found");
    }

    if (
        (playlist.owner?.toString() && video.owner.toString()) !==
        req.user?._id.toString()
    ) {
        throw new ApiError(400, "only owner can remove video to their playlist");
    }

    const pullvideo = await Playlist.findByIdAndUpdate(
        playlist?._id,
        {
            $pull : {
                videos: videoId
            }
        },
        {new: true}
    )

    await cacheManager.clearPlaylistCache(playlistId)
    await cacheManager.clearPlaylistCache(req.user?._id)

    return res
    .status(200)
    .json(new ApiResponse(200 ,pullvideo, "Removed video from playlist successfully."))
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid PlaylistId");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (playlist.owner?.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only owner can delete the playlist");
    }

    await Playlist.findByIdAndDelete(playlist?._id);

    await cacheManager.clearPlaylistCache(playlistId)
    await cacheManager.clearPlaylistCache(req.user?._id)

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "playlist deleted successfully"
            )
        );
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist

    if (!name || !description) {
        throw new ApiError(400, "name and description both are required");
    }

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid PlaylistId");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (playlist.owner?.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only owner can edit the playlist");
    }

    const updatedplaylist = await Playlist.findByIdAndUpdate(
        playlist?._id, 
        {
            $set: {
                name,
                description
            },
        },
        {new : true}
    )

    await cacheManager.clearPlaylistCache(playlistId)
    await cacheManager.clearPlaylistCache(req.user?._id)

    return res
    .status(200)
    .json(new ApiResponse(200 , updatedplaylist, "Playlist updated successfully."))
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}