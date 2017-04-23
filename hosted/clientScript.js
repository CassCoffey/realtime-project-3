"use strict";

var loops = 0, ticks = 1000 / 30, maxFrameSkip = 10, nextGameTick = (new Date).getTime();

var canvas;
var ctx;
var user;
var color;

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
});
myKeys.keydown = [];

// Connect to the server
const connectSocket = (e) => {
	socket = io.connect();
	
	user = document.querySelector("#username").value;
	if (!user) {
			user = 'unknown';
	}
	
	color = document.querySelector("#color").value;
	
	socket.on('connect', () => {
		console.log('connecting');
		socket.emit('join', { user, color});
	});
	
	socket.on('connected', () => {				
		document.querySelector("#login").style.display = "none";
		document.querySelector("#game").style.display = "block";
		
		setup();
		setInterval(update, 1000 / 60);
		setInterval(draw, 1000 / 60);
	});
	
	socket.on('draw', (data) => {
		handleMessage(data);
	});
};

// Draw users and pellets based on server feedback
const draw = (data) => {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	for (let i = 0; i < pellets.length; i++)
	{
		let pellet = pellets[i];
		ctx.fillStyle = pellet.color;
		ctx.fillRect(pellet.x, pellet.y, pellet.width, pellet.height);
	}
	
	let keys = Object.keys(draws);
	
	for (let i = 0; i < keys.length; i++)
	{
		const drawCall = draws[keys[i]];
		const oldDrawCall = oldDraws[keys[i]];
		
		if (drawCall != null && oldDrawCall != null) {
			const time = new Date().getTime();
			
			let totalTime = drawCall.lastUpdate - oldDrawCall.lastUpdate;
			let currTime = time - lastUpdate;
			let percent = currTime / totalTime;
			
			if (percent > 1)
			{
				percent = 1;
			}
			
			// Lerp the server info, since it's only sent 30fps
			let changeX = drawCall.x - oldDrawCall.x;
			let changeY = drawCall.y - oldDrawCall.y;
			let changeR = drawCall.radius - oldDrawCall.radius;
			
			let lerpPosX = oldDrawCall.x + (changeX * percent);
			let lerpPosY = oldDrawCall.y + (changeY * percent);
			let lerpRadius = oldDrawCall.radius + (changeR * percent);
			
			ctx.fillStyle = drawCall.color;
			ctx.beginPath();
			ctx.arc(lerpPosX, lerpPosY, lerpRadius,0,2*Math.PI);
			ctx.fill();
			
			ctx.fillStyle = "white";
			ctx.font = (lerpRadius / 2) + "px Anton";
			ctx.textAlign = "center";
			ctx.strokeText(drawCall.user, lerpPosX, lerpPosY + (lerpRadius/8));
		}
	}
}

// Set up event listeners
const setup = () => {
	// event listeners
	window.addEventListener("keydown",function(e){
		myKeys.keydown[e.keyCode] = true;
	});
		
	window.addEventListener("keyup",function(e){
		myKeys.keydown[e.keyCode] = false;
	});
}

// Update draw list based on the server's info
const handleMessage = (data) => {
	lastUpdate = new Date().getTime();
	oldDraws = draws;
	draws = data.users;
	pellets = data.pellets;
}

const update = () => {
	checkKeys();
}

// Move based on user input
const checkKeys = () => {
	if (myKeys.keydown[myKeys.KEYBOARD.KEY_A])
	{
		socket.emit('move', { x: -3, y: 0});
	}
	if (myKeys.keydown[myKeys.KEYBOARD.KEY_D])
	{
		socket.emit('move', { x: 3, y: 0});
	}
	if (myKeys.keydown[myKeys.KEYBOARD.KEY_S])
	{
		socket.emit('move', { x: 0, y: 3});
	}
	if (myKeys.keydown[myKeys.KEYBOARD.KEY_W])
	{
		socket.emit('move', { x: 0, y: -3});
	}
}

const init = () => {
	canvas = document.getElementById("mainCanvas");
	ctx = canvas.getContext("2d");
	const connect = document.querySelector("#connect");
	connect.addEventListener('click', connectSocket);
};

window.onload = init;