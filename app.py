from flask import Flask, render_template, url_for, request, redirect
from flask_socketio import SocketIO, join_room, leave_room, send, emit
import redis
import json

app = Flask(__name__)
#app.debug = True
app.config['SECRET_KEY'] = 'fear the old blood'

#redis = redis.StrictRedis(host='localhost', port=6379, db=0)
#pubsub = redis.pubsub()

socketio = SocketIO(app) #, message_queue='redis://')

@app.route("/", methods=['GET', 'POST'])
def index():
    return render_template('index.html')

# Host room
@app.route('/<room_id>/host/')
def show_room_id_as_host(room_id):
    return render_template('host.html', room_id=room_id)

# Client room
@app.route('/<room_id>/')
def show_room_id(room_id):
    return render_template('client.html', room_id=room_id)

# SOCKETIO handlers
@socketio.on('connect')
def connect():
    print 'Client ' + request.sid + ' is connected'
    emit('connection established', room=request.sid)

@socketio.on('request time stamp')
def check_ts(data):
    room = data['room']
    timestamp = data['timestamp']
    print 'Host timestamp: ' + timestamp
    print 'room: ' + room
    emit('send timestamp', {'timestamp': timestamp}, room=room, include_self=False)

@socketio.on('host timestamp')
def send_host_ts(data):
    room = data['room']
    emit('timestamp received', {'timestamp': data['timestamp']}, room=room, include_self=False)
    print 'timestamp sent'

@socketio.on('synch queue request')
def synch_queue(data):
    room = data['room']
    emit('send queue request', {'client_id': request.sid}, room=room, include_self=False)
    print 'synch queue in room: ' + room
    print "Requesting client sid is: " + request.sid

@socketio.on('host now playing')
def send_host_now_playing(data):
    client_id = data['target_client']
    emit('received now playing', data['now_playing'], room=client_id)

@socketio.on('host queue')
def send_host_queue(data):
    # send to individual client
    client_id = data['target_client']
    emit('received queue', data, room=client_id)
    print 'host queue sent to client: ' + client_id

#emit to all clients
@socketio.on('refresh client queue')
def refresh_queue(data):
    emit('refresh queue', room=data['room'], include_self=False)
'''
@socketio.on('new player')
def new_player(data):
    room = data['room']
    video_id = data['video_id']
    emit('create new player', video_id, room=room, include_self=False)
'''
@socketio.on('add to queue')
def add_to_queue(data):
    room = data['room']
    emit('add video', data['video'], room=room, include_self=False)

@socketio.on('next track')
def next_track(data):
    room = data['room']
    track_id = data['track_id']
    host_command = data['host_command']
    emit('play next track', {'id': track_id, 'host_command': host_command}, room=room, include_self=False)

@socketio.on('nothing playing')
def nothing_playing(room):
    emit('destroy player', room=room['room'], include_self=False)

@socketio.on('join')
def on_join(data):
    room = data['room']
    print 'joining room...' + room
    join_room(room)
    print 'Welcome to room: ' + room
    emit('room joined', room=request.sid)

@socketio.on('disconnect')
def client_disconnect():
    print 'Client ' + request.sid + ' has disconnected'


if __name__ == "__main__":
    socketio.run(app)
    #socketio.run(app, host='0.0.0.0')
