<template>
  <div class="min-h-screen bg-gray-200 p-6">
    <h2 class="text-2xl font-semibold mb-4 text-center">📸 Tambah Dataset Handsign</h2>
    <div class="flex flex-col md:flex-row justify-center gap-6">
      <!-- Kamera -->
      <div class="relative w-full md:w-2/3 rounded-lg overflow-hidden shadow-lg bg-black">
        <video ref="video" autoplay playsinline class="w-full h-auto"></video>
        <canvas ref="canvas" class="absolute top-0 left-0 w-full h-full pointer-events-none"></canvas>
      </div>
      <!-- Form & Tombol -->
      <div class="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md flex flex-col gap-4">
        <label class="text-lg font-semibold">Label Handsign:</label>
        <input
          v-model="label"
          type="text"
          placeholder="Contoh: makan, berdoa"
          class="border p-2 rounded w-full"
        />
        <div class="flex flex-col gap-2">
          <button
            class="bg-green-500 hover:bg-green-600 text-white py-2 rounded"
            @click="startCamera"
            :disabled="isCameraOn"
          >
           Mulai Kamera
          </button>
          <button
            class="bg-red-500 hover:bg-red-600 text-white py-2 rounded"
            @click="stopCamera"
            :disabled="!isCameraOn"
          >
           Stop Kamera
          </button>
          <button
            class="bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
            @click="captureImage"
            :disabled="!label || !isCameraOn"
          >
           Ambil Gambar
          </button>
        </div>
        <div v-if="lastImage" class="mt-4">
          <p class="font-medium">🖼️ Preview:</p>
          <img :src="lastImage" alt="Preview" class="rounded border" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const video = ref(null);
const canvas = ref(null);
const label = ref('');
const lastImage = ref(null);
let camera = null;
let hands = null;
const isCameraOn = ref(false);

const startCamera = async () => {
  if (isCameraOn.value || !video.value || !canvas.value) return;

  hands = new Hands({
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
  isCameraOn.value = true;
};

const stopCamera = () => {
  if (camera) {
    camera.stop();
    camera = null;
    isCameraOn.value = false;
    const ctx = canvas.value?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  }
};

const onResults = (results) => {
  const ctx = canvas.value?.getContext('2d');
  const width = video.value?.videoWidth ?? 640;
  const height = video.value?.videoHeight ?? 480;

  if (!ctx || !canvas.value) return;

  canvas.value.width = width;
  canvas.value.height = height;
  ctx.clearRect(0, 0, width, height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    results.multiHandLandmarks.forEach((landmarks, index) => {
      drawConnectors(ctx, landmarks, Hands.HAND_CONNECTIONS, { color: '#0f0', lineWidth: 2 });
      drawLandmarks(ctx, landmarks, { color: '#00f', radius: 3 });

      const bbox = calculateBoundingBox(landmarks, width, height);
      ctx.strokeStyle = '#f00';
      ctx.lineWidth = 2;
      ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

      ctx.fillStyle = '#fff';
      ctx.font = '14px Arial';
      ctx.fillText(`Tangan ${index + 1}`, bbox.x, bbox.y - 5);
    });
  }
};

const calculateBoundingBox = (landmarks, width, height) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  landmarks.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  return {
    x: minX * width,
    y: minY * height,
    width: (maxX - minX) * width,
    height: (maxY - minY) * height,
  };
};

const captureImage = () => {
  if (!video.value || !canvas.value || !label.value) return;

  const width = video.value.videoWidth;
  const height = video.value.videoHeight;
  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = width;
  hiddenCanvas.height = height;

  const ctx = hiddenCanvas.getContext('2d');
  ctx.drawImage(video.value, 0, 0, width, height);
  const dataUrl = hiddenCanvas.toDataURL('image/jpeg');
  lastImage.value = dataUrl;

  const link = document.createElement('a');
  link.href = dataUrl;
  const timestamp = new Date().getTime();
  link.download = `${label.value}_${timestamp}.jpg`;
  link.click();
};

onBeforeUnmount(() => {
  stopCamera();
});
</script>
