/* GLOBAL VARS */
var host_ts = null; // signifies client is not host
var room_id;

/* SOCKET EVENT HANDLERS */
socket.on('received queue', function(data) {
  console.log('queue synch success');
  var video_html = createVideoContainerHTML(data);
  $("#video-queue").append(video_html)
  $("#video-queue").find("#" + data.id + "").attr("onclick", "return false;");
  if(!queueEmpty()) {
    $("#empty-queue-msg").hide();
  }
  if(queueEmpty()) {
    $("#empty-queue-msg").show();
  }
});

socket.on('refresh queue', function() {
  onGuestLoad();
});

socket.on('send timestamp', function(data) {
  return null; //TODO:: figure out if necessary
});

socket.on('connection established', function() {
  room_id = window.location.pathname.split('/')[1];
  socket.emit('join', {room: room_id});
});

socket.on('room joined', function() {
  console.log('joined room: ' + room_id);
  onGuestLoad();
});

//TODO::possibly remove/refactor?
socket.on('received now playing', function(now_playing) {
  console.log('received now playing from host:' + now_playing.title);

  now_playing_obj = now_playing;
  $("#nothing-playing-msg").hide();
  $("#now-playing-video").html('');
  $("#now-playing-video").append(createVideoContainerHTML(now_playing));
  $("#" + now_playing.id + "").attr("onclick", "return false;");

});

socket.on('play next track', function(data) {
  onGuestLoad();
});


/* CLIENT.JS */
function onGuestLoad() {
  // remove any existing, potentially outdated queue videos before synch
  if (!queueEmpty()) {
    $("#video-queue").children().each(function() {
      $(this).remove();
    });
  }

  if(queueEmpty()) {
    $("#empty-queue-msg").show();
  }
  socket.emit('synch queue request', {room: room_id});
  console.log('synch queue request sent');
}
