"use strict";

var loops = 0, ticks = 1000 / 30, maxFrameSkip = 10, nextGameTick = (new Date).getTime();

var canvas;
var ctx;
var user;
var color;

var currentRoom = "none";

let socket;
let oldDraws = {};
let draws = {};
let pellets= [];
let lastUpdate = 0;

var myKeys = {};
myKeys.KEYBOARD = Object.freeze({
	"KEY_SPACE": 32,
	"KEY_W": 87,
	"KEY_A": 65,
	"KEY_S": 83,
	"KEY_D": 68,
	"KEY_UP": 38,
	"KEY_DOWN": 40,
	"KEY_LEFT": 37,
	"KEY_RIGHT": 39,
});
myKeys.keydown = [];

const setupRoom = () => {
	user = document.querySelector("#username").value;
	if (!user) {
			user = 'unknown';
	}
	
	color = document.querySelector("#color").value;

	document.querySelector("#login").style.display = "none";
	document.querySelector("#game").style.display = "none";
	document.querySelector("#rooms").style.display = "none";
	document.querySelector("#setup").style.display = "block";
}

const startHosting = () => {
	let roomName = document.querySelector("#roomName").value;
	let maxPlayers = document.querySelector("#maxPlayers").value;
	let maxPellets = document.querySelector("#maxPellets").value;

	socket.emit('createRoom', { roomName, maxPlayers, maxPellets, user, color });

	socket.on('createdRoom', () => {
		document.querySelector("#login").style.display = "none";
		document.querySelector("#game").style.display = "block";
		document.querySelector("#rooms").style.display = "none";
		document.querySelector("#setup").style.display = "none";

		setInterval(update, 1000 / 60);
		setInterval(draw, 1000 / 30);
	});
}

const joinRoom = () => {

	console.log("Joining " + currentRoom);

	socket.emit('joinRoom', { currentRoom, user, color });

	socket.on('joinedRoom', () => {
		document.querySelector("#login").style.display = "none";
		document.querySelector("#game").style.display = "block";
		document.querySelector("#rooms").style.display = "none";
		document.querySelector("#setup").style.display = "none";

		setInterval(update, 1000 / 60);
		setInterval(draw, 1000 / 30);
	});
}

const getServerList = () => {
	user = document.querySelector("#username").value;
	if (!user) {
			user = 'unknown';
	}
	
	color = document.querySelector("#color").value;

	socket.emit('getRooms', null);
	document.querySelector("#login").style.display = "none";
	document.querySelector("#game").style.display = "none";
	document.querySelector("#rooms").style.display = "block";
	document.querySelector("#setup").style.display = "none";

	socket.on('recieveRooms', (data) => {
		populateList(data);
	});
}

const populateList = (data) => {
	let keys = Object.keys(data);

	for (let i = 0; i < keys.length; i++)
	{
		var room = data[keys[i]];
		var roomButton = document.createElement("BUTTON");
		roomButton.room = room;
		roomButton.onclick = function () {
			currentRoom = this.room.name;
			joinRoom();
		};
		var t = document.createTextNode(room.name + ", " + room.currUsers + "/" + room.maxUsers + " users");
		roomButton.appendChild(t);
		document.querySelector("#rooms").appendChild(roomButton);
	}
}

// Draw users and pellets based on server feedback
const draw = (data) => {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
    for (let i = 0; i < pellets.length; i++)
	{
		let pellet = pellets[i];
		ctx.fillStyle = pellet.color;
		ctx.beginPath();
		ctx.arc(pellet.x + pellet.radius, pellet.y + pellet.radius, pellet.radius, 0, 2*Math.PI);
		ctx.fill();
	}

	let keys = Object.keys(draws);
	
	for (let i = 0; i < keys.length; i++)
	{
		const drawCall = draws[keys[i]];
		const oldDrawCall = oldDraws[keys[i]];
		
		if (drawCall !== null && oldDrawCall !== null) {
			const time = new Date().getTime();
			
			let totalTime = drawCall.lastUpdate - oldDrawCall.lastUpdate;
			let currTime = time - lastUpdate;
			let percent = currTime / totalTime;

			if (drawCall.died) percent = 1;
			
			if (percent > 1) percent = 1;
			
			// Lerp the server info, since it's only sent 30fps
			let changeX = drawCall.x - oldDrawCall.x;
			let changeY = drawCall.y - oldDrawCall.y;
			
			let lerpPosX = oldDrawCall.x + (changeX * percent);
			let lerpPosY = oldDrawCall.y + (changeY * percent);
			
			ctx.fillStyle = drawCall.color;
			ctx.fillRect(lerpPosX, lerpPosY, drawCall.size, drawCall.size);

			for (let k = 0; k < drawCall.segments.length; k++)
			{
				const segment = drawCall.segments[k];

				ctx.fillRect(segment.x, segment.y, drawCall.size, drawCall.size);

				if (k === 0 && oldDrawCall.segments[0] !== null)
				{
					let segChangeX = segment.x - oldDrawCall.segments[0].x;
					let segChangeY = segment.y - oldDrawCall.segments[0].y;

					let segLerpX = oldDrawCall.segments[0].x + (segChangeX * percent);
					let segLerpY = oldDrawCall.segments[0].y + (segChangeY * percent);

					ctx.fillRect(segLerpX, segLerpY, drawCall.size, drawCall.size);
				}
			}
		}
	}
}

// Update draw list based on the server's info
const handleMessage = (data) => {
	lastUpdate = new Date().getTime();
	oldDraws = draws;
	draws = data.drawCalls;
	pellets = data.drawPellets;
}

const update = () => {
	checkKeys();
}

// Move based on user input
const checkKeys = () => {
	if (myKeys.keydown[myKeys.KEYBOARD.KEY_A] || myKeys.keydown[myKeys.KEYBOARD.KEY_LEFT])
	{
		socket.emit('move', { x: -1, y: 0});
	}
	if (myKeys.keydown[myKeys.KEYBOARD.KEY_D] || myKeys.keydown[myKeys.KEYBOARD.KEY_RIGHT])
	{
		socket.emit('move', { x: 1, y: 0});
	}
	if (myKeys.keydown[myKeys.KEYBOARD.KEY_S] || myKeys.keydown[myKeys.KEYBOARD.KEY_DOWN])
	{
		socket.emit('move', { x: 0, y: 1});
	}
	if (myKeys.keydown[myKeys.KEYBOARD.KEY_W] || myKeys.keydown[myKeys.KEYBOARD.KEY_UP])
	{
		socket.emit('move', { x: 0, y: -1});
	}
}

const init = () => {
	canvas = document.getElementById("mainCanvas");
	ctx = canvas.getContext("2d");
	const join = document.querySelector("#join");
	const host = document.querySelector("#host");
	const start = document.querySelector("#startHosting")
	join.addEventListener('click', getServerList);
	host.addEventListener('click', setupRoom);
	start.addEventListener('click', startHosting);

	// event listeners
	window.addEventListener("keydown",function(e){
		myKeys.keydown[e.keyCode] = true;
	});
		
	window.addEventListener("keyup",function(e){
		myKeys.keydown[e.keyCode] = false;
	});

	socket = io.connect();

	socket.on('draw', (data) => {
		handleMessage(data);
	});
};

window.onload = init;