/* GLOBALS */
var socket = io.connect('http://' + document.domain + ':' + location.port);
var player = 0;
var now_playing_obj = null;
var shuffle = false;
var repeat_all = false;
var room_id;

/* SOCKET EVENT HANDLERS */
socket.on('add video', function(video) {
  console.log('video added to queue');

  if (!host  && queueEmpty() && !now_playing_obj) {
    $("#nothing-playing-msg").hide();
    $("#now-playing-video").append(createVideoContainerHTML(video));
    $("#now-playing-video").find("#" + video.id + "").attr("onclick", "return false;");
    now_playing_obj = video;
    return;
  }

  $("#video-queue").append(createVideoContainerHTML(video));
  $("#video-queue").find("#" + video.id + "").attr("onclick", "return false;");

  if(!queueEmpty()) {
    $("#empty-queue-msg").hide();
  }

  if ($("#video-queue").children().length === 1 && !player && host) {
    processQueueItem(video.id);
  }
  // toastr notification
  toastr.info('' + video.title, 'New Video Added:', {timeOut: 3000});
});

socket.on('destroy player', function() {
  destroyVideoPlayer();
});


/* APP.JS */
$(document).ready(function(){
  console.log('hello');

  $('#room-name-form').keypress(function(e) {
    // Check if 'Enter' key
    if (e.keyCode === 13) {
      e.preventDefault();
      createHost();
    }
  });

  $("#youtube-search-form").keypress(function(e) {
    if (e.keyCode === 13) {
      e.preventDefault();
      searchYouTube();
    }
  });

});

/*
 * Creates a room specified by user input and joins as host
 */
function createHost() {
  room_id = $("input").val();
  document.location.href="/" + room_id + "/host"
}

/*
 * Adds a video to the queue that was NOT selected from search results
 * Params:
 *  video: The video object to be added
 */
function addToQueue(video) {
  if ($("#video-queue").find("#" + video.id + "").length !== 0) {
    toastr.error('','Video Already in Queue', {timeOut: 3000});
    return;
  }

  new_video = createVideoContainerHTML(video);
  $("#video-queue").append(new_video);
  $("#" + video.id + "").attr("onclick", "return false");

  processQueueItem(video.id);
}

/*
 * Adds a video to the queue that was selected from search results by the user
 * and notifies the server of the added video.
 * Params:
 *    id: The id of the video object to be added
 * Returns:
 *    false: For href purposes
 */
function addToQueueFromSearchRes(id) {
  // ensure video to be added is not already in queue
  if ($("#video-queue").find("#" + id + "").length !== 0) {
    // notify the user that the video was not added and why
    toastr.error('Video not added','Video Already in Queue', {timeOut: 3000});
    hideSearchResults();
    return false;
  }

  var new_video = $("#" + id + "").clone().attr("onclick", "return false");
  if (host) {
    new_video.find(".host-cntrls").show();
  }

  // place in video queue
  $("#video-queue").append(new_video);
  hideSearchResults();

  // toastr notification
  toastr.success('' + $("#" + id + "").find("h2").text() + '', 'New Video Added:', {timeOut: 3000});

  var video_obj = buildVideoObj(id, $("#" + id + "").find("h2").text(), $("#" + id + "").find("img").attr("src"),
        $("#" + id + "").find("p").text(), $("#" + id + "").find("code").text());

  socket.emit('add to queue', {video: video_obj, room: room_id});

  processQueueItem(id);

  return false;
}

/*
 * Used to determine whether the added video should be now playing. Creates
 * a new video player and notifies the server if the host, and moves the
 * video into the now playing container if guest.
 * Params:
 *    id: The id of the recently added video
 */
function processQueueItem(id) {
  var v_queue = $("#video-queue");

  // no video playing
  if (host && !player) {
    createNewPlayer(id);

    now_playing_obj = buildVideoObj(id, $("#" + id + "").find("h2").text(),
      $("#" + id + "").find("img").attr("src"), $("#" + id + "").find("p").text(), $("#" + id + "").find("code").text());

    v_queue.find("#" + id + "").remove();
    //socket.emit('new player', {video_id: id, room: room_id});
  }
  // first video added for client only
  else if (!host && v_queue.children().length === 1 && !now_playing_obj) {
    now_playing_obj = buildVideoObj(id, $("#" + id + "").find("h2").text(),
      $("#" + id + "").find("img").attr("src"), $("#" + id + "").find("p").text(), $("#" + id + "").find("code").text());
      
    $("#now-playing-video").html('');
    $("#now-playing-video").append(createVideoContainerHTML(now_playing_obj));
    $("#nothing-playing-msg").hide();
    v_queue.find("#" + id + "").remove();
  }

  // hide empty queue message
  if(!queueEmpty()) {
    $("#empty-queue-msg").hide();
  }
}

