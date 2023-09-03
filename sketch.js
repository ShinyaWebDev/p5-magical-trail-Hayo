const MAX_PARTICLE_COUNT = 70;
const MAX_TRAIL_COUNT = 30;

var colorScheme = ["#E69F66", "#DF843A", "#D8690F", "#B1560D", "#8A430A"];
var shaded = true;
var theShader;
var shaderTexture;
var trail = [];
var particles = [];
const cornerCoords = [10, 40];
const keyRatio = 0.58;
const model_url =
  "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/";

const scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
let currentNote = "";
let pitch;
let audioContext;
let audioStream;
let noteArray = [];
let canDetectNote = true;
let bubbles = [];
let audioControlledX = 0;
let audioControlledY = 0;
let frequency = 0;
let volumes = 0;

const noteToMidi = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

function preload() {
  theShader = new p5.Shader(this.renderer, vertShader, fragShader);
}

function setup() {
  pixelDensity(1);

  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);

  canvas.canvas.oncontextmenu = () => false; // Removes right-click menu.
  noCursor();

  shaderTexture = createGraphics(width, height, WEBGL);
  shaderTexture.noStroke();
  document.getElementById("button").addEventListener("click", startAudio);
}

function noteNameToMidi(noteName) {
  return noteToMidi[noteName];
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  shaderTexture.resizeCanvas(width, height);
}

function startAudio() {
  // Move all audio-related setup into the mousePressed function

  console.log("Starting audio...");
  audioContext = getAudioContext();
  audioContext.resume();
  mic = new p5.AudioIn();
  mic.start(startPitch);
}
//In the above code, the startAudio() function which starts the microphone and the listening process, is only called when the user clicks the button, satisfying the browser's autoplay policy.

function startPitch() {
  pitch = ml5.pitchDetection(model_url, audioContext, mic.stream, modelLoaded);
}
function modelLoaded() {
  select("#status").html("Model Loaded");
  getPitch();
}

function getPitch() {
  pitch.getPitch(function (err, frequency) {
    let volume = mic.getLevel();
    volumes = volume;
    // audioControlledX = map(frequency, 100, 1000, 0, width);
    // audioControlledY = map(volume, 0, 0.1, 0, height);
    let minPitch = 90; // Minimum expected pitch
    let maxPitch = 400; // Maximum expected pitch
    frequency = frequency || 0;

    if (currentNote) {
      audioControlledX = map(
        constrain(frequency, minPitch, maxPitch),
        minPitch,
        maxPitch,
        0,
        windowWidth
      );
    }
    audioControlledY = map(volume, 0, 0.1, windowHeight, 0); // height is changed to windowHeight
    audioControlledY = constrain(audioControlledY, 0, windowHeight);

    // console.log("Volume: ", volume);
    if (frequency) {
      let midiNum = freqToMidi(frequency);
      let detectedNote = scale[midiNum % 12];

      document.getElementById("noteDisplay").innerText =
        "Current Note: " + currentNote;

      // Only add to the noteArray if it has less than 3 elements
      // Also check if the detected note is different from any notes already in the array
      if (noteArray.length < 3) {
        if (!noteArray.includes(detectedNote) && volume > 0.001) {
          // Check if detectedNote is already in noteArray
          noteArray.push(detectedNote);
          let noteWidth = width / 12; // width per note
          let bubbleX = map(
            noteNameToMidi(detectedNote),
            0,
            11,
            noteWidth / 2,
            width - noteWidth / 2
          );

          // If we've now reached 3 unique notes, log them
          // if (noteArray.length === 3) {
          //   console.log("First 3 unique notes detected: ", noteArray);

          //   let chord = detectChord();
          //   console.log("Detected Chord: ", chord);
          // }
        }
        // if (noteArray.length === 3) {

        //   setTimeout(function () {
        //     noteArray = [];
        //     console.log("Array cleared automatically.");
        //   }, 3000);

        // }
      }

      // Update current note for drawing
      currentNote = detectedNote;
    }
    getPitch();
  });
}

