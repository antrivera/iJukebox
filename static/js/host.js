/* GLOBAL VARS */
var host_ts;
var room_id;

/* SOCKET EVENT HANDLERS */
socket.on('send timestamp', function(data){
  console.log('received timestamp from server: ' + data['timestamp']);
  console.log(host_ts);
  socket.emit('host timestamp', {timestamp: host_ts, room: room_id});
});

/*
 * Compare received time stamp with own time stamp. If received is less than self
 * then host already exists: send to guest page.
 */
socket.on('timestamp received', function(data){
  if (host_ts > data['timestamp']) {
    alert('Welcome! Entering room \"ijukebox.xyz/' + room_id + '\" as guest.');
    socket.emit('disconnect');
    console.log('disconnecting');
    document.location.href="/" + room_id;
  }
});

socket.on('send queue request', function(data) {
  var host_queue = getVideoQueue(data);
  if (host_queue) {

    socket.emit('host now playing', {now_playing: host_queue.now_playing, target_client: data['client_id']});

    $.each(host_queue.up_next, function(index, value) {
      socket.emit('host queue', value);
    });
  }
  else {
    console.log('nothing playing in current room');
  }
});

socket.on('connection established', function() {
  room_id = window.location.pathname.split('/')[1];
  socket.emit('join', {room: room_id});
});

socket.on('room joined', function() {
  console.log('joined room: ' + room_id);
  host_ts = getTimeStamp();
  checkTimeStamp(host_ts);
});

/* HOST.JS */
$(document).ready(function(){
  // used to color host control 'shuffle' and 'repeat all' buttons to signify
  // whether they are active
  $(function() {
    $(".host-priority-cntrl-btn").click(function(){
      $(this).toggleClass("btn-on");
    });
  });
});

/*
 * Generate a "host id" to ensure only one host exists per room.
 * Returns:
 *    A unique timestamp that serves as host id and can be used to determine
 *    which host was established first if multiple exist for a particular room
 */
function getTimeStamp(){
  if (!Date.now) {
    Date.now = function now(){
      return new Date().getTime();
    };
  }
  else {
    return Date.now();
  }
}

/*
 * Initiates a check to ensure that there exists only one host per room by notifying
 * the server of its host id
 * Params:
 *    time_stamp: The timestamp that serves as a unique host id.
 */
function checkTimeStamp(time_stamp) {
  var ts = String(time_stamp);
  socket.emit('request time stamp', {timestamp: ts, room: room_id});
}

/*
 * Obtains the current video queue of the host. Used to send to guest clients.
 * Params:
 *    client_data: The data of the client who will eventually receive the host queue
 */
function getVideoQueue(client_data) {
  var cur_queue;
  var up_next = [];

  if (player) {
    up_next = getUpNext(client_data);
    cur_queue = {
      now_playing: getNowPlaying(),
      up_next: up_next
    };
  }
  else {
    cur_queue = null;
  }
  
  return cur_queue;
}

/*
 * A helper function that builds a list of video objects that the queue comprises of
 * Params:
 *    client_data: The data of the client who will eventually receive the host queue
 */
function getUpNext(client_data) {
  var q = $("#video-queue");
  if (queueEmpty()) {
    return null;
  }

  var q_next = [];
  q.children().each(function() {
    var q_object = buildVideoObj($(this).attr("id"), $(this).find("h2").text(), $(this).find("img").attr("src"),
              $(this).find("p").text(), $(this).find("code").text());
    q_object.target_client = client_data['client_id'];
    q_next.push(q_object);
  });

  return q_next;
}

/*
 * Returns the video object of the video that is currently playing
 */
function getNowPlaying() {
  return now_playing_obj;
}

/*
 * Removes a specified video from the queue and notifies the server
 * Params:
 *    video_button: The child button of the video to be removed
 */
function hostRemoveFromQueue(video_button) {
  var video = getVideoFromChildBtn(video_button);
  video.remove();

  if(queueEmpty()) {
    $("#empty-queue-msg").show();
  }
  console.log('removed from queue');
  socket.emit('refresh client queue', {room: room_id});
}

/*
 * Initiates a specified video to be played immediately
 * Params:
 *    video_button: The child button of the video to be removed
 */
function hostPlayNow(video_button) {
  var id = getVideoFromChildBtn(video_button).attr("id");
  playByVideoId(id);
}

/*
 * Moves a specified video to the front of the queue and notifies the server.
 * Params:
 *    video_button: The child button of the video to be removed
 */
function hostSkipToFront(video_button) {
  var video_obj = getVideoFromChildBtn(video_button);
  var id = video_obj.attr("id");
  video_obj.prependTo($("#video-queue"));
  socket.emit('refresh client queue', {room: room_id});
  console.log('skipping to front of queue');
}

/*
 * Skips to the next video if one exists in the queue, and destroys the video
 * player and notifies the server if one does not exist.
 */
function hostSkipVideo() {
  if (queueEmpty()) {
    // player is currently active
    if (player) {
      destroyVideoPlayer();
    }
    return;
  }
  playNextVideo();
}

/*
 * Toggles the host control 'Repeat all' functionality. Videos will be placed back
 * into the queue when played if this configuration is toggled on.
 */
function hostToggleLoopAll() {
  if (repeat_all) {
    repeat_all = false;
    return;
  }

  repeat_all = true;
  if (now_playing_obj !== null) {
    addToQueue(now_playing_obj);
    socket.emit('refresh client queue', {room: room_id});
  }
  console.log('Repeat all: ' + repeat_all);
}

/*
 * Toggles the host control 'Shuffle' functionality. Videos will be played in random
 * order from the queue if this configuration is toggled on.
 */
function hostToggleShuffle() {
  if (shuffle) {
    shuffle = false;
    return;
  }
  shuffle = true;
  console.log('Shuffle: ' + shuffle);
}

/*
 * Returns the HTML video object that is the parent of the button pressed
 * Params:
 *    video_button: The child button of the video to be removed
 */
function getVideoFromChildBtn(video_button) {
  return video_button.parent().parent().parent();
}