/*
 * Creates a YouTube player.
 * Params:
 *    video_id: The id of the video initializing the YouTube player
 */
function createNewPlayer(video_id) {
  player = new YT.Player('player', {
    height: '480',
    width: '854',
    videoId: video_id,
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });

  $(".video-container").show();
}

/*
 * Determines the next video to be played and loads the video player with the
 * corresponding video id (if host), as well as removing it from the queue.
 * Notifies the server that all guests should refresh their queues to reflect the
 * change.
 */
function playNextVideo() {
  if (queueEmpty()) {
    destroyVideoPlayer();
    return;
  }

  var v_queue = $("#video-queue");
  var v_id;

  if (shuffle) {
    var random_index = Math.floor(Math.random()*v_queue.children().length) + 1;
    v_id = $("#video-queue > .list-group-item:nth-child(" + random_index +")").attr("id");
  }
  else {
    v_id = v_queue.children().first().attr("id");
  }

  console.log('next track');
  if (host) {
    player.loadVideoById(v_id);
    now_playing_obj = buildVideoObj(v_id, $("#" + v_id + "").find("h2").text(),
      $("#" + v_id + "").find("img").attr("src"), $("#" + v_id + "").find("p").text(), $("#" + v_id + "").find("code").text());
  //  socket.emit('next track', {track_id: video_id, room: room_id, host_command: host_command});
  }

  // remove the video that is now playing from the queue
  v_queue.find("#" + v_id + "").remove();

  // Repeat All has been toggled 'on' by the host: re-add now playing video to queue
  if (repeat_all) {
      addToQueue(now_playing_obj);
  }

  socket.emit('refresh client queue', {room: room_id});
}

/*
 * Loads a specific video to be played immediately, removes it from the queue
 * and notifies the server.
 * Params:
 *    id: The id of the video object to be played
 */
function playByVideoId(id) {
  player.loadVideoById(id);
  now_playing_obj = buildVideoObj(id, $("#" + id + "").find("h2").text(),
    $("#" + id + "").find("img").attr("src"), $("#" + id + "").find("p").text(), $("#" + id + "").find("code").text());

  $("#video-queue").find("#" + id + "").remove();

  if (repeat_all) {
      addToQueue(now_playing_obj);
  }

  socket.emit('refresh client queue', {room: room_id});

}

/*
 * Used to search for a video.
 * Params:
 *    search_term: The user supplied term(s) used to search for videos
 */
function search(search_term) {
  console.log(search_term);
  var req =  gapi.client.youtube.search.list({
    part: 'snippet',
    q: search_term,
    type: 'video',
    maxResults: 15,
    videoCategoryId: 10, // specifies 'music' ID TODO: add support for other regions
    videoEmbeddable: true // exclude videos only playable on YT site
  });

  req.execute(onSearchResponse);
}

/*
 * Gathers search term input from user and passes it to 'search', then displays
 * the search results obtained.
 */
function searchYouTube() {
  $("#search-results").html('');
  var yt_search_term = $("input").val();
  search(yt_search_term);
  $("input").val('');
  $("#search-results-container").show();
}

/*
 * Uses the search response to build the search results container that will be
 * displayed to users.  Makes an additional call to get video durations for the
 * videos obtained in the search.
 * Params:
 *    res: The response obtained from the YouTube search
 */
function onSearchResponse(res) {
  var video_id_list = "";
  var video_obj_list = [];

  for (var i = 0; i < res.items.length; i++) {
    if (i === res.items.length - 1) {
      video_id_list += res.items[i].id.videoId;
    }
    else {
      video_id_list += res.items[i].id.videoId + ",";
    }
    video_obj_list[i] = buildVideoObj(res.items[i].id.videoId, res.items[i].snippet.title,
                res.items[i].snippet.thumbnails.medium.url, res.items[i].snippet.description);
  }

  $.ajax({
      async: false,
      type: 'GET',
      url: "https://www.googleapis.com/youtube/v3/videos?id=" + video_id_list
      + "&key=AIzaSyCcJAzKEEtQldhP-JBhhNRFcTveGTSQO7w&part=snippet,contentDetails"
  }).done(function(data) {
    for (var i = 0; i < data.items.length; i++) {
      var video_duration;
      if (data.items.length > 0) {
          var output = data.items[i];
          video_duration = convertTime(output.contentDetails.duration);
      }
      video_obj_list[i].dur = video_duration;
      $("#search-results").append(createVideoContainerHTML(video_obj_list[i]));
    }
  });

  // do not display host controls in the search results window
  if (host) {
    $("#search-results").children().each(function () {
      $(this).find(".host-cntrls").hide();
    });
  }
}