function draw() {
  background(0);
  noStroke();
  // console.log("frequency", frequency);

  // Trim end of trail.
  if (volumes > 0.01) {
    trail.push([audioControlledX, height - 100]);
  }

  let removeCount = 1;
  if (mouseIsPressed && mouseButton == CENTER) {
    removeCount++;
  }

  for (let i = 0; i < removeCount; i++) {
    if (trail.length == 0) {
      break;
    }

    if (mouseIsPressed || trail.length > MAX_TRAIL_COUNT) {
      trail.splice(0, 1);
    }
  }
  console.log("volume", volumes);
  // Spawn particles.
  if (volumes > 0.2) {
    if (particles.length < MAX_PARTICLE_COUNT) {
      let mouse = new p5.Vector(audioControlledX, 20);
      mouse.sub(pmouseX, pmouseY);
      if (mouse.mag() > 10) {
        mouse.normalize();
        // Spawn particles at the bottom of the screen
        particles.push(
          new Particle(audioControlledX, height, mouse.x, mouse.y)
        );
      }
    }
  }

  translate(-windowWidth / 2, -windowHeight / 2);

  // Move and kill particles.
  for (let i = particles.length - 1; i > -1; i--) {
    particles[i].move();
    if (particles[i].vel.mag() < 0.1) {
      particles.splice(i, 1);
    }
  }

  if (shaded) {
    // Display shader.
    shaderTexture.shader(theShader);

    let data = serializeSketch();

    theShader.setUniform("resolution", [windowWidth, windowHeight]);

    theShader.setUniform("trailCount", trail.length);
    theShader.setUniform("trail", data.trails);
    theShader.setUniform("particleCount", particles.length);
    theShader.setUniform("particles", data.particles);
    theShader.setUniform("colors", data.colors);

    shaderTexture.rect(0, 0, width, height);
    texture(shaderTexture);

    rect(0, 0, width, height);
  } else {
    // Display points.
    stroke(255, 200, 0);
    for (let i = 0; i < particles.length; i++) {
      point(particles[i].pos.x, particles[i].pos.y);
    }

    stroke(0, 255, 255);
    for (let i = 0; i < trail.length; i++) {
      point(trail[i][0], trail[i][1]);
    }
  }
}

function mousePressed() {
  if (mouseButton == RIGHT) {
    shaded = !shaded;
  }
}

function serializeSketch() {
  data = { trails: [], particles: [], colors: [] };
  let aspect = width / height;

  for (let i = 0; i < trail.length; i++) {
    data.trails.push(
      map(trail[i][0] * aspect, 0, width, 0.0, 1.0),
      map(trail[i][1], 0, height, 1.0, 0.0)
    );
  }

  for (let i = 0; i < particles.length; i++) {
    data.particles.push(
      map(particles[i].pos.x * aspect, 0, width, 0.0, 1.0),
      map(particles[i].pos.y, 0, height, 1.0, 0.0),
      (particles[i].mass * particles[i].vel.mag()) / 100
    );

    let itsColor = colorScheme[particles[i].colorIndex];
    data.colors.push(red(itsColor), green(itsColor), blue(itsColor));
  }

  return data;
}

function Particle(x, y, vx, vy) {
  this.pos = new p5.Vector(x, height);
  this.vel = new p5.Vector(random(-1, 1), random(-1, -10));
  this.vel.mult(random(10));
  this.vel.rotate(radians(random(-25, 25)));
  this.mass = random(1, 20);
  this.airDrag = random(0.92, 0.98);
  this.colorIndex = int(random(colorScheme.length));

  this.move = function () {
    this.vel.mult(this.airDrag);
    this.pos.add(this.vel);
  };
}

let vertShader = `
	precision highp float;

	attribute vec3 aPosition;

	void main() {
		vec4 positionVec4 = vec4(aPosition, 1.0);
		positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
		gl_Position = positionVec4;
	}
`;

let fragShader = `
	precision highp float;
	
	uniform vec2 resolution;
	uniform int trailCount;
	uniform vec2 trail[${MAX_TRAIL_COUNT}];
	uniform int particleCount;
	uniform vec3 particles[${MAX_PARTICLE_COUNT}];
	uniform vec3 colors[${MAX_PARTICLE_COUNT}];

	void main() {
    vec2 st = gl_FragCoord.xy / resolution.xy;
    float aspect = resolution.x / resolution.y;
    st.x *= aspect;

			float r = 0.0;
			float g = 0.0;
			float b = 0.0;

			for (int i = 0; i < ${MAX_TRAIL_COUNT}; i++) {
				if (i < trailCount) {
					vec2 trailPos = trail[i];
					float value = float(i) / distance(st, trailPos.xy) * 0.00015;
					g += value * 0.5;
					b += value;
				}
			}

			float mult = 0.00005;
			
			for (int i = 0; i < ${MAX_PARTICLE_COUNT}; i++) {
				if (i < particleCount) {
					vec3 particle = particles[i];
					vec2 pos = particle.xy;
					float mass = particle.z;
					vec3 color = colors[i];

					r += color.r / distance(st, pos) * mult * mass;
					g += color.g / distance(st, pos) * mult * mass;
					b += color.b / distance(st, pos) * mult * mass;
				}
			}

			gl_FragColor = vec4(r, g, b, 1.0);
	}
`;
