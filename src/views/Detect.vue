<template>
  <div class="min-h-screen bg-gray-200 p-6">
    <h2 class="text-2xl font-semibold mb-4 text-center">Deteksi Handsign</h2>

    <div class="flex flex-col md:flex-row justify-center items-start gap-6">
      <!-- Video + Canvas Display -->
      <div class="w-full md:w-2/3 relative rounded-lg overflow-hidden shadow-md bg-black">
        <video ref="video" class="w-full h-auto" autoplay muted playsinline></video>
        <canvas ref="canvas" class="absolute top-0 left-0 w-full h-full pointer-events-none"></canvas>
      </div>
      <!-- Output -->
      <div class="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md">
        <h3 class="text-xl font-bold mb-2">Hasil Deteksi:</h3>
        <pre class="text-2xl font-mono text-blue-600 whitespace-pre-line">{{ detectedText }}</pre>

        <div class="mt-6 flex flex-col gap-2">
          <button class="bg-green-500 hover:bg-green-600 text-white py-2 rounded" @click="startCamera">Mulai Kamera</button>
          <button class="bg-red-500 hover:bg-red-600 text-white py-2 rounded" @click="stopCamera">Berhenti</button>
          <button class="bg-gray-500 hover:bg-gray-600 text-white py-2 rounded" @click="resetText">Reset</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from "vue";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const video = ref(null);
const canvas = ref(null);
const detectedText = ref("Belum ada gesture");
let camera = null;

const startCamera = async () => {
  if (!video.value || !canvas.value) return;

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onResults);

  camera = new Camera(video.value, {
    onFrame: async () => {
      await hands.send({ image: video.value });
    },
    width: 640,
    height: 480,
  });

  camera.start();
  console.log("Kamera & deteksi dimulai");
};

const stopCamera = () => {
  if (camera) {
    camera.stop();
    camera = null;
    console.log("Kamera dihentikan");
  }
  detectedText.value = "Belum ada gesture";

  const ctx = canvas.value.getContext("2d");
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
};

const resetText = () => {
  detectedText.value = "Belum ada gesture";
};

const onResults = (results) => {
  const ctx = canvas.value.getContext("2d");
  const width = video.value.videoWidth;
  const height = video.value.videoHeight;

  canvas.value.width = width;
  canvas.value.height = height;

  // Hapus mirror canvas
  ctx.clearRect(0, 0, width, height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    let resultLines = [];

    results.multiHandLandmarks.forEach((landmarks) => {
      const count = countExtendedFingers(landmarks);

      drawConnectors(ctx, landmarks, Hands.HAND_CONNECTIONS, { color: "#0f0", lineWidth: 2 });
      drawLandmarks(ctx, landmarks, { color: "#00f", radius: 3 });

      const bbox = calculateBoundingBox(landmarks);
      ctx.strokeStyle = "#f00";
      ctx.lineWidth = 2;
      ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

      resultLines.push(`${count} jari`);
    });

    detectedText.value = resultLines.join("\n");
  } else {
    detectedText.value = "Tangan tidak terdeteksi";
  }
};

const countExtendedFingers = (landmarks) => {
  let count = 0;
  const tips = [8, 12, 16, 20];
  const pip = [6, 10, 14, 18];

  for (let i = 0; i < tips.length; i++) {
    if (landmarks[tips[i]].y < landmarks[pip[i]].y) count++;
  }

  // Thumb: arah horizontal (lebih netral, tidak berdasarkan tangan kanan/kiri)
  if (Math.abs(landmarks[4].x - landmarks[3].x) > 0.04) {
    count++;
  }

  return count;
};

const calculateBoundingBox = (landmarks) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  landmarks.forEach((point) => {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  });

  const width = canvas.value.width;
  const height = canvas.value.height;

  return {
    x: minX * width,
    y: minY * height,
    width: (maxX - minX) * width,
    height: (maxY - minY) * height,
  };
};

onBeforeUnmount(() => {
  stopCamera();
});
</script>