function onClientLoad() {
  console.log('onClientLoad');
  gapi.client.load('youtube', 'v3', onYouTubeApiLoad);
}

function onYouTubeApiLoad() {
  gapi.client.setApiKey('AIzaSyCcJAzKEEtQldhP-JBhhNRFcTveGTSQO7w');
  console.log('onYouTubeApiLoad');
  //socket.emit('join', {room: room_id});
}

function onYouTubeIframeAPIReady() {
  console.log('iframe player ready');
}

function onPlayerReady(event) {
  event.target.setVolume(100);
  if (host) {
    event.target.playVideo();
  }
  else {
    console.log('client player ready');
  }
}

/*
 * Determines whether the currently playing video has ended and determines which
 * action to take if so.
 * Params:
 *    event: The event that triggers a change in the video player state
 */
function onPlayerStateChange(event) {
  //video has ended
  if (event.data === 0) {
    // no videos remaining in queue
    if (queueEmpty()) {
      destroyVideoPlayer();
    }
    // videos remaining in queue
    else {
      console.log('next');
      playNextVideo();
    }
  }

  if(queueEmpty()) {
    $("#empty-queue-msg").show();
  }
}

function destroyVideoPlayer() {
  now_playing_obj = null;

  if (!host) {
    $("#now-playing-video").html('');
    $("#nothing-playing-msg").show();
    return;
  }

  player.destroy();
  player = 0;
  $(".video-container").hide();
  socket.emit('nothing playing', {room: room_id});
}

/*
 * Converts the obtained video duration to standard representation h:m:s.
 * Source: http://stackoverflow.com/questions/30950603/get-video-duration-with-youtube-data-api
 */
function convertTime(duration) {
    var a = duration.match(/\d+/g);

    if (duration.indexOf('M') >= 0 && duration.indexOf('H') == -1 && duration.indexOf('S') == -1) {
        a = [0, a[0], 0];
    }

    if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1) {
        a = [a[0], 0, a[1]];
    }
    if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1 && duration.indexOf('S') == -1) {
        a = [a[0], 0, 0];
    }

    duration = 0;

    if (a.length == 3) {
        duration = duration + parseInt(a[0]) * 3600;
        duration = duration + parseInt(a[1]) * 60;
        duration = duration + parseInt(a[2]);
    }

    if (a.length == 2) {
        duration = duration + parseInt(a[0]) * 60;
        duration = duration + parseInt(a[1]);
    }

    if (a.length == 1) {
        duration = duration + parseInt(a[0]);
    }
    var h = Math.floor(duration / 3600);
    var m = Math.floor(duration % 3600 / 60);
    var s = Math.floor(duration % 3600 % 60);
    return ((h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s);
}

/*
 * Creates video conatiner HTML using handlebars template
 * Params:
 *    video: The video object to be converted to HTML
 */
function createVideoContainerHTML(video) {
  var source = $("#video-container-template").html();
  var template = Handlebars.compile(source);

  var context = {
    video_title: video.title,
    video_img: video.img,
    video_desc: video.desc,
    video_id: video.id,
    video_duration: video.dur
  };

  var html = template(context);
  return html;
}

/*
 * Builds a video object containing all necessary information for video
 * Params:
 *    id: The video id
 *    title: The video title
 *    img: The video image
 *    desc: The video description
 *    dur: The video duration
 * Returns:
 *    The generated video object
 */
function buildVideoObj(id, title, img, desc, dur) {
  var video_obj = {
    id: id,
    title: title,
    img: img,
    desc: desc,
    dur: dur
  };

  return video_obj;
}

/*
 * Determines whether the video queue is empty
 * Returns:
 *    Corresponding boolean value.
 */
function queueEmpty() {
  return ($("#video-queue").children().length === 0);
}

/*
 * Clears search results and hides the view containing them
 */
function hideSearchResults() {
  $("#search-results").html('');
  $("#search-results-container").hide();
}
