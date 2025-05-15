<template>
  <div class="min-h-screen bg-gray-200 p-6">
    <h2 class="text-2xl font-bold mb-4 text-center">🔍 Deteksi Handsign</h2>
    <div class="flex flex-col md:flex-row gap-6 justify-center">
      <div class="relative w-full md:w-2/3 bg-black rounded-lg overflow-hidden shadow-md">
        <video ref="video" autoplay muted playsinline class="w-full h-auto"></video>
        <canvas ref="canvas" class="absolute top-0 left-0 w-full h-full pointer-events-none"></canvas>
      </div>
      <div class="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md">
        <h3 class="text-lg font-bold mb-2">Hasil Deteksi:</h3>
        <div class="text-xl font-mono text-blue-600 whitespace-pre-line">{{ detectedText }}</div>
        <div class="mt-4 flex flex-col gap-2">
          <button class="bg-green-500 hover:bg-green-600 text-white py-2 rounded" @click="startCamera">Mulai Kamera</button>
          <button class="bg-red-500 hover:bg-red-600 text-white py-2 rounded" @click="stopCamera">Berhenti</button>
          <button class="bg-gray-500 hover:bg-gray-600 text-white py-2 rounded" @click="resetText">Reset</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as tf from "@tensorflow/tfjs";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const video = ref(null);
const canvas = ref(null);
const detectedText = ref("Belum ada gesture");
const model = ref(null);
const labels = ref([]);
const isModelLoaded = ref(false);
let camera = null;

// Load model saat komponen dimount
onMounted(async () => {
  try {
    detectedText.value = "⏳ Memuat model...";

    await tf.setBackend("webgl");

    await tf.ready();

    console.log("✅ Backend aktif:", tf.getBackend());// Debugging
    
    // Pastikan backend sudah aktif
    if (!tf.engine()?.backend) {
      console.error("❌ Backend belum siap!");
      return;
    }
    console.log("✅ Backend aktif:", tf.getBackend());

    model.value = await tf.loadLayersModel("/tfjs_model/model.json");
    const res = await fetch("/labels.json");
    labels.value = await res.json();

    isModelLoaded.value = true;
    detectedText.value = "✅ Model siap digunakan";
  } catch (err) {
    console.error("❌ Gagal load model:", err);
    detectedText.value = "❌ Gagal memuat model";
  }
});

const startCamera = () => {
  if (!video.value || !canvas.value || !isModelLoaded.value) {
    console.warn("⚠️ Kamera atau model belum siap");
    return;
  }

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
      try {
        await hands.send({ image: video.value });
      } catch (err) {
        console.error("❌ Error hands.send:", err);
      }
    },
    width: 640,
    height: 480,
  });

  camera.start();
};

const stopCamera = () => {
  if (camera) {
    camera.stop();
    camera = null;
  }
  const ctx = canvas.value.getContext("2d");
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  detectedText.value = "Belum ada gesture";
};

const resetText = () => {
  detectedText.value = "Belum ada gesture";
};

const onResults = async (results) => {
  if (!model.value || !isModelLoaded.value || !tf.engine()?.backend) {
    console.warn("⚠️ Model atau backend belum siap");
    detectedText.value = "❌ Model belum siap";
    return;
  }

  const ctx = canvas.value.getContext("2d");
  const width = video.value.videoWidth;
  const height = video.value.videoHeight;
  canvas.value.width = width;
  canvas.value.height = height;
  ctx.clearRect(0, 0, width, height);

  if (results.multiHandLandmarks?.length > 0) {
    let texts = [];

    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];

      drawConnectors(ctx, landmarks, Hands.HAND_CONNECTIONS, { color: "#0f0", lineWidth: 2 });
      drawLandmarks(ctx, landmarks, { color: "#00f", radius: 3 });

      try {
        const inputTensor = tf.tensor([landmarks.flatMap((p) => [p.x, p.y, p.z])], [1, 63], "float32");

        if (!model.value) {
          console.error("❌ Model belum siap digunakan!");
          return;
        }

        const prediction = model.value.predict(inputTensor);
        const scores = prediction.dataSync();
        const maxIndex = scores.indexOf(Math.max(...scores));
        const label = labels.value[maxIndex];
        const confidence = (scores[maxIndex] * 100).toFixed(1);

        texts.push(`Tangan ${i + 1}: ${label} (${confidence}%)`);

        inputTensor.dispose();
        prediction.dispose?.();
      } catch (err) {
        console.error("❌ Gagal prediksi:", err);
        texts.push(`Tangan ${i + 1}: error`);
      }
    }

    detectedText.value = texts.join("\n");
  } else {
    detectedText.value = "✋ Tangan tidak terdeteksi";
  }
};

onBeforeUnmount(() => {
  stopCamera();
});
</script>
